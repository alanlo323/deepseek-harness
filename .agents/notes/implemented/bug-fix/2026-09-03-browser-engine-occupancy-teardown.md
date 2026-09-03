# Agent Note: Browser engine occupancy and teardown

Status: implemented

English | [中文](2026-09-03-browser-engine-occupancy-teardown.zh.md)

## Problem

A failed `browser_open`, a hung `browser_close`, or a timed-out `browser_run` could leave the process-wide Browser Session unusable: the Playwright child still occupied the provider while `ctx.browser` reported closed, stdin abort lines waited behind the in-flight open/run, leftover script JS kept the same page, and a dead child handle threw from `kill()`. The Host also crashed on a non-JSON stdout line, and a Client screencast subscribe that threw left an unhandled rejection.

## Decision

`PlaywrightBrowserProvider.open` kills and drops the child when the open RPC fails, so a later `open` may retry. `close` waits at most `closeTimeoutMs` (default 5000) for the close RPC, then always `kill()`s, swallowing a throw from a process that already exited. Unexpected child exit notifies `subscribeDropped` so `ctx.browser` clears occupancy. Stdout, frames, `dropped`, and the line buffer apply only to the live child; a replaced child's late lines do not fail or paint the new occupancy. `runChildMain` applies abort lines immediately to the in-flight command's `AbortSignal` and serializes only open/run/close. `SessionEngine.open` races both Chromium launch and page setup (`#createLive`) on abort, and closes a Chromium that launches after abort wins the race. After `maxWallMs` or caller abort it closes the old context and rebuilds a page before the next `run`. `BrowserRuntime.open` does not publish occupancy when the caller signal is already aborted; `close` keeps occupancy until provider teardown finishes, shares one in-flight close, and still clears occupancy when teardown throws. The runtime unsubscribes its drop callback when drop fires or when `open` rolls back a replayed drop. `parseProtocolLine` returns `undefined` for non-JSON. The viewport subscribe loop catches Remote/session errors and keeps the last frame. The viewport panel clears the enlarge overlay and latest frame when it unmounts.

This extends [the viewport sidebar decision](../feature/2026-09-03-browser-viewport-sidebar.md); it does not change the watch-only JPEG path or the Web-only mount.

## Alternatives considered

**Leave occupancy on RPC failure and tell the user to restart the Host.** Rejected: the Service Definition already says a failed `open` stays closed so retry works, and a wedged child is a product bug, not an operator step.

**Await leftover `AsyncFunction` work before the next `run`.** Rejected: a hanging `Promise` cannot be killed. Closing the old context and rebuilding a page isolates page state; leftover JS may continue until it settles or throws.

**Clear `ctx.browser` occupancy before `provider.close()`.** Rejected: a hung teardown then reports `BROWSER_SESSION_CLOSED` on close and `BROWSER_SESSION_OPEN` on open. Occupancy stays until teardown finishes, with `closeTimeoutMs` plus `kill()` as the bound.

## Consequences

A failed launch is retryable without restarting the Host. Abort interrupts in-flight launch/run. A timed-out script does not share a page with the next `run`. Close reaches quiescence or the kill deadline. A replaced child's stdout does not take down the new session. Drop callbacks do not accumulate across occupancies. Non-JSON child stdout does not take down the Host. The viewport empty state remains if the screencast Remote throws. Leaving a session dismisses the enlarge overlay.
