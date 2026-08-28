# Agent Note: Web thinking tail scroll — collapsed reasoning follows live output

Status: implemented

English | [中文](2026-08-02-web-thinking-tail-scroll.zh.md)

## Problem

The Web Think row rendered the first reasoning line as its collapsed summary for both settled and streaming blocks. Once that first line existed, every later reasoning delta changed hidden body text only. A fast model therefore looked stationary while it was thinking, and the user had to expand the full chain of thought to verify that output was still moving. The product backlog already called for “thinking: scrolling chain-of-thought updates, expandable”; the current row satisfied only the second half.

## Decision

When `ui-conversation.collapsedThinkPreview` is `'follow-end'`, only a collapsed Think row whose reasoning block is the active streaming tail follows live output. Its summary is the latest non-blank line instead of the settled last paragraph, and the existing single-line summary element becomes a programmatic horizontal scrollport pinned to `scrollWidth - clientWidth` after each text update. Direct `scrollLeft` assignment deliberately follows real deltas without inventing an independent marquee speed: fast tokens move fast, a paused model stops, and short text stays still because the scroll range is zero. The default `'prefix'` summary is owned by the [prefix-preview decision](2026-08-18-web-thinking-prefix-preview.md).

The behavior is owned by the existing presentation components. `AssistantMarkdown` chooses the latest line only while the Think row is running under `'follow-end'`; `ToolRow` already owns collapsed/open state and therefore owns whether its summary should follow the inline end. No session, wire, durable event, or model-visible contract changes. Expanding removes the collapsed summary and renders the complete reasoning body in ordinary page flow. When the row settles, it keeps the last blank-line paragraph and resets the summary to the left edge ([settled last-paragraph decision](2026-08-20-web-thinking-settled-last-paragraph.md)). Other tool summaries and settled Think rows retain their existing ellipsis behavior.

## Alternatives considered

**Animate a CSS marquee independent of streaming.** Rejected: it would keep moving through provider stalls and make a slow model look fast, which breaks the throughput signal the interaction exists to expose.

**Always show a fixed suffix of the complete reasoning string.** Rejected: character slicing can cut a word or grapheme, discards the current line’s beginning before overflow actually requires it, and jumps rather than moving with each delta.

**Auto-scroll the expanded reasoning body or the conversation page.** Rejected: expanded content is a reading surface. Forcing it to follow would fight a user who scrolls back; the follower belongs only to the collapsed one-line summary.

## Consequences

Under `'follow-end'`, the collapsed row communicates provider cadence through content motion as well as the existing sweep, while the settled transcript remains byte-for-byte stable. The scroll update runs only on React renders the streaming accumulator already causes; it adds no timer, animation loop, subscription, durable state, or transport traffic. A long current reasoning line retains its full DOM text and programmatically clips the already-overflowing prefix, so expansion still reveals the complete block and assistive technology reads the same current summary text.

## Testing

`packages/client/ui-chat/tests/reasoning-row.client.spec.tsx` pins the latest-line selection, the calculated right-edge scroll position, and settlement to the last paragraph with `scrollLeft = 0` when `previewMode` is `'follow-end'`. The default prefix path, live store toggle, and running-row `data-follow-end` absence are owned by the [prefix-preview decision](2026-08-18-web-thinking-prefix-preview.md). Settled replay Think names follow the last blank-line paragraph ([settled last-paragraph decision](2026-08-20-web-thinking-settled-last-paragraph.md)). The keyless assembled Chromium scenario in `apps/web/tests/lifecycle-chrome.e2e.ts` replays real recorded reasoning chunks and asserts the live collapsed Think row has no `data-follow-end` under the default `'prefix'` summary.
