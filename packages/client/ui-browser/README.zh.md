---
description: "仅供观看的 Web GUI Browser Session 视口栏与放大层。"
kind: "package-reference"
---

# `@deepseek-ai/dsh-client-ui-browser`

[English](README.md) | 中文

## 概述

本 Client 插件占据会话作用域的 `browser` 槽位，提供仅供观看的 JPEG 视口与放大层。收起面板不会关闭 Browser Session。

## 目录

- [使用本包](#use-this-package)
- [模型体验](#model-experience)
- [已知限制与延期工作](#known-limitations-and-deferred-work)
- [开发备注](#dev-note)

-----

<a id="use-this-package"></a>
## 使用本包

在 Web Client 名册中于 `ui-layout` 之后挂载。布局面板在投影状态从非 open 变为 open 的边沿自动打开。不发布运行时 invariant 伴生包；预览是查看状态。

<a id="model-experience"></a>
## 模型体验

无。仅供观看的视口不会进入模型请求。

#### KV Cache 影响

无；该包既不组装也不发送提供方请求。

## 已知限制与延期工作
<a id="known-limitations-and-deferred-work"></a>

- **收起不是 `browser_close`** — 面板隐藏后最后一帧可以保留。
- **低于 1380px 时预览是条带 overlay** — 不会占用详情栏。

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者的工作上下文——点击展开</summary>

无。

</details>
