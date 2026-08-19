# Agent Note: 未构建的 code-runtime worker 在 execArgv 中启用类型剥离

Status: implemented

[English](2026-08-18-code-runtime-source-worker-strip-execargv.md) | 中文

## 问题

源码 `dsh` 是 `node --import tsx/esm`。[`WorkerThreadCodeRuntime`](../../../../packages/code-runtime/code-runtime-worker-thread/src/index.ts) 以 `execArgv: []` spawn `src/worker.ts`，以免 worker 继承宿主 loader 标志，并假定 Node 原生类型剥离会加载该文件。该 worker 中并不存在原生 `.ts` 加载：空的 `execArgv` 会丢掉 tsx，且低于 22.18 的 Node（包括 22.15，此时 `process.features.typescript` 为 `false`）没有默认剥离。运行会以 `kind: 'worker-exit'` 失败，消息为 `Unknown file extension ".ts"`。当 Vitest 的模块钩子仍能到达 `Worker` 线程时，单元测试会掩盖此缺口。node-compat 的 source-worker 冒烟此前只覆盖 [`dsh-workflow-worker-thread`](../../../../packages/workflow/workflow-worker-thread/src/host.ts)。

## 决策

未构建 spawn 仍通过 Node 类型剥离加载 `src/worker.ts`，并保持 `env: {}`。[`sourceWorkerExecArgv`](../../../../packages/code-runtime/code-runtime-worker-thread/src/spawn.ts) 在 `process.features.typescript` 开启时为空。关闭时，worker 会获得 `--experimental-strip-types` 和 `--disable-warning=ExperimentalWarning`，从而在不继承宿主 `--import` 的情况下加载 `.ts`，也不会把实验性警告写进被捕获的 stderr 管道。构建后 spawn 仍把兄弟文件 `lib/worker.cjs` 作为文件系统字符串传入，且 `execArgv` 为空，以供 pkg 的 VFS hook 使用。

`fileURLToPath(import.meta.url)` 选择未构建或构建分支；它会丢掉 vitest 可能加在 `import.meta.url` 上的查询字符串。

## 考虑过的替代方案

**通过 data-URL 引导程序在 worker 内安装 tsx，与 workflow 一致。** 否决：tsx／esbuild 会注入调用 `Object`／`Array` 方法的运行时 helper。模型代码一旦改写这些全局对象，worker 的 JSON 与错误渲染就会崩溃（`program threw an unrenderable value`）。原生剥离会保留捕获 intrinsic 的 bootstrap。

**始终继承宿主 `execArgv`。** 否决：测试运行器和 tsx 钩子会进入 isolate。

**要求 Node 22.19+ 并保持空的 `execArgv`。** 否决：产品源码向量是 tsx，空的 `execArgv` 仍会丢掉该 loader。提高下限并不能让 `src/worker.ts` 在原生 TypeScript 关闭的宿主上通过 `pnpm dsh` 加载。

**eval 宿主侧剥离后的 worker JavaScript。** 否决：worker 入口会导入相对 `.ts` 模块；在 spawn 时打包等于为已经有 strip 标志答案的路径再做一遍 tsdown 的 `worker.cjs`。

## 后果

源码 `run_code` 可在 `pnpm dsh` 下加载，无需事先构建 `lib/worker.cjs`，也不会把 tsx 放进模型 isolate。环境保持为空。Node 24.12+ 已将剥离标为稳定，并把禁用标志重命名为 `--no-strip-types`；启用标志只在 `process.features.typescript` 关闭时作为回退，因此默认开启剥离的 Node 26 宿主仍使用空的 `execArgv`。

## 测试

[`tests/source-worker.compat.spec.ts`](../../../../packages/code-runtime/code-runtime-worker-thread/tests/source-worker.compat.spec.ts) 会把 worker 闭包复制出工作区，并通过 `sourceWorkerExecArgv` 启动，其中包括一个显式关闭分支，要求 isolate 的 `execArgv` 为那两个 strip 标志，同时用 `node --import tsx/esm` 运行 [`tests/source-worker-launch.ts`](../../../../packages/code-runtime/code-runtime-worker-thread/tests/source-worker-launch.ts)。launch fixture 与 [`tests/runtime.spec.ts`](../../../../packages/code-runtime/code-runtime-worker-thread/tests/runtime.spec.ts) 要求 isolate 的 `execArgv` 匹配 `sourceWorkerExecArgv()`。该 runtime 文件还要求凭据 canary 保持缺失，且 `process.env` 序列化为 `{}`。[`tests/spawn.spec.ts`](../../../../packages/code-runtime/code-runtime-worker-thread/tests/spawn.spec.ts) 固定 `sourceWorkerExecArgv` 的每一个分支，包括 `'transform'`。node-compat 的 `source-worker-smoke` 门禁包含此兼容文件。[`tests/built-lib.e2e.ts`](../../../../packages/code-runtime/code-runtime-worker-thread/tests/built-lib.e2e.ts) 仍在纯 Node 下加载 `lib/worker.cjs`。
