# Agent Note: Web thinking prefix preview — collapsed reasoning stays readable

Status: implemented

English | [中文](2026-08-18-web-thinking-prefix-preview.zh.md)

## Problem

A collapsed streaming Think row pinned `scrollLeft` to the inline end of the latest line after every reasoning delta. Long paragraphs without a newline therefore raced horizontally through the one-line summary, so the user could not read the current thought without expanding the row. The tail-follow itself remains useful for users who want cadence in the summary; it must not be the only mode.

## Decision

The default collapsed streaming summary is the start of the current blank-line paragraph (`\n\n` / `\r\n\r\n`), including in-progress text, with `scrollLeft` held at `0` and without `data-follow-end`. After a blank line the summary source becomes the new paragraph; a trailing blank line with no following characters keeps the previous non-empty paragraph. When the model never emits a blank line, the prefix stays on the first paragraph and the existing running sweep is the liveness cue. A later generation change in that prefix slot rolls one line rather than replacing in place ([paragraph-advance decision](2026-08-19-web-thinking-paragraph-advance.md)).

The Host `ui-conversation.collapsedThinkPreview` field (`prefix` | `follow-end`, default `prefix`) stores the choice beside `busyEnter`. A General Settings row writes it through `ThinkPreviewPreference`. `apply()` binds the conversation `SettingsScope` once and passes that scope to both `ComposerSubmissionPolicy` and `ThinkPreviewPreference`. The live `SnapshotStore` is injected on `conversation.chat.node` as `ChatNodeInjected.hooks.collapsedThinkPreview` (not a `SlotHookFactory`); only `AssistantNodeView` subscribes and passes `previewMode` into `ReasoningRow`. A toggle while a Think is streaming updates that row on the next render. `followEnd = running && previewMode === 'follow-end'` drives the summary, the scroll alignment, and `data-follow-end` together.

Settled collapsed summary is `latestParagraph` at `scrollLeft = 0`, regardless of the preference ([settled last-paragraph decision](2026-08-20-web-thinking-settled-last-paragraph.md)). Expanded `thinkBody` and Trajectory Thinking are unchanged. No session, wire, durable event, or model-visible contract changes.

The `'follow-end'` implementation remains the [tail-scroll decision](2026-08-02-web-thinking-tail-scroll.md).

## Alternatives considered

**Replace tail-follow for everyone with no setting.** Rejected: the user required a reversible General Settings control that applies immediately.

**Thread the store through `ChatViewInjected` owner props.** Rejected: ChatView owns only the ordered Node list; putting Think chrome on the view inject lengthens the prop chain and widens rerenders.

**Treat preview mode as a `SlotHookFactory` like `turnData`.** Rejected: the mode does not depend on `nodeKey`. The slot renderer already binds a `SnapshotStore` as a selector hook.

**Archive the tail-scroll note.** Rejected: `'follow-end'` still ships that mechanism; the older note stays the owner of that path.

## Consequences

The two General Settings selectors share `SettingsSelectRow`. Default collapsed Think is readable at the paragraph start. Users who want latest-line end-follow restore it from General Settings without reload. Every keyed Chat renderer receives the extra unused hook until a second assistant-only reactive fact justifies a split slot. Existing settings documents without the field resolve to `prefix` through the schema default.

## Testing

`packages/client/ui-conversation/tests/reasoning-row.client.spec.tsx` pins prefix default, blank-line switch, trailing-boundary hold, follow-end opt-in, settled last-paragraph keep, and the prefix paragraph-advance roll. `assistant-think-preview.client.spec.tsx` flips the inject store both directions on one overflowing streaming row. `think-preview-preference.client.spec.ts` and `think-preview-row.client.spec.tsx` pin Host write-through and the General row. `host.client.spec.ts` accepts both union values, rejects invalid values, and keeps the other field at its schema default on a partial update. `chat-apply.client.spec.tsx` expects `composer-enter` then `think-preview`. `apps/web/tests/lifecycle-chrome.e2e.ts` waits for a running Think row and asserts that row has no `data-follow-end`; settled replay Think names follow the last blank-line paragraph ([settled last-paragraph decision](2026-08-20-web-thinking-settled-last-paragraph.md)). `apps/web/tests/snapshots/settings-chrome/dialog.expected.md` pins the General Settings row.
