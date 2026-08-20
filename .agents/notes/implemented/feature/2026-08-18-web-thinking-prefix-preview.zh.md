# Agent Note：Web 思考前缀预览 —— 折叠态 reasoning 保持可读

Status: implemented

[English](2026-08-18-web-thinking-prefix-preview.md) | 中文

## 问题

折叠的流式 Think 行会在每个 reasoning delta 之后把 `scrollLeft` 钉到最新一行的行内末端。没有换行的长段落因此在单行摘要里横向疾驰，用户不展开就读不到当前思考。末端跟随对想在摘要里看到节奏的用户仍然有用，但不能作为唯一模式。

## 决策

默认的折叠流式摘要是当前空行段落（`\n\n` / `\r\n\r\n`）的开头，包含仍在写入的文字，`scrollLeft` 保持为 `0`，并且没有 `data-follow-end`。出现空行后，摘要来源换成新段落；只有空行、后面还没有字符时，继续显示上一个非空段落。模型始终不输出空行时，前缀停在第一段，已有运行中扫光承担活跃提示。该 prefix slot 在世代再次变化时滚动一行，而不是原地替换（[换段推进决策](2026-08-19-web-thinking-paragraph-advance.md)）。

Host 字段 `ui-conversation.collapsedThinkPreview`（`prefix` | `follow-end`，默认 `prefix`）与 `busyEnter` 一起持久化。通用设置行通过 `ThinkPreviewPreference` 写入。`apply()` 只 bind 一次会话 `SettingsScope`，并把它交给 `ComposerSubmissionPolicy` 和 `ThinkPreviewPreference`。实时 `SnapshotStore` 作为 `ChatNodeInjected.hooks.collapsedThinkPreview` 注入 `conversation.chat.node`（不是 `SlotHookFactory`）；只有 `AssistantNodeView` 订阅并把 `previewMode` 传给 `ReasoningRow`。Think 仍在流式输出时切换设置，会在下一次渲染更新该行。`followEnd = running && previewMode === 'follow-end'` 同时驱动摘要、滚动对齐和 `data-follow-end`。

已结算的折叠摘要是 `latestParagraph`，`scrollLeft = 0`，与偏好无关（[结算末段决策](2026-08-20-web-thinking-settled-last-paragraph.md)）。展开后的 `thinkBody` 与 Trajectory Thinking 不变。不改变 session、wire、持久事件或模型可见约定。

`'follow-end'` 的实现仍由[尾部滚动决策](2026-08-02-web-thinking-tail-scroll.md)拥有。

## 曾考虑的替代方案

**没有设置、直接对所有人取消末端跟随。** 否决：用户要求可立刻生效、可切回的通用设置。

**把 store 经 `ChatViewInjected` owner props 向下传。** 否决：ChatView 只拥有有序 Node 清单；把 Think 外观放进 view inject 会拉长 prop 链并扩大重渲染。

**把预览模式做成和 `turnData` 一样的 `SlotHookFactory`。** 否决：该模式不依赖 `nodeKey`。slot renderer 已经会把 `SnapshotStore` 绑成 selector hook。

**归档尾部滚动笔记。** 否决：`'follow-end'` 仍在交付该机制；旧笔记继续拥有那条路径。

## 后果

两个通用设置选择器共用 `SettingsSelectRow`。默认折叠 Think 可在段落开头阅读。想要最新行末端跟随的用户可在通用设置中恢复，无需重新加载。每个 keyed Chat renderer 都会多收到一个未使用的 hook，直到出现第二个 assistant-only 的响应式事实才值得拆 slot。没有该字段的既有设置文档通过 schema 默认解析为 `prefix`。

## 测试

`packages/client/ui-conversation/tests/reasoning-row.client.spec.tsx` 固定 prefix 默认、空行切换、尾随空行保留、follow-end 选择、结算后保留末段，以及 prefix 换段滚动。`assistant-think-preview.client.spec.tsx` 在同一条溢出的流式行上双向翻转 inject store。`think-preview-preference.client.spec.ts` 与 `think-preview-row.client.spec.tsx` 固定 Host 回写和通用设置行。`host.client.spec.ts` 接受两个合法值、拒绝非法值，并在部分更新时让另一字段保持 schema 默认。`chat-apply.client.spec.tsx` 期望 `composer-enter` 然后 `think-preview`。`apps/web/tests/lifecycle-chrome.e2e.ts` 先等到 running Think 行，再断言该行没有 `data-follow-end`；结算态 replay 的 Think 名称跟随最后一个空行段落（[结算末段决策](2026-08-20-web-thinking-settled-last-paragraph.md)）。`apps/web/tests/snapshots/settings-chrome/dialog.expected.md` 固定通用设置中的该行。
