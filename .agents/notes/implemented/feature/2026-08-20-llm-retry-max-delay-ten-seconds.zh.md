# Agent Note: LLM 重试延迟上限为十秒

Status: implemented

[English](2026-08-20-llm-retry-max-delay-ten-seconds.md) | 中文

## 问题

省略策略时的 `maxDelayMs` 必须约束两次尝试之间已调度的等待。提高该上限并不能让静默的进行中提供方读取继续存活：重试延迟不是尚未完成读取的延长。更长的上限还会让提供方 `Retry-After` 占用一轮数分钟，却不改变 prefill 行为。

## 决策

省略策略时的 `maxDelayMs` 为 10000 毫秒（10 秒）。本地指数退避与被接受的提供方 `Retry-After` 仍以该值为上限。超出上限的提供方延迟仍使 normal 模式**委托后续处理**，并使 always 模式改用本地退避。接受这种超出上限的委托：更大的延迟上限并不能让静默 prefill 继续存活。初始延迟、jitter（抖动）、重试次数、合格 code，以及[提供方策略](2026-07-24-provider-retry-policies.md)机制的其余部分均不变。

[有界恢复](../architecture/2026-06-21-bounded-llm-request-recovery.md)与[提供方策略](2026-07-24-provider-retry-policies.md)笔记记录该默认值。后来的三分钟默认值是[历史快照](../../archived/feature/2026-08-20-llm-retry-max-delay-three-minutes.md)，不是当前权威。[prefill 空闲看门狗](2026-08-20-llm-prefill-idle-watchdog.md)拥有 prefill 空闲策略。

## 考虑过的替代方案

**保持省略策略时 3 分钟上限。** 否决：它不会延长尚未完成的流读取，因此不能阻止 idle watchdog 在 prefill 期间中止，还会拉长仍会在超出上限时委托的已调度等待。

**与适配器五分钟空闲超时对齐。** 否决：该定时器约束的是 token 开始后尚未完成的提供方读取，不是两次尝试之间的已调度等待。

**无上限，或使用 Node 定时器最大值。** 否决：单次已调度重试可能把一轮卡住数周。

## 后果

默认策略的重试在下一次尝试前最多等待 10 秒。提供方 `Retry-After` 超过 10 秒时，normal 模式仍会委托后续处理。需要更长上限的部署在提供方路由上设置 `retryPolicy.backoff.maxDelayMs`。UI 倒计时已经渲染已调度的 `delayMs`。

## 测试

`packages/llm/llm/tests/retry-policy.spec.ts` 将省略策略与 always 模式默认 `maxDelayMs` 钉在 10000。`packages/llm/llm-retry/tests/retry.spec.ts` 接受默认策略下 10000 毫秒的 `Retry-After`，并对 10001 委托后续处理。`packages/test-support/llm-replay/tests/llm-replay.spec.ts` 钉住省略 `retryPolicy` 的路由。
