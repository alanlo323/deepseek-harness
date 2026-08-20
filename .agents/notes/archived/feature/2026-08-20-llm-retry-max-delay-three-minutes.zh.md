# Agent Note: LLM 重试延迟上限为三分钟

Status: implemented
Archived: 2026-08-20

[English](2026-08-20-llm-retry-max-delay-three-minutes.md) | 中文

## 问题

提供方 `Retry-After` 经常超过十秒。当该指令高于 `maxDelayMs` 时，[normal 模式恢复](2026-07-24-provider-retry-policies.md)会委托后续处理而不是等待，因此提供方要求的那次重试不会发生。延迟上限必须覆盖常见的限速窗口，又不能把一轮停在 Node 定时器最大值上。

## 决策

省略策略时的 `maxDelayMs` 为 180000 毫秒（3 分钟）。本地指数退避与被接受的提供方 `Retry-After` 仍以该值为上限。超出上限的提供方延迟仍使 normal 模式委托后续处理，并使 always 模式改用本地退避。初始延迟、jitter（抖动）、重试次数、合格 code，以及[提供方策略](2026-07-24-provider-retry-policies.md)机制的其余部分均不变。

[有界恢复](../architecture/2026-06-21-bounded-llm-request-recovery.md)与[提供方策略](2026-07-24-provider-retry-policies.md)笔记记录该默认值。

## 考虑过的替代方案

**保持与 OpenCode 一致的 10 秒上限。** 否决：提供方 `Retry-After` 常常超过 10 秒，normal 模式就会跳过提供方指示的等待。

**无上限，或使用 Node 定时器最大值。** 否决：单次已调度重试可能把一轮卡住数周。

**与适配器五分钟空闲超时对齐。** 否决：该定时器约束的是尚未完成的提供方读取，不是两次尝试之间的已调度等待；3 分钟覆盖常见 `Retry-After`，且不把两者绑在一起。

## 后果

默认策略的重试在下一次尝试前最多等待 3 分钟。需要更短上限的部署在提供方路由上设置 `retryPolicy.backoff.maxDelayMs`。UI 倒计时已经渲染已调度的 `delayMs`。

## 测试

`packages/llm/llm/tests/retry-policy.spec.ts` 将省略策略与 always 模式默认 `maxDelayMs` 钉在 180000。`packages/llm/llm-retry/tests/retry.spec.ts` 接受默认策略下 180000 毫秒的 `Retry-After`，并对 180001 委托后续处理。`packages/test-support/llm-replay/tests/llm-replay.spec.ts` 钉住省略 `retryPolicy` 的路由。
