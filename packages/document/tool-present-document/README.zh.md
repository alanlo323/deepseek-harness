---
description: "面向模型的 present_document 工具：提交工作区 Markdown 文件以便 Web 报告视图打开它，供选择、组合或调试该工具的用户与维护者阅读。"
kind: "package-reference"
---

# @deepseek-ai/dsh-tool-present-document

[English](README.md) | 中文

## 概述

`dsh-tool-present-document` 让 agent 提交一份已完成的工作区 Markdown 文件，以便用户在 Web 报告视图中打开它。成功调用确认标题、逻辑路径与字节长度；它不返回文件正文。把它挂进会写最终报告的预设；随后已交付的 Web 宿主记住该次调用，且报告标签页仅在该次成功之后出现。

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

在已有 `ctx.tools` 的组合上挂载本插件。agent 传入工作区相对的 `.md` 或 `.markdown` 路径，并可传入可选标题；省略标题时使用第一个 ATX 标题或文件词干。

```yaml
- id: tool-present-document
  name: '@deepseek-ai/dsh-tool-present-document'
```

| 字段 | 默认值 | 含义 |
|---|---|---|
| `maxBytes` | `262144` | 完整序列化 `presentationMeta` JSON 的最大 UTF-8 字节长度 |

生成的 [配置目录](../../../docs/config-catalog.zh.md#deepseek-aidsh-tool-present-document) 是受支持字段的详尽来源。

### 失败

没有所属 agent、会话头没有 `cwd`、路径不是工作区相对 Markdown、文件为空、路径逃出工作区、调用是嵌套的 PTC/`run_code` 分发，或即使剥离后的快照仍超过 `maxBytes` 时，调用失败。成功仍会记录快照：当完整正文会超过上限时，先丢掉 `content`（再丢掉末尾图片），并将 `truncated` 设为 true。

-----

<a id="understand-the-implementation"></a>
## 理解实现

<details>
<summary>实现细节——点击展开</summary>

execute 值在 `presentationMeta` 运行前会被克隆并冻结，因此快照经 `snapshotId` 旁路传递，而不是值上的非 JSON 属性。本工具不追加新的会话事件类型；成功是标准 `tool/result`，其 `meta.kind` 为 `submitted-document`。

</details>

-----

<a id="further-exploration"></a>
## 进一步探索

- [已提交文档子系统](../../../docs/subsystems/document.zh.md)——快照与投影类型。
- [document 组地图](../README.zh.md)——同组包。
- [生成的工具目录](../../../docs/tool-catalog.zh.md#deepseek-aidsh-tool-present-document)——模型接收的 schema。
- [已提交文档 Agent Note](../../../.agents/notes/implemented/feature/2026-08-28-submitted-document-view.zh.md)——为何工具即产品。

-----

<a id="model-experience"></a>
## 模型体验

### 工具 schema

#### 模型看到什么

模型看到生成的 [`present_document` schema](../../../docs/tool-catalog.zh.md#deepseek-aidsh-tool-present-document)：必填 `path`、可选 `title`，以及要求在报告文件写完后调用一次的描述。

#### Token 影响

在工具可见的每次请求上是固定 schema 成本；给定配置下描述与 schema 稳定。

#### KV Cache 影响

在定义与可见性不变时前缀稳定。

### 工具调用历史与结果

#### 模型看到什么

成功返回 `status`、`title`、`logicalPath`、`byteLength` 以及不透明的 `snapshotId`。渲染确认是 `Presented <logicalPath> (<byteLength> bytes) as "<title>".` Markdown 正文不在工具结果中；它只存在于 UI 专用的 `presentationMeta`。

#### Token 影响

结果小且形状固定。Token 增长是调用参数加上该确认。

#### KV Cache 影响

只追加；新可见内容跟在可复用请求前缀之后，不使既有 KV-cache 条目失效。

## 已知限制与延期工作

<a id="known-limitations-and-deferred-work"></a>


这些限制定义该工具何时不适合。它们是当前的包约束，不是任务待办。

- **仅确认**——模型从不收到文件正文；报告视图读取 `presentationMeta` 或实时工作区文件。
- **仅顶层调用**——嵌套的 PTC/`run_code` 分发会被拒绝；只有直接的 `tool/result` 会写入 `presentationMeta` 并打开报告标签页。
- **一份工作区文件**——路径必须是 `session.header.cwd` 内的工作区相对 Markdown；没有 process-cwd 回退。
- **快照上限**——`maxBytes` 约束序列化快照；过大正文会从快照截断，若剥离后仍超上限则调用失败。

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者的工作上下文——点击展开</summary>

无。

</details>
