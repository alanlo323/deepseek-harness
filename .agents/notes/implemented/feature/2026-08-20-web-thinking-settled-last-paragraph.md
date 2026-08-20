# Agent Note: Web thinking settled last paragraph — collapsed summary stays on the final segment

Status: implemented

English | [中文](2026-08-20-web-thinking-settled-last-paragraph.zh.md)

## Problem

A collapsed Think that had already advanced to a later blank-line paragraph jumped back to the first line of the whole block when the row settled. The last thought the user had just watched disappeared from the one-line summary.

## Decision

Settled collapsed Think uses the same `latestParagraph` source as the prefix streaming summary, with `scrollLeft = 0` and without `data-follow-end`. Settlement still cancels an in-flight paragraph-advance roll; it does not restore the whole-block first line. `'follow-end'` while running is unchanged. Expanded `thinkBody` and Trajectory Thinking are unchanged. No new Host setting, session, wire, or model-visible contract.

This supersedes the settled-first-line clause of the [prefix-preview decision](2026-08-18-web-thinking-prefix-preview.md) and the matching settlement sentence in the [tail-scroll decision](2026-08-02-web-thinking-tail-scroll.md). Streaming prefix identity and the one-line roll remain the [prefix-preview](2026-08-18-web-thinking-prefix-preview.md) and [paragraph-advance](2026-08-19-web-thinking-paragraph-advance.md) decisions.

## Alternatives considered

**Keep whole-block `firstLine` so historical goldens stay byte-stable.** Rejected: settlement then undoes the paragraph the user just read.

**Keep `firstLine` of the last paragraph only.** Rejected: streaming prefix already shows the full last segment in the one-line slot; settlement should not shrink that source.

## Consequences

A finished Think row still shows the last blank-line paragraph. A block with no blank line keeps the whole text as one paragraph, so the one-line slot ellipsizes from the start of that text. Assembled Chromium goldens that previously captured a first line of a later-segment think now capture that last segment.

## Testing

`packages/client/ui-conversation/tests/reasoning-row.client.spec.tsx` pins a settled multi-paragraph row on the last paragraph, settle-during-roll keeping that paragraph, and `'follow-end'` dropping `data-follow-end` while leaving `scrollLeft = 0` on the last paragraph. `apps/web/tests/snapshots/` Think button names follow the last blank-line segment of each recorded reasoning block.
