---
description: "Web Browser Session 预览的宿主投影与 JPEG 投屏 Remote。"
kind: "package-reference"
---

# `@deepseek-ai/dsh-browser-host`

[English](README.md) | 中文

## 概述

本 Host Consumer 把 `browser-session` 工具 `meta` 折进会话投影，并经现有 Remote mux 以 JSON 项流式传输 JPEG 投屏帧。帧不会进入会话日志。

## 目录

- [使用本包](#use-this-package)
- [模型体验](#model-experience)
- [已知限制与延期工作](#known-limitations-and-deferred-work)
- [开发备注](#dev-note)

-----

<a id="use-this-package"></a>
## 使用本包

在 Web 宿主平面与 `dsh-browser` 一并挂载。`screencast` Remote 仅供观看：从不发送 CDP Input 命令。不发布运行时 invariant 伴生包；投影占用由本服务持有。

<a id="model-experience"></a>
## 模型体验

无。宿主投影与投屏 Remote 不会进入模型请求。

#### KV Cache 影响

无；该包既不组装也不发送提供方请求。

## 已知限制与延期工作
<a id="known-limitations-and-deferred-work"></a>

- **帧是共享 mux 上的 JSON base64** — 慢消费者会丢掉更旧的帧（容量为 1 的环）。
- **仅供观看** — 没有供用户点击或键入的 Remote。

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者的工作上下文——点击展开</summary>

无。

</details>
