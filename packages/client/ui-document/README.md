---
description: "Web GUI Report conversation view for submitted Markdown documents, with a present_document tool card, for users and maintainers of the report experience."
kind: "package-reference"
---

# @deepseek-ai/dsh-client-ui-document

English | [中文](README.zh.md)

## Summary

This package adds a Report conversation tab and a `present_document` tool card to the Web GUI. The tab is listed only after at least one successful present in that session. The card opens the Report view for that call; a live observer also opens it when a successful present appends after hydrate. Snapshot Markdown comes from the tool result; live Markdown is a fresh workspace read through `submittedDocument.read`.

## Table of Contents

- [Use this package](#use-this-package)
- [Understand the implementation](#understand-the-implementation)
- [Further Exploration](#further-exploration)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)
- [Dev Note](#dev-note)

-----

<a id="use-this-package"></a>
## Use this package

The shipped Web bundle already mounts this plugin after `ui-trajectory`. It waits on `conversation.view`, `conversation.session.live`, and `remote.submittedDocument`. There is no configuration.

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

<details>
<summary>Implementation internals — click to expand</summary>

`availableDocuments` subscribes to `SessionBinding.eventSource` and stays false until a successful `submitted-document` result exists. `DocumentObserver` ignores replace and prepend windows so replay does not auto-open the tab. Workspace images rewrite only when the destination is on that document's `images` allowlist.

</details>

-----

<a id="further-exploration"></a>
## Further Exploration

- [dsh-document-host](../../document/document-host/README.md) — live read and image Fetch.
- [ui-conversation](../ui-conversation/README.md) — the view tab ring and live observer slot.
- [Submitted-document Agent Note](../../../.agents/notes/implemented/feature/2026-08-28-submitted-document-view.md) — why the tab stays hidden until a successful tool call.

-----

<a id="model-experience"></a>
## Model Experience

None, as this browser Report view and present_document card register nothing model-facing; the present_document tool owns every model-facing schema and result.

#### KV Cache effect

None; the package never assembles or sends provider requests.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>


These limits define the current Report surface. They are current package constraints, not a task backlog.

- **Hidden until success** — the Report tab is absent until a successful `present_document` exists in the session window.
- **No auto-open on replay** — only live appends after hydrate open the tab; a restored session shows the tab without switching to it.
- **Relative images only** — remote `http(s)` destinations stay with the Markdown renderer; workspace images that fail to load show the failed-image placeholder.

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

None.

</details>
