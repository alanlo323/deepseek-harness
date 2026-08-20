# Agent Note: Three-minute default LLM retry delay cap

Status: implemented

English | [中文](2026-08-20-llm-retry-max-delay-three-minutes.zh.md)

## Problem

A provider `Retry-After` often exceeds ten seconds. When that instruction is above `maxDelayMs`, [normal-mode recovery](2026-07-24-provider-retry-policies.md) delegates instead of waiting, so the retry the provider asked for never runs. The delay cap must cover typical rate-limit windows without stalling a turn for the Node timer maximum.

## Decision

Omitted-policy `maxDelayMs` is 180000 milliseconds (3 minutes). Local exponential backoff and an accepted provider `Retry-After` still cap at that value. An over-cap provider delay still makes normal mode delegate and always mode use local backoff. Initial delay, jitter, retry count, eligible codes, and the rest of the [provider-policy](2026-07-24-provider-retry-policies.md) mechanism are unchanged.

The [bounded-recovery](../architecture/2026-06-21-bounded-llm-request-recovery.md) and [provider-policy](2026-07-24-provider-retry-policies.md) notes record this default.

## Alternatives considered

**Keep a 10-second cap matching OpenCode.** Rejected: provider `Retry-After` commonly exceeds 10 seconds, so normal mode would skip the wait the provider instructed.

**No cap, or the Node timer maximum.** Rejected: a single scheduled retry could stall a turn for weeks.

**Match the five-minute adapter idle timeout.** Rejected: that timer bounds an outstanding provider read, not a scheduled wait between attempts; 3 minutes covers typical `Retry-After` without coupling the two.

## Consequences

A default-policy retry may wait up to 3 minutes before the next attempt. Deployments that want a shorter cap set `retryPolicy.backoff.maxDelayMs` on the provider route. The UI countdown already renders the scheduled `delayMs`.

## Testing

`packages/llm/llm/tests/retry-policy.spec.ts` pins omitted and always-mode default `maxDelayMs` at 180000. `packages/llm/llm-retry/tests/retry.spec.ts` honors a default-policy `Retry-After` of 180000 milliseconds and delegates 180001. `packages/test-support/llm-replay/tests/llm-replay.spec.ts` pins a route that omits `retryPolicy`.
