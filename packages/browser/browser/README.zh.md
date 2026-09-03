---
description: "无头 Browser Session 能力缝（ctx.browser）：一个活动 Chromium 会话、脚本执行，以及仅供人类观看的投屏帧。"
kind: "package-reference"
---

# `@deepseek-ai/dsh-browser`

[English](README.md) | 中文

## 概述

`ctx.browser` 最多拥有一个活动的无头 Chromium Browser Session：`open`、`run`、`close`，以及内存中的 JPEG 投屏订阅。投屏帧不会进入会话日志或模型请求。

## 目录

- [使用本包](#use-this-package)
- [模型体验](#model-experience)
- [已知限制与延期工作](#known-limitations-and-deferred-work)
- [开发备注](#dev-note)

-----

<a id="use-this-package"></a>
## 使用本包

在 Web 宿主平面挂载本 Service Definition、如 `dsh-browser-playwright` 的提供方，以及 `dsh-tool-browser`。第二次 `open` 在 `close` 之前会失败。引擎子进程隔离不是安全边界。

不发布运行时 invariant 伴生包；活动会话占用由本服务持有，无法独立观测。

<a id="model-experience"></a>
## 模型体验

间接地，通过 dsh-tool-browser。

#### KV Cache 影响

无；该包既不组装也不发送提供方请求。

## 已知限制与延期工作
<a id="known-limitations-and-deferred-work"></a>

- **v1 是进程级单 Browser Session** — 第二次 `open` 在 `close` 之前会失败。
- **引擎进程隔离不是安全边界** — 将 `browser_run` 脚本与其他由模型驱动的执行同等对待。

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者的工作上下文——点击展开</summary>

无。

</details>
