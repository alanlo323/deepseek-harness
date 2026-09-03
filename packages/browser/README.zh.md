---
description: "无头 Chromium Browser Session 家族的包映射：能力缝、Playwright 提供方、面向模型的工具、宿主 Remote 与 Web 视口。"
kind: "package-group"
---

# packages/browser

[English](README.md) | 中文

## 概述

`browser/` 组让 Web GUI 在 agent 驱动一个无头 Browser Session 时，提供仅供观看的实时 Chromium 视口，工具为 `browser_open`、`browser_run` 与 `browser_close`。投屏 JPEG 帧留在 Remote 流上，永不进入会话日志或模型请求。该组仅用于 Web profile：headless、ACP 与已交付 agent preset 不挂载它。

## 目录

- [包](#packages)
- [相关文档](#related-documentation)
- [开发备注](#dev-note)

-----

<a id="packages"></a>
## 包

五个包分担该家族；子系统参考拥有穷尽类型。

| 包 | 职责 | ctx 键 |
|---|---|---|
| [`browser/`](browser/README.zh.md) | Browser Session 服务：最多一个活动 Chromium 会话、脚本执行、内存投屏 | `ctx.browser` |
| [`browser-playwright/`](browser-playwright/README.zh.md) | 子进程中的无头 Chromium 后端，带 CDP JPEG 投屏 | 注册到 `ctx.browser` |
| [`tool-browser/`](tool-browser/README.zh.md) | 向模型公开 `browser_open`、`browser_run` 与 `browser_close` | 注册到 `ctx.tools` |
| [`browser-host/`](browser-host/README.zh.md) | 宿主投影与仅供观看的投屏 Remote | `ctx.browserHost` |
| [`../client/ui-browser/`](../client/ui-browser/README.zh.md) | 仅供观看的 Web 视口栏与放大层 | 占据 `browser` |

-----

<a id="related-documentation"></a>
## 相关文档

- [Browser 子系统](../../docs/subsystems/browser.zh.md) — 会话 meta、投屏帧、Host Remote 请求与 Cordis API。
- [Browser 视口 Agent Note](../../.agents/notes/implemented/feature/2026-09-03-browser-viewport-sidebar.zh.md) — 帧为何不进日志，以及该栏为何不是报告标签页。

-----

<a id="dev-note"></a>
## 开发备注

<details>
<summary>维护者的工作上下文——点击展开</summary>

无。

</details>
