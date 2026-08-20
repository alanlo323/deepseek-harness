# Agent Note: Prefill 期间不布防流空闲看门狗

Status: implemented

[English](2026-08-20-llm-prefill-idle-watchdog.md) | 中文

## 问题

两个已交付的远程适配器都会为每次尚未完成的 `next()` 布防 `idleWatchdog`，包括覆盖 `fetch` 加静默提供方 prefill 的第一次 demand。仍在计算、且没有 SSE 字节的模型会被当成空闲，并在 `streamIdleTimeoutMs`（默认五分钟）时抛出 `TIMEOUT`。重试 `maxDelayMs` 无法让该读取继续存活。

## 决策

`idleWatchdog.next(iterator, { idle?: boolean })` 默认是已计时 demand。`{ idle: false }` 占用 watchdog（并发 `next()` 仍会拒绝）但不布防。`pulse()` 只为**已计时**尚未完成的 demand（`timedOutstanding`）重新布防，因此 prefill 期间的 SSE 注释不会启动空闲间隔。`timeoutMs <= 0` 仍被拒绝；它不是公开的关闭开关。

适配器在 `startsPostTokenIdle(chunk)` 为真之前保持 `idleArmed` 为 false：即 `isTokenDelta`，或 `blockType` 为 `text`、`reasoning`、`tool-call` 的 `block-start`。空 delta 不会启动上限。该分片被 yield 之后，后续 `next()` 按现有 `streamIdleTimeoutMs` 计时。两个适配器都在 yield 之前检查 `timeoutOf`。未计时 prefill 期间的用户或轮次取消仍为 `ABORTED`。

重试退避保持独立：省略策略时的 `maxDelayMs` 由[十秒延迟上限](2026-08-20-llm-retry-max-delay-ten-seconds.md)拥有。watchdog 原语由[超时库](../architecture/2026-07-06-timeout-deadline-library.md)拥有。token 之后的停滞恢复仍在[有界恢复](../architecture/2026-06-21-bounded-llm-request-recovery.md)。

## 考虑过的替代方案

**提高 `streamIdleTimeoutMs`（例如到 30–60 分钟）。** 否决：长 prefill 仍会在新上限处被掐断，中途停滞检测也会变慢。

**整段调用关闭 idle。** 否决：token 开始后卡住的正文将永不 idle-TIMEOUT。

**把 SSE 注释、HTTP 标头或 TCP keep-alive 当作首 token 存活信号。** 否决：prefill 常常完全没有这些；注释也不得启动 token 之后的计时器。

**把任何 delta（包括空 delta）当作第一个 token。** 否决：空 delta 是心跳和空工具调用帧；`isTokenDelta` 已经排除它们。

## 后果

超过五分钟的静默 prefill 不再 idle-TIMEOUT，也不会因此消耗重试预算。挂起的 fetch 会占用该轮，直到取消。第一个内容 token 之后，卡住的正文仍会 idle-TIMEOUT，并且仍可重试。waiting UI 文案延后。

## 测试

`packages/util/timeout/tests/timeout.spec.ts` 钉住未计时 `next`、pulse 为空操作、空 options 仍计时、未计时期间拒绝并发，以及构造时拒绝 `timeoutMs <= 0`。`packages/llm/llm/tests/message.spec.ts` 钉住 `startsPostTokenIdle`。DeepSeek 与 pi-ai 适配器测试钉住静默 prefill 中止、延迟首个内容且不 idle TIMEOUT，以及 token 之后停滞 TIMEOUT。DeepSeek 另外钉住 token 之后 SSE 注释 pulse。`packages/llm/llm-retry/tests/transport-recovery.spec.ts` 用 `slow_success`（第一个内容之后再 delay）证明 TIMEOUT 后重试。无密钥 headless `deepseek-defaults` 快照在无 SSE 注释的情况下把第一个内容延迟到超过 `streamIdleTimeoutMs: 150`，并要求只有一次请求且没有 `llm/retry`。
