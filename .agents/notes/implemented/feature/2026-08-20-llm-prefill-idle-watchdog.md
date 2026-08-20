# Agent Note: Prefill does not arm the stream idle watchdog

Status: implemented

English | [中文](2026-08-20-llm-prefill-idle-watchdog.zh.md)

## Problem

Both shipping remote adapters arm `idleWatchdog` for every outstanding `next()`, including the first demand that covers `fetch` plus silent provider prefill. A still-computing model with no SSE bytes then looks idle and throws `TIMEOUT` at `streamIdleTimeoutMs` (default five minutes). Retry `maxDelayMs` cannot keep that read alive.

## Decision

`idleWatchdog.next(iterator, { idle?: boolean })` defaults to a timed demand. `{ idle: false }` occupies the watchdog (concurrent `next()` still rejects) without arming. `pulse()` rearms only a **timed** outstanding demand (`timedOutstanding`), so SSE comments during prefill do not start the idle interval. `timeoutMs <= 0` remains rejected; it is not a public disable.

Adapters keep `idleArmed` false until `startsPostTokenIdle(chunk)` is true: a non-empty `text-delta`, `reasoning-delta`, or `tool-call-delta` whose `argumentsDelta` is non-empty. A `block-start` and a named tool-call frame with empty arguments do not start the cap — local OpenAI-compatible servers often announce `write` (empty `arguments`) and then generate the body for a long time before the next non-empty fragment. After a qualifying chunk is yielded, later `next()` calls are timed at the existing `streamIdleTimeoutMs`. Both adapters check `timeoutOf` before yield. User or turn cancellation during untimed prefill remains `ABORTED`.

Retry backoff stays independent: omitted-policy `maxDelayMs` is owned by [the ten-second delay cap](2026-08-20-llm-retry-max-delay-ten-seconds.md). The watchdog primitive is owned by [the timeout library](../architecture/2026-07-06-timeout-deadline-library.md). Post-token stall recovery remains in [bounded recovery](../architecture/2026-06-21-bounded-llm-request-recovery.md).

## Alternatives considered

**Raise `streamIdleTimeoutMs` (for example to 30–60 minutes).** Rejected: long prefill still dies at the new cap, and mid-stream stall detection also slows.

**Disable idle for the whole call.** Rejected: a stalled body after tokens start would never idle-TIMEOUT.

**Treat SSE comments, HTTP headers, or TCP keep-alive as first-token liveness.** Rejected: prefill often has none of them; comments must not start the post-token timer.

**Treat any delta, including empty, as the first token.** Rejected: empty text/reasoning deltas are heartbeats; empty tool-call `argumentsDelta` is a named header, not argument body.

**Treat a tool-call `block-start` or a named empty `tool-call-delta` as the first token.** Rejected: providers emit that header as soon as the call is named; argument generation can then run for a long time with no non-empty `argumentsDelta`. `isTokenDelta` still treats a named empty tool-call frame as a first token for client TTFT; idle arming does not.

## Consequences

A silent prefill longer than five minutes no longer idle-TIMEOUTs or consumes retry budget for that reason. A hung fetch occupies the turn until cancel. A named tool-call header with empty arguments is still untimed until a non-empty `argumentsDelta`. After the first non-empty content delta, a stalled body still idle-TIMEOUTs and remains retryable. Waiting-UI copy is deferred.

## Testing

`packages/util/timeout/tests/timeout.spec.ts` pins untimed `next`, pulse no-op, empty-options still timed, concurrent untimed reject, and constructor reject of `timeoutMs <= 0`. `packages/llm/llm/tests/message.spec.ts` pins `startsPostTokenIdle`. DeepSeek and pi-ai adapter tests pin silent-prefill abort, delayed first content without idle TIMEOUT, a delayed tool-call argument body without idle TIMEOUT, and post-token stall TIMEOUT. DeepSeek also pins post-token SSE-comment pulse. `packages/llm/llm-retry/tests/transport-recovery.spec.ts` uses `slow_success` (delay after first content) for TIMEOUT-then-retry. The keyless headless `deepseek-defaults` snapshot delays first content past `streamIdleTimeoutMs: 150` with no SSE comments and requires one request with no `llm/retry`.
