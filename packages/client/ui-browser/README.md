---
description: "Watch-only Web GUI Browser Session viewport column and enlarge overlay."
kind: "package-reference"
---

# `@deepseek-ai/dsh-client-ui-browser`

English | [中文](README.zh.md)

## Summary

This Client plugin occupies the session-scoped `browser` slot with a watch-only JPEG viewport and an enlarge overlay. Dismissing the panel does not close the Browser Session.

## Table of Contents

- [Use this package](#use-this-package)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)
- [Dev Note](#dev-note)

-----

<a id="use-this-package"></a>
## Use this package

Mount on the Web Client roster after `ui-layout`. Auto-open of the layout panel happens on the non-open → open projection edge. No runtime invariant companion is published; the preview is viewing state.

<a id="model-experience"></a>
## Model Experience

None, as the watch-only viewport never reaches a model request.

#### KV Cache effect

None; this package neither assembles nor sends a provider request.

## Known Limitations and Deferred Work
<a id="known-limitations-and-deferred-work"></a>

- **Dismiss is not `browser_close`** — the last frame may remain after the panel hides.
- **Below 1380px the preview is a strip overlay** — it does not steal the details column.

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

None.

</details>
