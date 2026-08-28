# Agent Note: DeepSeek 视觉请求在单次 prompt 图片上限下恢复

Status: implemented

[English](2026-08-28-deepseek-prompt-image-cap-recovery.md) | 中文

## Problem

多次 `read_image` 结果或用户附加的多张图片会留在持久历史中，并在下一次 DeepSeek chat 请求里一起序列化。配置的 `maxImagesPerRequest` 默认为 600，与[统一图片请求管线](../feature/2026-08-20-unified-image-request-pipeline.zh.md)中公布的 Files 模式高水位一致。实际端点仍可能以 HTTP 400 `At most N image(s) may be provided in one prompt`（或 `one request`）拒绝。该失败是 `INVALID_REQUEST`，[有界 LLM 请求恢复](../architecture/2026-06-21-bounded-llm-request-recovery.zh.md)不会重试，因此之后每一轮都会再次发送同一组超限图片，会话无法继续。

## Decision

DeepSeek 适配器把该 400 当作请求投影失败，而不是终态的非法 prompt。它从嵌套的 `error.message`、顶层 `{ message, type, code }` 对象以及原始 HTTP body 读取点名上限，因为线上网关会发出这三种形式，包括包着内部对象的 `400: {…}` 包装。实验性的 `deepseek-v4-flash-vision-exp` 目录条目在第一次请求就最多投影一张图，与线上 `limit_mm_per_prompt` 一致。pi-ai 目录条目、`modelOverrides` 值或模型设置行可以用同样方式设置 `maxImagesPerRequest`；省略时该模型的数量不受限制，直到提供方 400 点名更紧的上限，因此自定义 LM Studio 行默认可发送很多张，只在拒绝更多图片的视觉模型上填 `1`。当其他模型被拒绝的 chat 所含协议图片或持久图片块多于点名上限时，同一次 `stream()` 会把 `maxImages` 设为该上限、把 `countQuantum` 设为 1 后重建请求并再发送一次。最旧图片变成现有的请求上限占位文本；最新图片仍以 Files id 或内联 data URL 保留。失败的那次尝试不是会话事件，这与[Files 解析回退](2026-08-21-deepseek-files-inline-fallback.zh.md)中的陈旧文件和 Files 转内联恢复一致。已经符合点名上限的请求、不属于该拒绝的 400，或收紧后再被拒绝的第二次请求，仍以 `INVALID_REQUEST` 失败。

## Alternatives considered

**把每条路由的 `maxImagesPerRequest` 默认改为 1。** 不采用，因为公布的 DeepSeek 上限是 600，且 OpenAI 兼容网关各不相同。Harness 默认 1 会省略一个遵守更大集合的端点本可接受的图片。

**只改成每条 user 消息一张图，并保留配置的请求上限。** 不作为唯一修复：把 `limit_mm_per_prompt` 作用于整份 chat 请求体的 OpenAI 兼容服务在拆分后仍会拒绝。

**在适配器实例上记住观察到的上限。** 不采用，原因与 Files 回退拒绝故障熔断相同：进程级状态会耦合无关会话，并在重启前掩盖端点恢复。

**通过 `dsh-llm-retry` 把该 400 列为可重试。** 不采用，因为原样重试同一请求仍会失败。恢复必须像陈旧文件替换那样，在适配器内改变图片投影。

**拒绝并发的 `read_image` 调用。** 不采用，因为持久附件写入仍然有效；缺陷是针对更紧提供方上限的请求投影，而不是该工具。

## Verification

适配器测试会解析 prompt 与 request 两种措辞，包括顶层 OpenAI 错误对象和 `400: {…}` 包装，把实验性视觉目录在第一次 chat 投影为一张图，把两张成组的工具结果图片恢复为最新 Files id 并为省略图片留下占位文本，对普通图片 400 不发起第二次 chat，在协议图片已符合点名上限时跳过恢复，并在收紧后的请求再次被拒绝时在一次恢复尝试后抛出。pi-ai 目录测试会记录显式 `maxImagesPerRequest` 并拒绝 0 或非整数；pi-ai 适配器会在第一次 chat 投影该数量。pi-ai 上下文测试会在 `maxImages` 为 1 时保留最新图片；pi-ai 适配器会在最旧优先 offload 后对一次 `400: {…}` 包装再试。模型设置测试会把留空的图片数量字段视为不限制，并拒绝无法读取的数量。

## Consequences

已经记下终态 `INVALID_REQUEST` 行的会话可以在下一条 prompt 继续：实验性视觉目录在第一次 chat 前就 offload 到一张图，pi-ai 设置行可以点名同样的首次请求上限，其他 DeepSeek 路由在内部遇到 400、offload 到点名上限后开始流式输出。模型只能看到最新保留的图片以及其余图片的占位文本，因此四张一批的读取在该请求中不会全部可见。对接受更大集合的端点，配置的 600 张 offload 及其数量步长不变。自定义 pi-ai 视觉路由使用同一套点名上限解析和一次最旧优先 offload 重试。
