---
description: "已提交文档的宿主投影、实时 Markdown Remote 与已认证图片 Fetch，供选择、组合或调试报告宿主的用户与维护者阅读。"
kind: "package-reference"
---

# @deepseek-ai/dsh-document-host

[English](README.md) | 中文

## 概述

`dsh-document-host` 让 Web GUI 列出成功的 `present_document` 调用、从会话工作区重读 Markdown，并提供该文档点名的工作区图片。把它挂在带有 sessions、投影与 Connection 的 Web 宿主上。缺少会话 `cwd` 时故障关闭；没有 process-cwd 回退。每次实时或图片读取都会重新检查包含关系。

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

已交付的 Web 包已挂载本服务。自定义宿主需要 sessions、投影注册表与 Connection：

```yaml
- id: document-host
  name: '@deepseek-ai/dsh-document-host'
```

`submittedDocument.read` 在工作区文件仍可读时返回实时 Markdown，否则返回提交时快照。图片在 Connection 认证请求后由 `/api/submitted-document-image` 提供。

-----

<a id="understand-the-implementation"></a>
## 理解实现

<details>
<summary>实现细节——点击展开</summary>

`submittedDocuments` 投影只记录成功的 present。图片路由要求 `imageRef` 出现在该记录上，嗅探光栅魔数，并拒绝 PNG、JPEG 与 GIF 超过 8192 的像素边。`fetch.register` 跑在 `ctx.connection` 上，因此该路由由本插件 fiber 拥有。

</details>

-----

<a id="further-exploration"></a>
## 进一步探索

- [已提交文档子系统](../../../docs/subsystems/document.zh.md)——Remote 与投影类型。
- [dsh-client-ui-document](../../client/ui-document/README.zh.md)——浏览器报告视图。
- [已提交文档 Agent Note](../../../.agents/notes/implemented/feature/2026-08-28-submitted-document-view.zh.md)——为何实时读取会重新检查包含关系。

-----

<a id="model-experience"></a>
## 模型体验

无，因为本宿主投影与 Remote 服务于已经提交的文档；每个面向模型的契约由 dsh-tool-present-document 拥有。

#### KV Cache 影响

无；本包从不组装或发送提供方请求。

## 已知限制与延期工作

<a id="known-limitations-and-deferred-work"></a>


这些限制定义实时读取或图片 Fetch 何时失败。它们是当前的包约束，不是任务待办。

- **没有 `cwd` 时故障关闭**——没有工作区根的会话头不能实时读取或提供图片；仅当提交时 `content` 存在时才使用快照 Markdown。
- **每次读取都重新检查**——提交后的符号链接替换不能复用先前的真实路径。
- **WebP 尺寸只看魔数**——RIFF/WEBP 签名匹配时提供 WebP；像素边拒绝适用于 PNG、JPEG 与 GIF。

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者的工作上下文——点击展开</summary>

无。

</details>
