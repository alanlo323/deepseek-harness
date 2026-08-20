# Agent Note: Web thinking paragraph-advance — collapsed prefix rolls one line

Status: implemented

English | [中文](2026-08-19-web-thinking-paragraph-advance.zh.md)

## Problem

Default collapsed Think already shows the start of the current blank-line paragraph, but a generation change replaced that one-line summary in place. The previous prefix vanished instantly, so the row felt cleared rather than advanced.

## Decision

In prefix mode, a collapsed streaming summary rolls in a one-line slot when the blank-line **segment index** changes after this slot instance has committed a previous generation. Outgoing text translates up and out; the new paragraph’s start translates up from below. Duration is `PARAGRAPH_ADVANCE_MS` (500). A timeout is the only commit; the CSS transform is visual. An in-flight roll is not cancelled by a newer generation; after 500ms the slot jumps to then-current `latestParagraph`. Same-index token growth does not roll. First paint, `'follow-end'`, `prefers-reduced-motion: reduce`, settlement, and expand do not roll.

`PrefixAdvanceSlot` in `ReasoningRow.tsx` owns in-flight state and the timeout and is rendered only as `collapsedContent`, so expand unmounts it. Settlement while still mounted clears the timeout synchronously. `window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches === true` skips the roll. No new Host setting. Paragraph detection stays in the presentation layer.

The prefix source itself remains the [prefix-preview decision](2026-08-18-web-thinking-prefix-preview.md). `'follow-end'` remains the [tail-scroll decision](2026-08-02-web-thinking-tail-scroll.md).

## Alternatives considered

**Two-line window, then settle to one line.** Rejected: the row chrome stays one 24px line.

**Queue one roll per skipped paragraph, or cancel/retarget when a newer paragraph arrives.** Rejected: finish the current 500ms roll, then jump; skipped segments need not play. Stale text during a fast Think is accepted.

**Identity by `latestParagraph` string equality.** Rejected: same-paragraph growth would roll, and `Hello\n\nHello` would not.

**Hold the timeout on `ReasoningRow`.** Rejected: expand unmounts `collapsedContent` only (`DisclosureRow`); parent state would outlive the slot.

**`transitionend` as commit, or `scrollTop` via the 3-frame visual throttle.** Rejected: jsdom does not run CSS transitions; the throttle is for follow-end `scrollLeft`, not a 500ms roll.

## Consequences

Prefix Think advances like scrolling down one line instead of clearing. Fast streams can show a stale paragraph for 500ms, then jump. The advancing track uses `translateY(-24px)` (one line-height); a `-100%` translate would move by the two-line track height and empty the viewport before commit. Unit tests fake `setTimeout`/`clearTimeout` only and restore real timers so follow-end rAF stubs stay intact. Settlement keeps the last paragraph ([settled last-paragraph decision](2026-08-20-web-thinking-settled-last-paragraph.md)).

## Testing

`packages/client/ui-conversation/tests/reasoning-row.client.spec.tsx` pins first-paint switch without a roll, same-generation growth, identical adjacent paragraphs, incoming growth during the roll, catch-up jump, reduced-motion skip, settle-cancel keeping the last paragraph, and expand then collapse as first paint. `assistant-think-preview.client.spec.tsx` still flips prefix and follow-end on a streaming row (the summary node may change). Follow-end `scrollLeft` remains in the same spec. E2E does not assert the 500ms window; settled replay Think names follow the last blank-line paragraph ([settled last-paragraph decision](2026-08-20-web-thinking-settled-last-paragraph.md)).
