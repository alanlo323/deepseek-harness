# Agent Note: Unbuilt code-runtime worker enables type stripping in execArgv

Status: implemented

English | [中文](2026-08-18-code-runtime-source-worker-strip-execargv.zh.md)

## Problem

Source `dsh` is `node --import tsx/esm`. [`WorkerThreadCodeRuntime`](../../../../packages/code-runtime/code-runtime-worker-thread/src/index.ts) spawned `src/worker.ts` with `execArgv: []` so the worker would not inherit host loader flags, and assumed Node native type stripping would load that file. Native `.ts` loading is not available in that worker: empty `execArgv` drops tsx, and Node below 22.18 (including 22.15, where `process.features.typescript` is `false`) has no default strip. The run fails as `kind: 'worker-exit'` with `Unknown file extension ".ts"`. Vitest can hide the gap when its module hooks still reach `Worker` threads. The node-compat source-worker smoke covered only [`dsh-workflow-worker-thread`](../../../../packages/workflow/workflow-worker-thread/src/host.ts).

## Decision

Unbuilt spawn still loads `src/worker.ts` through Node type stripping and keeps `env: {}`. [`sourceWorkerExecArgv`](../../../../packages/code-runtime/code-runtime-worker-thread/src/spawn.ts) is empty when `process.features.typescript` is on. When it is off, the worker gets `--experimental-strip-types` and `--disable-warning=ExperimentalWarning` so `.ts` loads without inheriting host `--import` and without experimental warnings on the captured stderr pipes. Built spawn still passes sibling `lib/worker.cjs` as a filesystem string with empty `execArgv` for pkg's VFS hook.

`fileURLToPath(import.meta.url)` selects the unbuilt versus built arm; it drops a query string vitest may suffix onto `import.meta.url`.

## Alternatives considered

**Install tsx inside the worker through a data-URL bootstrap, matching workflow.** Rejected: tsx/esbuild injects runtime helpers that call `Object`/`Array` methods. Model code that mutates those globals then crashes worker JSON and error rendering (`program threw an unrenderable value`). Native strip leaves the captured-intrinsic bootstrap intact.

**Always inherit the host `execArgv`.** Rejected: test-runner and tsx hooks would enter the isolate.

**Require Node 22.19+ and keep empty `execArgv`.** Rejected: the product source vector is tsx, and empty `execArgv` still drops that loader. Raising the floor does not make `src/worker.ts` load under `pnpm dsh` on a host with native TypeScript off.

**Eval host-stripped worker JavaScript.** Rejected: the worker entry imports relative `.ts` modules; spawn-time bundling duplicates tsdown's built `worker.cjs` for a path that already has a strip-flag answer.

## Consequences

Source `run_code` loads under `pnpm dsh` without a prior `lib/worker.cjs` and without putting tsx in the model isolate. The environment stays empty. Node 24.12+ made stripping stable and renamed the disable flag to `--no-strip-types`; the enable flag remains the fallback only when `process.features.typescript` is off, so a Node 26 host with default strip keeps empty `execArgv`.

## Testing

[`tests/source-worker.compat.spec.ts`](../../../../packages/code-runtime/code-runtime-worker-thread/tests/source-worker.compat.spec.ts) copies the worker closure out of the workspace and boots it through `sourceWorkerExecArgv`, including an explicit-off arm that requires the isolate `execArgv` to be the two strip flags, and runs [`tests/source-worker-launch.ts`](../../../../packages/code-runtime/code-runtime-worker-thread/tests/source-worker-launch.ts) with `node --import tsx/esm`. The launch fixture and [`tests/runtime.spec.ts`](../../../../packages/code-runtime/code-runtime-worker-thread/tests/runtime.spec.ts) require isolate `execArgv` to match `sourceWorkerExecArgv()`. That runtime file also requires a credential canary to stay absent and `process.env` to serialize as `{}`. [`tests/spawn.spec.ts`](../../../../packages/code-runtime/code-runtime-worker-thread/tests/spawn.spec.ts) pins every `sourceWorkerExecArgv` arm, including `'transform'`. The node-compat `source-worker-smoke` gate includes this compat file. [`tests/built-lib.e2e.ts`](../../../../packages/code-runtime/code-runtime-worker-thread/tests/built-lib.e2e.ts) still loads `lib/worker.cjs` under plain Node.
