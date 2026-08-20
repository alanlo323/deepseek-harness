# Agent Note：Web 思考换段推进 —— 折叠 prefix 滚动一行

Status: implemented

[English](2026-08-19-web-thinking-paragraph-advance.md) | 中文

## 问题

默认折叠 Think 已经显示当前空行段落的开头，但世代切换会原地替换那一行摘要。前一段前缀瞬间消失，行看起来像被清空，而不是推进。

## 决策

在 prefix 模式下，折叠流式摘要只在本 slot 实例已经提交过上一个世代之后，空行**段索引**再变化时，用单行槽滚动。旧文字向上滑出，新段开头从下方滑入。时长为 `PARAGRAPH_ADVANCE_MS`（500）。只有 timeout 负责提交；CSS transform 只负责画面。进行中的滚动不因更新的世代而取消；500ms 后跳到当时的 `latestParagraph`。同一索引的 token 增长不滚动。首次绘制、`'follow-end'`、`prefers-reduced-motion: reduce`、结算和展开都不滚动。

`ReasoningRow.tsx` 里的 `PrefixAdvanceSlot` 拥有进行中状态和 timeout，并且只作为 `collapsedContent` 渲染，因此展开会卸载它。仍挂载时结算会同步清除 timeout。`window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches === true` 时跳过滚动。不新增 Host 设置。段落检测留在展示层。

摘要来源仍由[前缀预览决策](2026-08-18-web-thinking-prefix-preview.md)拥有。`'follow-end'` 仍由[尾部滚动决策](2026-08-02-web-thinking-tail-scroll.md)拥有。

## 曾考虑的替代方案

**先变成两行再收成一行。** 否决：行外观保持一行 24px。

**为跳过的每一段排队滚动，或在新段到达时取消/改目标。** 否决：播完当前 500ms，再跳转；中间段不必播放。快速 Think 显示过时文字是接受的。

**用 `latestParagraph` 字符串相等当身份。** 否决：同段增长会误触发滚动，`Hello\n\nHello` 则不会滚动。

**把 timeout 放在 `ReasoningRow` 上。** 否决：展开只卸载 `collapsedContent`（`DisclosureRow`）；父级状态会比 slot 活得更久。

**用 `transitionend` 提交，或用 3 帧视觉节流去做 `scrollTop`。** 否决：jsdom 不跑 CSS transition；该节流服务于 follow-end 的 `scrollLeft`，不是 500ms 滚动。

## 后果

Prefix Think 像向下滚一行，而不是清空。快速流式输出可能把过时段落显示 500ms，然后跳转。推进轨道使用 `translateY(-24px)`（一行行高）；`-100%` 会按两行轨道高度位移，在提交前把视口移空。单元测试只伪造 `setTimeout`/`clearTimeout`，并恢复真实 timers，以免破坏 follow-end 的 rAF stub。结算保留最后一段（[结算末段决策](2026-08-20-web-thinking-settled-last-paragraph.md)）。

## 测试

`packages/client/ui-conversation/tests/reasoning-row.client.spec.tsx` 固定无滚动的首次绘制切换、同世代增长、相邻相同段落、滚动中 incoming 增长、追赶跳转、减弱动效跳过、结算取消并保留末段，以及展开再折叠视为当前世代的首次绘制。`assistant-think-preview.client.spec.tsx` 仍在流式行上双向切换 prefix 与 follow-end（摘要节点可以更换）。follow-end 的 `scrollLeft` 仍在同一 spec。E2E 不断言 500ms 窗口；结算态 replay 的 Think 名称跟随最后一个空行段落（[结算末段决策](2026-08-20-web-thinking-settled-last-paragraph.md)）。
