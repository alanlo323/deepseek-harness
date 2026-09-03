---
description: "Headless Browser Session seam (ctx.browser): one live Chromium session, script execution, and human-only screencast frames."
kind: "package-reference"
---

# `@deepseek-ai/dsh-browser`

English | [中文](README.zh.md)

## Summary

`ctx.browser` owns at most one live headless Chromium Browser Session: `open`, `run`, `close`, and an in-memory JPEG screencast subscription. Screencast frames never enter the session log or a model request.

## Table of Contents

- [Use this package](#use-this-package)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)
- [Dev Note](#dev-note)

-----

<a id="use-this-package"></a>
## Use this package

Mount this Service Definition, a provider such as `dsh-browser-playwright`, and `dsh-tool-browser` on the Web host plane. A second `open` fails until `close`. Isolation of the engine child is not a security boundary.

No runtime invariant companion is published; the live session occupancy is owned by this service and is not independently observable.

<a id="model-experience"></a>
## Model Experience

Indirectly, through dsh-tool-browser.

#### KV Cache effect

None; this package neither assembles nor sends a provider request.

## Known Limitations and Deferred Work
<a id="known-limitations-and-deferred-work"></a>

- **v1 is one process-wide Browser Session** — a second `open` fails until `close`.
- **Engine-process isolation is not a security boundary** — treat `browser_run` scripts with the same trust as other model-directed execution.

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

None.

</details>
