# Agent Note：已提交文档的报告视图

Status: implemented

[English](2026-08-28-submitted-document-view.md) | 中文

## 问题

研究用 agent（智能体）可以把写完的 Markdown 报告放进会话工作区，但 Web GUI 无法把该文件当作一等文档重新打开。把正文贴进对话会丢掉图片、撑爆 transcript（文本记录），也没有用户可以返回的标签页。产品需要的是一个模型可调用的提交工具，以及一个在该工具成功之前保持缺席的报告对话标签页。

execute 的返回值不是回放快照。agent loop（智能体循环）持久化的是 `output.render`，以及（若已声明）写到 `tool/result` 上的 `output.presentationMeta`；值上的非 JSON 属性无法在喂给 `presentationMeta` 的克隆中存活。

到达浏览器的工作区读档是信任边界。把绝对宿主路径存下来、在缺少 `cwd` 时回退到 process-cwd，或只在提交时做一次包含性检查，都会让随后的符号链接替换提供出会话工作区之外的文件。

## 决策

工具即产品。只有成功的 `present_document` 调用能把 Markdown 文件放进报告视图，也才能让该会话出现报告标签页。

三个平面保持分离。`@deepseek-ai/dsh-tool-present-document` 只挂在 agent preset 上。`@deepseek-ai/dsh-document-host` 是常驻 Web 宿主服务：折叠成功的 present、暴露 `submittedDocument.read`，并在 `ctx.connection.fetch` 上注册 `/api/submitted-document-image`。`@deepseek-ai/dsh-client-ui-document` 是常驻 Web 客户端插件，其标签页可见性仍按会话计算。已交付 preset 不挂该工具；用户 preset 可以挂。

没有新的 `SessionEventMap` 成员。回放快照是 kind 为 `submitted-document` 的版本化 `presentationMeta`。宿主投影存放调用身份、标题、逻辑路径与图片引用——不含 Markdown 正文。execute 返回短确认；`snapshotId` 是 `presentationMeta` 从进程内 Map 取走的不透明句柄，因为克隆后的值不能用非 JSON 属性携带快照。`additionalProperties: false` 使 `snapshotId` 留在模型可见的输出 schema 中。

报告标签页是带 `available(binding)` 的 `conversation.view` 条目，仅在该会话事件窗口存在一次成功 present 之后为 true。`ui-conversation` 按会话组装 header 名单，并在 persist 指向当前不可用的视图时回落到 Chat。自动打开不能挂在文档视图本身上，因为 `ConversationSession` 只渲染当前选中的视图；`conversation.session.live` 始终挂载，且 `DocumentObserver` 只对 hydrate 之后的 `eventSource` append 调用 `openView('document', callId)`。replace 与 prepend 窗口重建可见性，不切换标签页。

每次提交、实时 Markdown 与图片读取都走同一套包含性解析器：必须有 `session.header.cwd`，用 `realpath` 加 `isPathUnder` 重新检查包含关系，没有 process-cwd 回退。逻辑路径是工作区相对的 POSIX；`joinLogicalPath` 可在结果仍位于工作区之内时弹出 `..`，而 `normalizeLogicalPath` 仍拒绝包含 `..` 的模型路径。图片由该次调用记录的 `imageRef` 列表授权，对照光栅魔数嗅探，PNG/JPEG/GIF 像素边上限 8192，并带 `X-Content-Type-Options: nosniff`。从不列出或提供 SVG。之后逃出工作区的实时文件仍拒绝实时字节；当 `content` 存在时，Markdown 回退到提交时快照。

`maxBytes`（默认 262144）约束完整序列化 `presentationMeta` JSON。过大正文先丢掉 `content` 再丢掉末尾图片；若剥离后的快照仍超上限则调用失败。空 Markdown 文件失败。

## 备选方案

**`ui-layout` 第四栏。**否决：会在 Chat 与 Details 旁再加一个根子项，并与既有对话视图条冲突。

**只在工具卡片内渲染 Markdown。**否决：用户需要 hydrate 之后可重开的标签页，而不是沉进 transcript 的卡片。

**新的 `SessionEventMap` 成员。**否决：`tool/result` 加 `presentationMeta` 已经是提交点，新事件只会重复一次标准工具成功。

**用 `WebServer.register` 提供图片。**否决：图片必须走已认证的 Connection Fetch 通道，而不是裸 HTTP 路由。

**始终可见的报告标签页。**否决：从未调用该工具的会话必须看起来与今天的 Chat／Trajectory header 一样。

**缺少 `session.header.cwd` 时回退到 process-cwd。**否决：那是 `tool-fs` 的便利路径，会提供会话并未授权的文件。

**在 meta 中持久化 `FsTarget.displayPath` 或绝对宿主路径。**否决：显示拼写不是授权依据，存下的真实路径会跳过提交后的包含性重检。

## 后果

仅当 preset 挂载该工具时，模型才看得到 `present_document`。成功确认标题、逻辑路径、字节长度与 `snapshotId`；从不返回文件正文。嵌套的 PTC/`run_code` 分发会被拒绝；只有顶层 `tool/result` 会写入 `presentationMeta` 并打开报告标签页。用户从报告标签页和工具卡片重开快照或实时工作区读取。

`snapshotId` 是实现句柄，因为值在 `presentationMeta` 运行前被 JSON 克隆，所以会漏进模型可见 schema。把它当作不透明值；它不是持久的文档身份。

WebP 只做魔数嗅探与字节上限；没有像素边解析。恢复的会话在历史含有成功 present 时显示报告标签页，但不会从 Chat 抢走焦点。本次变更没有录制报告标签页的 Web snapshot；GUI 与单元测试是无密钥证明，带密钥的 `DSH_SNAPSHOT=record` 仍是点名的覆盖缺口。

相关：[Client 派生的工具展示](../architecture/2026-08-23-client-derived-tool-presentation.zh.md) 把 `presentationMeta` 定为持久结果事实，本功能用它存放 Markdown 快照。
