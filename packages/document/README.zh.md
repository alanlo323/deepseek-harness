---
description: "document 组地图：present_document、宿主报告投影与 Web 报告视图，供浏览本组的用户与维护者阅读。"
kind: "package-group"
---

# packages/document

[English](README.md) | 中文

## 概述

document 组让 agent 提交一份已完成的工作区 Markdown 文件，以便 Web GUI 将其显示为报告。模型调用一次 `present_document`；宿主记住成功的调用并按需重读该文件；浏览器仅在该次成功之后才打开报告标签页。当研究或写作 agent 应呈现最终 Markdown 报告、而不把正文贴进对话时，使用本组。

## 目录

- [包](#packages)
- [相关文档](#related-documentation)
- [开发备注](#dev-note)

-----

<a id="packages"></a>
## 包

| 包 | 职责 | ctx 键 |
|---|---|---|
| [`document-core`](document-core/README.zh.md) | 共享逻辑路径、包含性读取与展示快照 | — |
| [`tool-present-document`](tool-present-document/README.zh.md) | 让 agent 提交工作区 Markdown 文件供报告视图使用 | 注册到 `ctx.tools` |
| [`document-host`](document-host/README.zh.md) | 宿主投影、实时 Markdown Remote 与已认证图片 Fetch | `ctx.documentHost` |

Web 报告视图与 `present_document` 工具卡片位于 [`client/ui-document`](../client/ui-document/README.zh.md)。

-----

<a id="related-documentation"></a>
## 相关文档

- [已提交文档子系统](../../docs/subsystems/document.zh.md)——快照、投影记录与实时读取类型。
- [生成的工具目录](../../docs/tool-catalog.zh.md#deepseek-aidsh-tool-present-document)——模型接收的 `present_document` schema。
- [已提交文档 Agent Note](../../.agents/notes/implemented/feature/2026-08-28-submitted-document-view.zh.md)——为何工具即产品，以及标签页为何在成功之前保持隐藏。

-----

<a id="dev-note"></a>
## 开发备注

<details>
<summary>维护者的工作上下文——点击展开</summary>

无。

</details>
