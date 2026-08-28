---
description: "Web GUI 中已提交 Markdown 文档的报告对话视图，以及 present_document 工具卡片，供报告体验的用户与维护者阅读。"
kind: "package-reference"
---

# @deepseek-ai/dsh-client-ui-document

[English](README.md) | 中文

## 概述

本包为 Web GUI 增加报告对话标签页与 `present_document` 工具卡片。该标签页仅在该会话至少一次成功 present 之后才列出。卡片为该次调用打开报告视图；实时观察者也会在 hydrate 之后追加的成功 present 时打开它。快照 Markdown 来自工具结果；实时 Markdown 经 `submittedDocument.read` 做一次新的工作区读取。

## 目录

- [使用本包](#use-this-package)
- [理解实现](#understand-the-implementation)
- [进一步探索](#further-exploration)
- [模型体验](#model-experience)
- [已知限制与延期工作](#known-limitations-and-deferred-work)
- [开发备注](#dev-note)

-----

<a id="use-this-package"></a>
## 使用本包

已交付的 Web 包已在 `ui-trajectory` 之后挂载本插件。它等待 `conversation.view`、`conversation.session.live` 与 `remote.submittedDocument`。没有配置项。

-----

<a id="understand-the-implementation"></a>
## 理解实现

<details>
<summary>实现细节——点击展开</summary>

`availableDocuments` 订阅 `SessionBinding.eventSource`，在成功的 `submitted-document` 结果存在之前保持为 false。`DocumentObserver` 忽略 replace 与 prepend 窗口，因此回放不会自动打开标签页。仅当目标位于该文档的 `images` 允许列表上时，才改写工作区图片。

</details>

-----

<a id="further-exploration"></a>
## 进一步探索

- [dsh-document-host](../../document/document-host/README.zh.md)——实时读取与图片 Fetch。
- [ui-conversation](../ui-conversation/README.zh.md)——视图标签环与实时观察者槽位。
- [已提交文档 Agent Note](../../../.agents/notes/implemented/feature/2026-08-28-submitted-document-view.zh.md)——为何标签页在成功的工具调用之前保持隐藏。

-----

<a id="model-experience"></a>
## 模型体验

无，因为本浏览器报告视图与 present_document 卡片不注册任何面向模型的内容；每个面向模型的 schema 与结果由 present_document 工具拥有。

#### KV Cache 影响

无；本包从不组装或发送提供方请求。

## 已知限制与延期工作

<a id="known-limitations-and-deferred-work"></a>


这些限制定义当前的报告界面。它们是当前的包约束，不是任务待办。

- **成功之前隐藏**——在会话窗口出现成功的 `present_document` 之前，报告标签页不存在。
- **回放不自动打开**——只有 hydrate 之后的实时追加会打开标签页；恢复的会话显示该标签页但不会切换到它。
- **仅相对图片**——远程 `http(s)` 目标仍交给 Markdown 渲染器；加载失败的工作区图片显示失败占位。

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者的工作上下文——点击展开</summary>

无。

</details>
