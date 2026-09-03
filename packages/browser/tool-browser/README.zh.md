---
description: "面向模型的 browser_open、browser_run 与 browser_close 工具，建立在 ctx.browser 之上。"
kind: "package-reference"
---

# `@deepseek-ai/dsh-tool-browser`

[English](README.md) | 中文

## 概述

这三个工具给 Web profile 上的 agent 一个无头 Chromium Browser Session：打开、对同一 page 运行 Playwright 脚本体、关闭。投屏帧不会出现在工具结果里。只在 Web 宿主平面选择本包；headless、ACP 与已交付 agent preset 不挂载它。引擎子进程隔离不是安全边界。

## 目录

- [使用本包](#use-this-package)
- [进一步探索](#further-exploration)
- [模型体验](#model-experience)
- [已知限制与延期工作](#known-limitations-and-deferred-work)
- [开发备注](#dev-note)

-----

<a id="use-this-package"></a>
## 使用本包

在 `dsh-browser` 以及如 `dsh-browser-playwright` 的提供方之后挂载。第二次 `browser_open` 在 `browser_close` 之前会失败。`web_search` 与 `web_fetch` 不会打开该会话。不发布运行时 invariant 伴生包；占用由 `ctx.browser` 持有。

-----

<a id="further-exploration"></a>
## 进一步探索

- [Browser 子系统](../../../docs/subsystems/browser.zh.md) — 会话 meta、投屏帧与 Host Remote 请求。
- [browser 组地图](../README.zh.md) — 五个包构成的家族与各自职责。
- [生成的工具目录](../../../docs/tool-catalog.zh.md#deepseek-aidsh-tool-browser) — 模型收到的三个 schema。
- [Browser 视口 Agent Note](../../../.agents/notes/implemented/feature/2026-09-03-browser-viewport-sidebar.zh.md) — 帧为何不进日志。

-----

<a id="model-experience"></a>
## 模型体验

### System prompt

#### What the model sees

`tool:browser` 段落即下方指导。只要本插件已挂载就会注册，即使随后 Chromium 启动失败也仍在。

##### Browser Session guidance

```markdown
Use browser_open, browser_run, and browser_close for one headless Chromium Browser Session. browser_open starts the session; a second open fails until browser_close. browser_run evaluates a Playwright script body with page, browser, context, and playwright in scope against that same page. Return JSON-serializable values only; oversized results fail rather than truncate. browser_close tears the session down. web_search and web_fetch do not open this session.
```

#### Token effect

只要插件已挂载，每次请求都有固定指导成本。

#### KV Cache effect

在该段文本与可见性不变时前缀稳定。插件生命周期可能从此段开始使复用失效。

### Tool schema

#### What the model sees

模型看到生成的 [`browser_open`、`browser_run` 与 `browser_close` schema](../../../docs/tool-catalog.zh.md#deepseek-aidsh-tool-browser)。`browser_run` 需要 `script`。成功值包含 `browserSessionId` 与 `dshSessionId`；不含 JPEG 帧。

#### Token effect

只要工具可见，每次请求都有固定 schema 成本。

#### KV Cache effect

在三个定义及其可见性不变时前缀稳定。插件生命周期或作用域限制可能从此 schema 开始使复用失效。

### Tool-call history and result

#### What the model sees

`browser_open` 成功为 `Browser Session <id> is open.`。第二次 open 失败为 `a Browser Session is already open`。`browser_run` 成功为 `browser_run result: <json>`，或在无会话、结果非 JSON、JSON 超过 `maxResultBytes` 时失败。`browser_close` 成功为 `Browser Session <id> is closed.`。没有所属 agent 会话的调用失败为 `browser tools require an owning agent session`。JPEG 帧不会出现在这些结果里。

#### Token effect

调用参数随每个 `script` 正文增长，直到压缩。成功结果除受提供方 Config 封顶的 JSON `browser_run` 载荷外都很短。

#### KV Cache effect

只追加；新可见的工具历史跟在可复用请求前缀之后，不会使已有 KV-cache 条目失效。

## 已知限制与延期工作
<a id="known-limitations-and-deferred-work"></a>

- **v1 是进程级单 Browser Session** — 第二次 `open` 在 `close` 之前会失败。
- **引擎进程隔离不是安全边界** — 将 `browser_run` 脚本与其他由模型驱动的执行同等对待。
- **仅 Web profile** — headless、ACP 与已交付 agent preset 不挂载这些工具。

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者的工作上下文——点击展开</summary>

无。

</details>
