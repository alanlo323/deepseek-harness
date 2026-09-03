# Agent Note: Browser Session viewport sidebar

Status: implemented

English | [中文](2026-09-03-browser-viewport-sidebar.zh.md)

## Problem

A Web-profile agent can drive a first-party headless Chromium session, but the human has no in-app picture of that page. An OS Chrome window would leak a second UI. Putting JPEG frames in `tool/result` or a new `SessionEventMap` member would send unbounded base64 to the model and the durable log. Reusing the Details column or a conversation view would fight existing occupants.

## Decision

DeepSeek Harness launches headless Chromium itself. The Web GUI shows the page only in a session-scoped `browser` slot: a fourth grid track at `BROWSER_FOUR_COLUMN_MIN` (1380px) and a strip overlay below that floor. Preview frames travel on a watch-only Remote stream as JSON JPEG items with a ring of one. They never enter a model request and never enter the session log. `browser_open` / `browser_run` / `browser_close` results stay ordinary `tool/call` plus `tool/result` with `meta.kind: 'browser-session'`. There is no new session event and no `SESSION_FORMAT_VERSION` bump.

Auto-open of the layout panel happens on the non-open → open projection edge (and when the occupant mounts onto an already-open snapshot). Dismissing the panel is not `browser_close`. Host preview paths never send CDP `Input.*`. Isolation of the Playwright child is not a security boundary. v1 is Web-profile only: one process-wide Browser Session, generic tool cards, and no mount on headless, ACP, or shipped agent presets. `web_search` and `web_fetch` do not open this session.

The Report tab's rejected fourth column ([submitted-document view](2026-08-28-submitted-document-view.md)) still stands: that product is a conversation view. This column is a watch-only Chromium preview beside Chat and Details.

## Alternatives considered

**MCP Playwright or an OS Chrome window.** Rejected: the product owns launch and the sidebar is the only human picture.

**JPEG frames on `tool/result` or a new session event.** Rejected: frames are human-only and unbounded; the log stays replayable without them.

**Details column or `openDetails()`.** Rejected: Details already hosts tool detail; a sibling `browser` slot keeps both visible.

**Raw binary mux items.** Rejected: the Remote mux stays JSON-only.

**Mounting on base / headless / agent presets.** Rejected: Python SDK and headless compositions must not pull Playwright.

## Consequences

Web compositions register the three tool names on the host-plane tools registry, so every Web agent including `minimal` inherits them; headless and ACP do not. A second `browser_open` fails until `close`. `maxResultBytes` overflow fails rather than truncate. Launch failure is loud while the tools stay listed. Session files replay tool results without JPEG magic. Users can hide the panel and still keep the last frame in memory. CENTER_MIN stays 640 until the four-column solver's last fallback.

Related: [submitted-document Report view](2026-08-28-submitted-document-view.md) owns why a conversation Report tab is not a layout column.
