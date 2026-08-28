# Agent Note: Recover DeepSeek vision requests from a per-prompt image cap

Status: implemented

English | [中文](2026-08-28-deepseek-prompt-image-cap-recovery.zh.md)

## Problem

Several `read_image` results, or several user-attached images, remain in durable history and are serialized together on the next DeepSeek chat request. The configured `maxImagesPerRequest` default is 600, matching the published Files-mode high watermark in the [unified image request pipeline](../feature/2026-08-20-unified-image-request-pipeline.md). A live endpoint may still refuse the request with HTTP 400 `At most N image(s) may be provided in one prompt` (or `one request`). That failure is `INVALID_REQUEST`, which [bounded LLM request recovery](../architecture/2026-06-21-bounded-llm-request-recovery.md) does not retry, so every later turn resends the same over-cap image set and the session cannot continue.

## Decision

The DeepSeek adapter treats that 400 as a request-projection failure, not a terminal invalid prompt. It reads the named cap from nested `error.message`, a top-level `{ message, type, code }` object, and the raw HTTP body, because live gateways emit all three, including a `400: {…}` wrapper around the inner object. The experimental `deepseek-v4-flash-vision-exp` catalog entry projects at most one image on the first request, matching live `limit_mm_per_prompt`. A pi-ai catalog entry, `modelOverrides` value, or Models settings row may set `maxImagesPerRequest` the same way; omission leaves that model's count unbounded until a provider 400 names a tighter cap, so a custom LM Studio row can send many images by default and set `1` only on a vision model that refuses more. When another model’s refused chat has more wire images or durable image blocks than the named cap, the same `stream()` call rebuilds the request with `maxImages` set to the cap and `countQuantum` 1, then sends it once more. Oldest images become the existing request-limit placeholders; newest images stay as Files ids or inline data URLs. The failed attempt is not a session event, matching stale-file and Files-to-inline recovery in [Files resolution fallback](2026-08-21-deepseek-files-inline-fallback.md). A request that already fits the named cap, a 400 that is not this refusal, or a second refusal after the tightened attempt, still fails as `INVALID_REQUEST`.

## Alternatives considered

**Default `maxImagesPerRequest` to 1 on every route.** Rejected because the published DeepSeek bound is 600, and OpenAI-compatible gateways vary. A harness default of 1 would omit images an endpoint that honors a larger set would have accepted.

**Emit one image per user message and keep the configured request cap.** Rejected as the sole fix: OpenAI-compatible serving that applies `limit_mm_per_prompt` to the whole chat body still refuses after the split.

**Remember the observed cap on the adapter instance.** Rejected for the same reason Files fallback rejects an outage circuit: process-local state couples unrelated sessions and hides endpoint recovery until restart.

**Classify this 400 as retryable through `dsh-llm-retry`.** Rejected because a retried identical request fails again. Recovery has to change the image projection inside the adapter, as stale-file replacement already does.

**Refuse concurrent `read_image` calls.** Rejected because durable attachment writes remain valid; the defect is request projection against a tighter provider cap, not the tool.

## Verification

Adapter tests parse the prompt and request wordings, including a top-level OpenAI error object and a `400: {…}` wrapper, project the experimental vision catalog to one image on the first chat, recover two grouped tool-result images to the newest Files id with a placeholder for the omitted image, refuse a generic image 400 without a second chat, skip recovery when the wire already fits the named cap, and throw after one recovered attempt if the tightened request is refused again. Pi-ai catalog tests record an explicit `maxImagesPerRequest` and refuse 0 or a non-integer; the pi-ai adapter projects that count on the first chat. Pi-ai context tests keep the newest image under `maxImages` 1, and the pi-ai adapter retries one `400: {…}` wrapper after oldest-first offload. Models settings tests accept a blank image-count field as unbounded and refuse an unreadable count.

## Consequences

A session that already recorded terminal `INVALID_REQUEST` rows can continue on the next prompt: the experimental vision catalog offloads to one image before the first chat, a pi-ai settings row can name the same first-request cap, and other DeepSeek routes 400 internally, offload to the named cap, and stream. The model sees only the newest retained images plus placeholders for the rest, so a four-image batch is not fully visible in that request. Configured 600-image offload and its count quantum are unchanged for endpoints that accept the larger set. Custom pi-ai vision routes use the same named-cap parse and one oldest-first offload retry.
