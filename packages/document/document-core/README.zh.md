---
description: "已提交文档的共享类型、工作区相对路径、包含性读取与展示快照，供 present_document 与报告宿主使用。"
kind: "package-library"
---

# @deepseek-ai/dsh-document-core

[English](README.md) | 中文

## 概述

`dsh-document-core` 是已提交 Markdown 报告背后的共享库：它规范化工作区相对路径，仅在文件仍解析到会话工作区之内时读取，并构建 `present_document` 在成功工具结果上存放的展示快照。由 present 工具与 document host 导入；`cordis.yml` 无法加载它。绝对宿主路径从不出现在快照中，之后每次实时或图片读取都会重新检查包含关系，而不是复用先前的真实路径。

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

对模型提供的路径调用 `normalizeLogicalPath`，对工作区读取调用 `readContainedUtf8` 或 `readContainedImage`，并用 `buildSubmittedDocumentMeta` 限制序列化快照。`joinLogicalPath` 可在结果仍位于工作区之内时弹出 `..` 段；`normalizeLogicalPath` 仍拒绝包含 `..` 的模型路径。

-----

<a id="understand-the-implementation"></a>
## 理解实现

<details>
<summary>实现细节——点击展开</summary>

包含性检查在要求常规文件的 `stat` 之后使用 `realpath` 与 `isPathUnder`。图片 MIME 在提取时来自允许的扩展名，在提供时来自光栅魔数。从不列出或提供 SVG。

</details>

-----

<a id="further-exploration"></a>
## 进一步探索

- [已提交文档子系统](../../../docs/subsystems/document.zh.md)——本库拥有的快照与投影类型。
- [dsh-tool-present-document](../tool-present-document/README.zh.md)——面向模型的消费方。
- [dsh-document-host](../document-host/README.zh.md)——实时与图片读取的宿主消费方。

-----

<a id="model-experience"></a>
## 模型体验

无，因为本库只拥有路径包含与快照；面向模型的 schema 与结果由 dsh-tool-present-document 拥有。

#### KV Cache 影响

无；本包从不组装或发送提供方请求。

## 已知限制与延期工作

<a id="known-limitations-and-deferred-work"></a>


这些限制定义包含性读取会接受什么。它们是当前的包约束，不是任务待办。

- **模型路径拒绝 `..`**——只有 `joinLogicalPath` 可以弹出父段，且仅当拼接结果仍位于工作区之内。
- **从不提供 SVG**——提取与嗅探只允许 PNG、JPEG、GIF 与 WebP。
- **仅抽取行内图片语法**——`extractWorkspaceImages` 只列出 `![alt](src)` 目标；引用式图片不会进入宿主允许清单。
- **WebP 没有像素边解析**——WebP 文件仍受字节上限约束；PNG、JPEG 与 GIF 在提供时还遵守 8192 像素边上限。

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者的工作上下文——点击展开</summary>

无。

</details>
