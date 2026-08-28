---
description: "Host projection, live Markdown Remote, and authenticated image Fetch for submitted documents, for users and maintainers choosing, composing, or debugging the Report host."
kind: "package-reference"
---

# @deepseek-ai/dsh-document-host

English | [中文](README.zh.md)

## Summary

`dsh-document-host` lets the Web GUI list successful `present_document` calls, re-read the Markdown from the session workspace, and serve workspace images named by that document. Mount it on the Web host next to sessions, projections, and Connection. A missing session `cwd` fails closed; there is no process-cwd fallback. Each live or image read re-checks containment.

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

The shipped Web bundle already mounts this service. A custom host needs sessions, the projection registry, and Connection:

```yaml
- id: document-host
  name: '@deepseek-ai/dsh-document-host'
```

`submittedDocument.read` returns live Markdown when the workspace file is still readable, otherwise the submit-time snapshot. Images are served at `/api/submitted-document-image` after Connection authenticates the request.

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

<details>
<summary>Implementation internals — click to expand</summary>

The `submittedDocuments` projection records successful presents only. The image route requires the `imageRef` to appear on that record, sniffs raster magic bytes, and rejects a pixel edge above 8192 for PNG, JPEG, and GIF. `fetch.register` runs on `ctx.connection` so the route is owned by this plugin fiber.

</details>

-----

<a id="further-exploration"></a>
## Further Exploration

- [Submitted-document subsystem](../../../docs/subsystems/document.md) — Remote and projection types.
- [dsh-client-ui-document](../../client/ui-document/README.md) — the browser Report view.
- [Submitted-document Agent Note](../../../.agents/notes/implemented/feature/2026-08-28-submitted-document-view.md) — why live reads re-check containment.

-----

<a id="model-experience"></a>
## Model Experience

None, as this host projection and Remote serve already-submitted documents; dsh-tool-present-document owns every model-facing contract.

#### KV Cache effect

None; the package never assembles or sends provider requests.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>


These limits define when a live read or image Fetch fails. They are current package constraints, not a task backlog.

- **Fail-closed without `cwd`** — a session header without a workspace root cannot live-read or serve images; snapshot Markdown is used only when the submit-time `content` is present.
- **Re-check every read** — a post-submit symlink swap cannot reuse a prior real path.
- **WebP size is magic-only** — WebP is served when the RIFF/WEBP signature matches; pixel-edge rejection applies to PNG, JPEG, and GIF.

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

None.

</details>
