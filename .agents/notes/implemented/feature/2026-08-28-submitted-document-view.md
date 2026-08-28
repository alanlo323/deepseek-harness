# Agent Note: Submitted-document Report view

Status: implemented

English | [中文](2026-08-28-submitted-document-view.zh.md)

## Problem

A research agent can write a finished Markdown report into the session workspace, but the Web GUI has no way to reopen that file as a first-class document. Pasting the body into chat loses images, overflows the transcript, and gives the user no tab they can return to. The product need is a model-callable submit tool plus a Report conversation tab that stays absent until that tool succeeds.

The execute return value is not the replay snapshot. The agent loop persists `output.render` and, when declared, `output.presentationMeta` onto `tool/result`; a non-JSON property on the value never survives the clone that feeds `presentationMeta`.

A workspace read that reaches the browser is a trust boundary. A stored absolute host path, a process-cwd fallback, or a one-time containment check at submit time would let a later symlink swap serve a file outside the session workspace.

## Decision

The tool is the product. A successful `present_document` call is the only way a Markdown file enters the Report view, and the only way the Report tab appears in that session.

Three planes stay separate. `@deepseek-ai/dsh-tool-present-document` mounts only on an agent preset. `@deepseek-ai/dsh-document-host` is a standing Web-host service: it folds successful presents, exposes `submittedDocument.read`, and registers `/api/submitted-document-image` on `ctx.connection.fetch`. `@deepseek-ai/dsh-client-ui-document` is a standing Web client plugin whose tab visibility is still per-session. Shipped presets do not mount the tool; a user preset may.

There is no new `SessionEventMap` member. The replay snapshot is versioned `presentationMeta` with kind `submitted-document`. The host projection stores call identity, title, logical path, and image refs — not the Markdown body. Execute returns a short confirmation; `snapshotId` is an opaque handle that `presentationMeta` consumes from a process-local map because the cloned value cannot carry the snapshot as a non-JSON property. `additionalProperties: false` keeps `snapshotId` in the model-visible output schema.

The Report tab is a `conversation.view` entry with `available(binding)` that is true only after a successful present exists in that session's event window. `ui-conversation` builds the header roster per session and falls back to Chat when persist names a currently unavailable view. Auto-open cannot live on the document view itself, because `ConversationSession` renders only the selected view; `conversation.session.live` is always mounted and `DocumentObserver` calls `openView('document', callId)` only for `eventSource` appends after hydrate. Replace and prepend windows rebuild availability without switching the tab.

Every submit, live Markdown, and image read uses one contained resolver: `session.header.cwd` is required, `realpath` plus `isPathUnder` re-checks containment, and there is no process-cwd fallback. Logical paths are workspace-relative POSIX; `joinLogicalPath` may pop `..` while the result stays inside the workspace, and `normalizeLogicalPath` still rejects a model path that contains `..`. Images are authorized by the call's recorded `imageRef` list, sniffed against raster magic bytes, capped at 8192 pixels on PNG/JPEG/GIF, and served with `X-Content-Type-Options: nosniff`. SVG is never listed or served. A live file that later escapes still refuses the live bytes; Markdown then falls back to the submit-time snapshot when `content` is present.

`maxBytes` (default 262144) bounds the complete serialized `presentationMeta` JSON. An oversized body drops `content` then trailing images; the call fails if the stripped snapshot still exceeds the cap. An empty Markdown file fails.

## Alternatives considered

**A fourth `ui-layout` column.** Rejected: it would add a root child beside Chat and Details and fight the existing conversation view bar.

**Markdown only inside the tool card.** Rejected: the user needs a reopenable tab after hydrate, not a card that disappears into the transcript.

**A new `SessionEventMap` member.** Rejected: `tool/result` plus `presentationMeta` already is the commit point, and a new event would duplicate a standard tool success.

**`WebServer.register` for images.** Rejected: images must ride the authenticated Connection Fetch channel, not a bare HTTP route.

**An always-visible Report tab.** Rejected: a session that never called the tool must look like today's Chat/Trajectory header.

**Process-cwd fallback when `session.header.cwd` is missing.** Rejected: that is the `tool-fs` convenience path and would serve files the session did not authorize.

**Persisting `FsTarget.displayPath` or an absolute host path in meta.** Rejected: display spellings are not an authorization basis, and a stored real path would skip the post-submit containment re-check.

## Consequences

The model sees `present_document` only when a preset mounts the tool. Success confirms title, logical path, byte length, and `snapshotId`; it never returns the file body. A nested PTC/`run_code` dispatch is rejected; only a top-level `tool/result` writes `presentationMeta` and opens the Report tab. Users reopen the snapshot or a live workspace read from the Report tab and from the tool card.

`snapshotId` is an implementation handle that leaks into the model-visible schema because the value is JSON-cloned before `presentationMeta` runs. Treat it as opaque; it is not a durable document identity.

WebP is magic-sniffed and byte-capped; it has no pixel-edge parse. A restored session shows the Report tab when history contains a successful present, but does not steal focus from Chat. There is no recorded Web snapshot of the Report tab in this change; GUI and unit tests are the keyless proof, and a keyful `DSH_SNAPSHOT=record` pass remains a named coverage gap.

Related: [Client-derived tool presentation](../architecture/2026-08-23-client-derived-tool-presentation.md) owns `presentationMeta` as durable result facts, which this feature uses for the Markdown snapshot.
