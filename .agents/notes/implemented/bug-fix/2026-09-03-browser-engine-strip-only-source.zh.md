# Agent Note: 浏览器引擎子进程在 strip-only TypeScript 下运行

Status: implemented

[English](2026-09-03-browser-engine-strip-only-source.md) | 中文

## 问题

源码启动（`node --import tsx/esm`）时 `browser_open` 报 `BROWSER_ENGINE_EXIT`。Host 使用 tsx，但 Playwright 引擎子进程用 `sourceWorkerExecArgv()` fork `worker.ts`，并不继承该 loader。Node 24 的 strip-only TypeScript 随后拒绝 `SessionEngine` 的 constructor parameter properties（`ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX`），子进程在任何 open RPC 之前就退出。

## 决策

`SessionEngine` 使用显式类字段，与 [code-runtime worker bootstrap](../../../../packages/code-runtime/code-runtime-worker-thread/src/bootstrap.ts) 一致。未构建的 worker 图在 strip-only TypeScript 下保持可擦除。spawn 测试在 `sourceWorkerExecArgv(false)` 下保持源码 worker 存活，因此之后的不可擦除语法会在 CI 失败，而不是变成 `BROWSER_ENGINE_EXIT`。

这不改变 Host 的 [通过 tsx 的源码启动](../architecture/2026-07-29-dsh-source-launch-tsx-esm.zh.md)。子进程仍是 strip-only 进程，因此不继承 tsx。

## 备选方案

**把 `--import tsx/esm` 传入引擎子进程。** 否决：`sourceWorkerExecArgv` 的存在就是为了丢掉 Host loader；继承 tsx 会让子进程变成第二条 Host 转换路径。

**把整个源码图改成可擦除 TypeScript。** 否决：Host 已经否决过该方案。只有引擎子进程的 import 图必须可擦除。

## 后果

在 `worker.ts` 或其值导入里加入 constructor parameter property、enum 或 namespace，会让源码启动的 `browser_open` 以 `BROWSER_ENGINE_EXIT` 崩溃。
