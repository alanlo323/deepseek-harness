---
description: "Shared submitted-document types, workspace-relative paths, containment reads, and presentation snapshots for present_document and the Report host."
kind: "package-library"
---

# @deepseek-ai/dsh-document-core

English | [中文](README.zh.md)

## Summary

`dsh-document-core` is the shared library behind submitted Markdown reports: it normalizes workspace-relative paths, reads files only when they still resolve inside the session workspace, and builds the presentation snapshot `present_document` stores on a successful tool result. Import it from the present tool and the document host; a `cordis.yml` cannot load it. Absolute host paths never appear in the snapshot, and every later live or image read re-checks containment instead of reusing a prior real path.

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

Call `normalizeLogicalPath` for a model-supplied path, `readContainedUtf8` or `readContainedImage` for a workspace read, and `buildSubmittedDocumentMeta` to cap the serialized snapshot. `joinLogicalPath` may pop `..` segments while the result stays inside the workspace; `normalizeLogicalPath` still rejects a model path that contains `..`.

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

<details>
<summary>Implementation internals — click to expand</summary>

Containment uses `realpath` plus `isPathUnder` after a `stat` that requires a regular file. Image MIME types come from an allowlisted extension at extract time and from raster magic bytes at serve time. SVG is never listed or served.

</details>

-----

<a id="further-exploration"></a>
## Further Exploration

- [Submitted-document subsystem](../../../docs/subsystems/document.md) — the snapshot and projection types this library owns.
- [dsh-tool-present-document](../tool-present-document/README.md) — the model-facing consumer.
- [dsh-document-host](../document-host/README.md) — the host consumer of live and image reads.

-----

<a id="model-experience"></a>
## Model Experience

None, as this library owns path containment and snapshots; dsh-tool-present-document owns the model-facing schema and result.

#### KV Cache effect

None; the package never assembles or sends provider requests.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>


These limits define what a contained read will accept. They are current package constraints, not a task backlog.

- **Model paths reject `..`** — only `joinLogicalPath` may pop parent segments, and only while the joined result stays inside the workspace.
- **SVG is never served** — extract and sniff allow PNG, JPEG, GIF, and WebP only.
- **Inline image syntax only** — `extractWorkspaceImages` lists `![alt](src)` destinations; reference-style images are not added to the host allowlist.
- **WebP has no pixel-edge parse** — a WebP file is still byte-capped; PNG, JPEG, and GIF also honor the 8192 pixel-edge cap at serve time.

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

None.

</details>
