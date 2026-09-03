# Agent Note: 浏览器引擎占用与拆除

Status: implemented

[English](2026-09-03-browser-engine-occupancy-teardown.md) | 中文

## 问题

失败的 `browser_open`、挂起的 `browser_close` 或超时的 `browser_run` 会让进程内唯一的 Browser Session 无法再用：Playwright 子进程仍占用提供方，而 `ctx.browser` 已报关闭；stdin 上的 abort 行要等当前 open/run 结束；超时脚本仍占用同一 page；已退出子进程的 `kill()` 会抛错。Host 也会被非 JSON 的 stdout 行打崩；Client 投屏订阅抛错会留下未处理的 rejection。

## 决策

`PlaywrightBrowserProvider.open` 在 open RPC 失败时杀死并丢弃子进程，因此之后的 `open` 可以重试。`close` 最多等待 `closeTimeoutMs`（默认 5000）让 close RPC 完成，然后始终 `kill()`，并吞掉已退出进程上的抛错。子进程意外退出会通知 `subscribeDropped`，以便 `ctx.browser` 清除占用。stdout、帧、`dropped` 和行缓冲只作用于当前子进程；被替换的子进程的迟到行不会让新占用失败，也不会画进新预览。`runChildMain` 立即把 abort 行应用到进行中命令的 `AbortSignal`，只对 open/run/close 串行化。`SessionEngine.open` 把 Chromium 启动和 page 建立（`#createLive`）都与 abort 竞速，并关闭在 abort 赢了 race 之后才启动成功的 Chromium。在 `maxWallMs` 或调用方 abort 之后，它关闭旧 context，并在下一次 `run` 前重建 page。`BrowserRuntime.open` 在调用方 signal 已中止时不发布占用；`close` 在提供方拆除完成前保持占用，共用一次进行中的 close，并在拆除抛错时仍清除占用。运行时在 drop 触发时，或在 `open` 回滚已重放的 drop 时，解除其 drop 回呼。`parseProtocolLine` 对非 JSON 返回 `undefined`。视口订阅循环捕获 Remote/会话错误并保留最后一帧。视口面板在卸载时清除放大 overlay 和最新帧。

这扩展了[视口侧栏决策](../feature/2026-09-03-browser-viewport-sidebar.zh.md)；不改变仅供观看的 JPEG 路径，也不改变仅 Web 挂载。

## 备选方案

**RPC 失败时保留占用，让用户重启 Host。** 否决：Service Definition 已规定失败的 `open` 保持关闭以便重试；卡住的子进程是产品缺陷，不是操作步骤。

**在下一次 `run` 之前等待残留的 `AsyncFunction` 工作结束。** 否决：挂起的 `Promise` 无法被杀死。关闭旧 context 并重建 page 可隔离 page 状态；残留 JS 可继续运行直到它结束或抛错。

**在 `provider.close()` 之前清除 `ctx.browser` 占用。** 否决：挂起的拆除会让 close 报 `BROWSER_SESSION_CLOSED`、open 报 `BROWSER_SESSION_OPEN`。占用保持到拆除完成，并以 `closeTimeoutMs` 加 `kill()` 为上限。

## 后果

启动失败可在不重启 Host 的情况下重试。Abort 会打断进行中的启动/运行。超时脚本不与下一次 `run` 共享 page。Close 会到达静止或 kill 期限。被替换的子进程的 stdout 不会打垮新会话。Drop 回呼不会跨占用累积。子进程的非 JSON stdout 不会打垮 Host。投屏 Remote 抛错时视口仍保持空状态。离开会话会收起放大 overlay。
