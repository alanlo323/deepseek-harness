# Agent Note: Browser engine child under strip-only TypeScript

Status: implemented

English | [中文](2026-09-03-browser-engine-strip-only-source.zh.md)

## Problem

`browser_open` reported `BROWSER_ENGINE_EXIT` on source launch (`node --import tsx/esm`). The Host uses tsx, but the Playwright engine child forks `worker.ts` with `sourceWorkerExecArgv()` and does not inherit that loader. Node 24 strip-only TypeScript then rejected `SessionEngine`'s constructor parameter properties (`ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX`), so the child exited before any open RPC.

## Decision

`SessionEngine` uses explicit class fields, matching the [code-runtime worker bootstrap](../../../../packages/code-runtime/code-runtime-worker-thread/src/bootstrap.ts). The unbuilt worker graph stays erasable under strip-only TypeScript. A spawn test keeps the source worker alive under `sourceWorkerExecArgv(false)` so a later non-erasable construct fails in CI instead of as `BROWSER_ENGINE_EXIT`.

This does not change [source launch through tsx](../architecture/2026-07-29-dsh-source-launch-tsx-esm.md) for the Host. The child remains a strip-only process so it does not inherit tsx.

## Alternatives considered

**Pass `--import tsx/esm` into the engine child.** Rejected: `sourceWorkerExecArgv` exists to drop the host loader; inheriting tsx would make the child a second copy of the Host transform path.

**Rewrite the whole source graph to erasable TypeScript.** Rejected: that is the alternative already declined for the Host. Only the engine-child import graph has to be erasable.

## Consequences

Adding a constructor parameter property, enum, or namespace to `worker.ts` or a value import of it crashes source-launch `browser_open` with `BROWSER_ENGINE_EXIT`.
