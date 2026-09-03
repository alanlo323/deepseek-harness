---
description: "Model-facing browser_open, browser_run, and browser_close tools over ctx.browser."
kind: "package-reference"
---

# `@deepseek-ai/dsh-tool-browser`

English | [中文](README.zh.md)

## Summary

These three tools give a Web-profile agent one headless Chromium Browser Session: open it, run Playwright script bodies against the same page, and close it. Screencast frames never appear in tool results. Choose this package only on the Web host plane; headless, ACP, and shipped agent presets do not mount it. Isolation of the engine child is not a security boundary.

## Table of Contents

- [Use this package](#use-this-package)
- [Further Exploration](#further-exploration)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)
- [Dev Note](#dev-note)

-----

<a id="use-this-package"></a>
## Use this package

Mount after `dsh-browser` and a provider such as `dsh-browser-playwright`. A second `browser_open` fails until `browser_close`. `web_search` and `web_fetch` do not open this session. No runtime invariant companion is published; occupancy is owned by `ctx.browser`.

-----

<a id="further-exploration"></a>
## Further Exploration

- [Browser subsystem](../../../docs/subsystems/browser.md) — session meta, screencast frames, and the Host Remote request.
- [browser group map](../README.md) — the five-package family and each role.
- [Generated tool catalog](../../../docs/tool-catalog.md#deepseek-aidsh-tool-browser) — the three schemas the model receives.
- [Browser viewport Agent Note](../../../.agents/notes/implemented/feature/2026-09-03-browser-viewport-sidebar.md) — why frames stay off the log.

-----

<a id="model-experience"></a>
## Model Experience

### System prompt

#### What the model sees

The `tool:browser` section is the guidance below. It stays registered while this plugin is mounted, including when Chromium launch later fails.

##### Browser Session guidance

```markdown
Use browser_open, browser_run, and browser_close for one headless Chromium Browser Session. browser_open starts the session; a second open fails until browser_close. browser_run evaluates a Playwright script body with page, browser, context, and playwright in scope against that same page. Return JSON-serializable values only; oversized results fail rather than truncate. browser_close tears the session down. web_search and web_fetch do not open this session.
```

#### Token effect

Fixed guidance cost on every request where the plugin is mounted.

#### KV Cache effect

Prefix-stable while this section text and visibility are unchanged. Plugin lifecycle may invalidate reuse from this section.

### Tool schema

#### What the model sees

The model sees the generated [`browser_open`, `browser_run`, and `browser_close` schemas](../../../docs/tool-catalog.md#deepseek-aidsh-tool-browser). `browser_run` requires `script`. Success values include `browserSessionId` and `dshSessionId`; they do not include JPEG frames.

#### Token effect

Fixed schema cost on every request where the tools are visible.

#### KV Cache effect

Prefix-stable while the three definitions and their visibility are unchanged. Plugin lifecycle or scoped restrictions may invalidate reuse from this schema.

### Tool-call history and result

#### What the model sees

`browser_open` succeeds with `Browser Session <id> is open.` A second open fails with `a Browser Session is already open`. `browser_run` succeeds with `browser_run result: <json>` or fails when no session is open, the result is not JSON, or the JSON exceeds `maxResultBytes`. `browser_close` succeeds with `Browser Session <id> is closed.` Calls without an owning agent session fail with `browser tools require an owning agent session`. JPEG frames never appear in these results.

#### Token effect

Call arguments grow with each `script` body until compaction. Success results are short except for the JSON `browser_run` payload, which is capped by provider Config.

#### KV Cache effect

Append-only; newly visible tool history follows the reusable request prefix and does not invalidate existing KV-cache entries.

## Known Limitations and Deferred Work
<a id="known-limitations-and-deferred-work"></a>

- **v1 is one process-wide Browser Session** — a second `open` fails until `close`.
- **Engine-process isolation is not a security boundary** — treat `browser_run` scripts with the same trust as other model-directed execution.
- **Web profile only** — headless, ACP, and shipped agent presets do not mount these tools.

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

None.

</details>
