# Agent Note: Ten-second default LLM retry delay cap

Status: implemented

English | [中文](2026-08-20-llm-retry-max-delay-ten-seconds.zh.md)

## Problem

Omitted-policy `maxDelayMs` must bound a scheduled wait between attempts. Raising that cap cannot keep a silent in-flight provider read alive: retry delay is not an outstanding-read extension. A longer cap also lets a provider `Retry-After` occupy a turn for minutes without changing prefill behavior.

## Decision

Omitted-policy `maxDelayMs` is 10000 milliseconds (10 seconds). Local exponential backoff and an accepted provider `Retry-After` still cap at that value. An over-cap provider delay still makes normal mode **delegate** and always mode use local backoff. That over-cap delegation is accepted: a larger delay cap does not keep silent prefill alive. Initial delay, jitter, retry count, eligible codes, and the rest of the [provider-policy](2026-07-24-provider-retry-policies.md) mechanism are unchanged.

The [bounded-recovery](../architecture/2026-06-21-bounded-llm-request-recovery.md) and [provider-policy](2026-07-24-provider-retry-policies.md) notes record this default. A later three-minute default is a [historical snapshot](../../archived/feature/2026-08-20-llm-retry-max-delay-three-minutes.md), not current authority. Prefill idle policy is owned by [the prefill idle watchdog](2026-08-20-llm-prefill-idle-watchdog.md).

## Alternatives considered

**Keep a 3-minute omitted-policy cap.** Rejected: it does not extend an outstanding stream read, so it cannot stop idle-watchdog prefill abort, and it lengthens scheduled waits that still delegate above the cap.

**Match the five-minute adapter idle timeout.** Rejected: that timer bounds an outstanding provider read after tokens start, not a scheduled wait between attempts.

**No cap, or the Node timer maximum.** Rejected: a single scheduled retry could stall a turn for weeks.

## Consequences

A default-policy retry may wait up to 10 seconds before the next attempt. A provider `Retry-After` above 10 seconds still delegates in normal mode. Deployments that want a longer cap set `retryPolicy.backoff.maxDelayMs` on the provider route. The UI countdown already renders the scheduled `delayMs`.

## Testing

`packages/llm/llm/tests/retry-policy.spec.ts` pins omitted and always-mode default `maxDelayMs` at 10000. `packages/llm/llm-retry/tests/retry.spec.ts` honors a default-policy `Retry-After` of 10000 milliseconds and delegates 10001. `packages/test-support/llm-replay/tests/llm-replay.spec.ts` pins a route that omits `retryPolicy`.
