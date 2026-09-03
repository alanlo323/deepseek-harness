---
description: "Package map for the headless Chromium Browser Session family: seam, Playwright provider, model-facing tools, Host Remote, and Web viewport."
kind: "package-group"
---

# packages/browser

English | [中文](README.zh.md)

## Summary

The `browser/` group gives the Web GUI a watch-only live Chromium viewport while the agent drives one headless Browser Session through `browser_open`, `browser_run`, and `browser_close`. Screencast JPEG frames stay on a Remote stream and never enter the session log or a model request. The group is Web-profile only: headless, ACP, and shipped agent presets do not mount it.

## Table of Contents

- [Packages](#packages)
- [Related documentation](#related-documentation)
- [Dev Note](#dev-note)

-----

<a id="packages"></a>
## Packages

Five packages split the family; the subsystem reference owns the exhaustive types.

| Package | Role | ctx key |
|---|---|---|
| [`browser/`](browser/README.md) | Browser Session service: at most one live Chromium session, script execution, in-memory screencast | `ctx.browser` |
| [`browser-playwright/`](browser-playwright/README.md) | Headless Chromium backend in a child process with CDP JPEG screencast | registers on `ctx.browser` |
| [`tool-browser/`](tool-browser/README.md) | Exposes `browser_open`, `browser_run`, and `browser_close` to the model | registers on `ctx.tools` |
| [`browser-host/`](browser-host/README.md) | Host projection and watch-only screencast Remote | `ctx.browserHost` |
| [`../client/ui-browser/`](../client/ui-browser/README.md) | Watch-only Web viewport column and enlarge overlay | occupies `browser` |

-----

<a id="related-documentation"></a>
## Related documentation

- [Browser subsystem](../../docs/subsystems/browser.md) — session meta, screencast frames, Host Remote request, and Cordis API.
- [Browser viewport Agent Note](../../.agents/notes/implemented/feature/2026-09-03-browser-viewport-sidebar.md) — why frames stay off the log and why the column is not the Report tab.

-----

<a id="dev-note"></a>
## Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

None.

</details>
