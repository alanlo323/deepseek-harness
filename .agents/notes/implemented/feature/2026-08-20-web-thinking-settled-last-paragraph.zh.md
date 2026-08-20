# Agent Note：Web 思考结算末段 —— 折叠摘要留在最后一段

Status: implemented

[English](2026-08-20-web-thinking-settled-last-paragraph.md) | 中文

## 问题

折叠 Think 已经推进到后面的空行段落后，行一结算就把摘要跳回整块的首行。用户刚看过的最后一段思考从单行摘要里消失。

## 决策

已结算的折叠 Think 使用与 prefix 流式摘要相同的 `latestParagraph` 来源，`scrollLeft = 0`，并且没有 `data-follow-end`。结算仍会取消进行中的换段滚动；它不再恢复整块首行。运行中的 `'follow-end'` 不变。展开后的 `thinkBody` 与 Trajectory Thinking 不变。不新增 Host 设置，也不改变 session、wire 或模型可见约定。

这取代[前缀预览决策](2026-08-18-web-thinking-prefix-preview.md)中结算恢复首行的条款，以及[尾部滚动决策](2026-08-02-web-thinking-tail-scroll.md)中对应的结算句。流式 prefix 身份和单行滚动仍由[前缀预览](2026-08-18-web-thinking-prefix-preview.md)和[换段推进](2026-08-19-web-thinking-paragraph-advance.md)拥有。

## 曾考虑的替代方案

**继续用整块 `firstLine`，让历史 golden 保持逐字节稳定。** 否决：结算会撤销用户刚读到的那一段。

**只保留最后一段的 `firstLine`。** 否决：流式 prefix 已经在单行槽里显示完整末段；结算不应缩小该来源。

## 后果

完成的 Think 行仍显示最后一个空行段落。没有空行的块整段算一段，单行槽从该段开头起省略。组装态 Chromium golden 里，若思考块后面还有段落，Think 按钮名称跟随最后一段，而不再是整块首行。

## 测试

`packages/client/ui-conversation/tests/reasoning-row.client.spec.tsx` 固定多段落结算行停在最后一段、滚动中结算仍保留该段，以及 `'follow-end'` 去掉 `data-follow-end` 且 `scrollLeft = 0` 落在最后一段。`apps/web/tests/snapshots/` 的 Think 按钮名称跟随每条已记录 reasoning 块的最后一个空行段。
