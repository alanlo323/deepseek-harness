---
description: "Host projection and JPEG screencast Remote for the Web Browser Session preview."
kind: "package-reference"
---

# `@deepseek-ai/dsh-browser-host`

English | [中文](README.zh.md)

## Summary

This Host Consumer folds `browser-session` tool `meta` into a session projection and streams JPEG screencast frames over the existing Remote mux as JSON items. Frames never enter the session log.

## Table of Contents

- [Use this package](#use-this-package)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)
- [Dev Note](#dev-note)

-----

<a id="use-this-package"></a>
## Use this package

Mount on the Web host plane beside `dsh-browser`. The `screencast` Remote is watch-only: it never sends CDP Input commands. No runtime invariant companion is published; projection occupancy is owned by this service.

<a id="model-experience"></a>
## Model Experience

None, as the Host projection and screencast Remote never reach a model request.

#### KV Cache effect

None; this package neither assembles nor sends a provider request.

## Known Limitations and Deferred Work
<a id="known-limitations-and-deferred-work"></a>

- **Frames are JSON base64 on the shared mux** — a slow consumer drops older frames (ring of one).
- **Watch-only** — there is no Remote for user clicks or typing.

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

None.

</details>
