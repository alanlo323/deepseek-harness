# Agent Note: Browser Session 视口侧栏

Status: implemented

[English](2026-09-03-browser-viewport-sidebar.md) | 中文

## Problem

Web profile 上的 agent 可以驱动一等无头 Chromium 会话，但人类在应用内看不到该页面。操作系统 Chrome 窗口会泄漏第二套 UI。把 JPEG 帧放进 `tool/result` 或新的 `SessionEventMap` 成员，会把无界 base64 送给模型与持久日志。复用详情栏或会话视图会与现有占用者冲突。

## Decision

DeepSeek Harness 自己启动无头 Chromium。Web GUI 只在会话作用域的 `browser` 槽位显示该页面：在 `BROWSER_FOUR_COLUMN_MIN`（1380px）使用第四条 grid track，低于该阈值则使用条带 overlay。预览帧作为 JSON JPEG 项走仅供观看的 Remote 流，环容量为 1。它们永不进入模型请求，也永不进入会话日志。`browser_open` / `browser_run` / `browser_close` 结果仍是普通 `tool/call` 加 `tool/result`，`meta.kind` 为 `'browser-session'`。没有新的会话事件，也不提升 `SESSION_FORMAT_VERSION`。

布局面板在投影状态从非 open 变为 open 的边沿自动打开（以及占用者挂载到已是 open 的快照时）。收起面板不是 `browser_close`。宿主预览路径从不发送 CDP `Input.*`。Playwright 子进程隔离不是安全边界。v1 仅 Web profile：进程级单 Browser Session、通用工具卡片，且不挂到 headless、ACP 或已交付 agent preset。`web_search` 与 `web_fetch` 不打开该会话。

报告标签页所拒绝的第四栏（[已提交文档视图](2026-08-28-submitted-document-view.zh.md)）仍然成立：那个产品是会话视图。本栏是 Chat 与 Details 旁边仅供观看的 Chromium 预览。

## Alternatives considered

**MCP Playwright 或操作系统 Chrome 窗口。** 拒绝：产品自己负责启动，侧栏是唯一人类画面。

**把 JPEG 帧放在 `tool/result` 或新的会话事件上。** 拒绝：帧仅供人类且无界；日志在没有它们时仍可回放。

**详情栏或 `openDetails()`。** 拒绝：Details 已承载工具详情；兄弟 `browser` 槽位让两者同时可见。

**原始二进制 mux 项。** 拒绝：Remote mux 只走 JSON。

**挂到 base / headless / agent preset。** 拒绝：Python SDK 与 headless 组合不得拉取 Playwright。

## Consequences

Web 组合在宿主平面工具注册表上登记这三个工具名，因此每个 Web agent（包括 `minimal`）都会继承它们；headless 与 ACP 不登记。第二次 `browser_open` 在 `close` 之前失败。`maxResultBytes` 溢出是失败而不是截断。启动失败会大声报错，工具仍留在列表中。会话文件可回放工具结果，不含 JPEG magic。用户可以隐藏面板并仍在内存中保留最后一帧。CENTER_MIN 保持 640，直到四栏求解器的最后回退。

相关：[已提交文档报告视图](2026-08-28-submitted-document-view.zh.md) 说明会话报告标签页为何不是布局栏。
