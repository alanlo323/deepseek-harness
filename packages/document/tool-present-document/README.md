---
description: "The model-facing present_document tool: submit a workspace Markdown file so the Web Report view can open it, for users and maintainers choosing, composing, or debugging the tool."
kind: "package-reference"
---

# @deepseek-ai/dsh-tool-present-document

English | [中文](README.zh.md)

## Summary

`dsh-tool-present-document` lets the agent submit a finished workspace Markdown file so the user can open it in the Web Report view. A successful call confirms the title, logical path, and byte length; it does not return the file body. Mount it in a preset that writes a final report; the shipped Web host then remembers the call and the Report tab appears only after that success.

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

Mount the plugin on a composition that already has `ctx.tools`. The agent passes a workspace-relative `.md` or `.markdown` path, and may pass an optional title; when the title is omitted, the first ATX heading or the file stem is used.

```yaml
- id: tool-present-document
  name: '@deepseek-ai/dsh-tool-present-document'
```

| Field | Default | Meaning |
|---|---|---|
| `maxBytes` | `262144` | Maximum UTF-8 byte length of the complete serialized `presentationMeta` JSON |

The generated [configuration catalog](../../../docs/config-catalog.md#deepseek-aidsh-tool-present-document) is the exhaustive source for the accepted field.

### Failures

The call fails when there is no owning agent, the session header has no `cwd`, the path is not workspace-relative Markdown, the file is empty, the path escapes the workspace, the call is a nested PTC/`run_code` dispatch, or even a stripped snapshot still exceeds `maxBytes`. Success still records a snapshot: when the full body would exceed the cap, `content` (then trailing images) drop and `truncated` is true.

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

<details>
<summary>Implementation internals — click to expand</summary>

The execute value is cloned and frozen before `presentationMeta` runs, so the snapshot travels through a `snapshotId` side channel rather than a non-JSON property on the value. The tool appends no new session event type; success is a standard `tool/result` whose `meta.kind` is `submitted-document`.

</details>

-----

<a id="further-exploration"></a>
## Further Exploration

- [Submitted-document subsystem](../../../docs/subsystems/document.md) — snapshot and projection types.
- [document group map](../README.md) — sibling packages.
- [Generated tool catalog](../../../docs/tool-catalog.md#deepseek-aidsh-tool-present-document) — the schema the model receives.
- [Submitted-document Agent Note](../../../.agents/notes/implemented/feature/2026-08-28-submitted-document-view.md) — why the tool is the product.

-----

<a id="model-experience"></a>
## Model Experience

### Tool schema

#### What the model sees

The model sees the generated [`present_document` schema](../../../docs/tool-catalog.md#deepseek-aidsh-tool-present-document): required `path`, optional `title`, and a description that asks for one call after the report file is written.

#### Token effect

Fixed schema cost on every request where the tool is visible; the description and schema are stable for a given configuration.

#### KV Cache effect

Prefix-stable while the definition and visibility are unchanged.

### Tool-call history and result

#### What the model sees

Success returns `status`, `title`, `logicalPath`, `byteLength`, and an opaque `snapshotId`. The rendered confirmation is `Presented <logicalPath> (<byteLength> bytes) as "<title>".` The Markdown body is not in the tool result; it lives on UI-only `presentationMeta`.

#### Token effect

The result is small and fixed-shape. Token growth is the call arguments plus that confirmation.

#### KV Cache effect

Append-only; newly visible content follows the reusable request prefix and does not invalidate existing KV-cache entries.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>


These limits define when the tool is a poor fit. They are current package constraints, not a task backlog.

- **Confirmation only** — the model never receives the file body; the Report view reads `presentationMeta` or a live workspace file.
- **Top-level only** — a nested PTC/`run_code` dispatch is rejected; only a direct `tool/result` writes `presentationMeta` and opens the Report tab.
- **One workspace file** — the path must be workspace-relative Markdown inside `session.header.cwd`; there is no process-cwd fallback.
- **Snapshot cap** — `maxBytes` bounds the serialized snapshot; an oversized body is truncated from the snapshot or the call fails if the stripped snapshot still exceeds the cap.

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

None.

</details>
