---
description: "The document group map: present_document, the host Report projection, and the Web Report view, for users and maintainers navigating the group."
kind: "package-group"
---

# packages/document

English | [中文](README.zh.md)

## Summary

The document group lets an agent submit a finished workspace Markdown file so the Web GUI can show it as a Report. The model calls `present_document` once; the host remembers successful calls and re-reads the file on demand; the browser opens a Report tab only after that success. Use this group when a research or writing agent should present a final Markdown report without pasting the body into the chat.

## Table of Contents

- [Packages](#packages)
- [Related documentation](#related-documentation)
- [Dev Note](#dev-note)

-----

<a id="packages"></a>
## Packages

| Package | Role | ctx key |
|---|---|---|
| [`document-core`](document-core/README.md) | Shared logical paths, containment reads, and presentation snapshots | — |
| [`tool-present-document`](tool-present-document/README.md) | Lets the agent submit a workspace Markdown file for the Report view | registers on `ctx.tools` |
| [`document-host`](document-host/README.md) | Host projection, live Markdown Remote, and authenticated image Fetch | `ctx.documentHost` |

The Web Report view and `present_document` tool card live in [`client/ui-document`](../client/ui-document/README.md).

-----

<a id="related-documentation"></a>
## Related documentation

- [Submitted-document subsystem](../../docs/subsystems/document.md) — snapshot, projection record, and live-read types.
- [Generated tool catalog](../../docs/tool-catalog.md#deepseek-aidsh-tool-present-document) — the `present_document` schema the model receives.
- [Submitted-document Agent Note](../../.agents/notes/implemented/feature/2026-08-28-submitted-document-view.md) — why the tool is the product and why the tab stays hidden until success.

-----

<a id="dev-note"></a>
## Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

None.

</details>
