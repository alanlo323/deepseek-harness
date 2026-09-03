---
description: "Headless Chromium Browser Session provider: Playwright/CDP in a child process with JPEG screencast."
kind: "package-reference"
---

# `@deepseek-ai/dsh-browser-playwright`

English | [中文](README.zh.md)

## Summary

This provider launches headless Chromium in a child process, runs Playwright scripts against one shared page, and emits JPEG screencast frames. Isolation of the child is not a security boundary.

## Table of Contents

- [Use this package](#use-this-package)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)
- [Dev Note](#dev-note)

-----

<a id="use-this-package"></a>
## Use this package

Mount after `dsh-browser`. Every operational cap is a Config field. A result over `maxResultBytes` fails rather than truncate. The generated [configuration catalog](../../../docs/config-catalog.md#deepseek-aidsh-browser-playwright) lists every accepted field.

No runtime invariant companion is published; child occupancy is owned by this provider.

<a id="model-experience"></a>
## Model Experience

Indirectly, through dsh-tool-browser.

#### KV Cache effect

None; this package neither assembles nor sends a provider request.

## Known Limitations and Deferred Work
<a id="known-limitations-and-deferred-work"></a>

- **Isolation is not a security boundary** — the child exists so Playwright objects stay off the Host thread, not to sandbox the model.
- **Chromium must already be installed** — launch failure is loud; the tools stay registered.

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

The unbuilt engine child (`worker.ts`) loads under Node strip-only TypeScript, not tsx. Constructor parameter properties in that import graph crash `browser_open` with `BROWSER_ENGINE_EXIT`. See [the strip-only child note](../../../.agents/notes/implemented/bug-fix/2026-09-03-browser-engine-strip-only-source.md).

</details>
