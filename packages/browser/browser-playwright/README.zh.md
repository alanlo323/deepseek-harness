---
description: "无头 Chromium Browser Session 提供方：在子进程中运行 Playwright/CDP，并输出 JPEG 投屏。"
kind: "package-reference"
---

# `@deepseek-ai/dsh-browser-playwright`

[English](README.md) | 中文

## 概述

本提供方在子进程中启动无头 Chromium，对同一个共享 page 运行 Playwright 脚本，并发出 JPEG 投屏帧。子进程隔离不是安全边界。

## 目录

- [使用本包](#use-this-package)
- [模型体验](#model-experience)
- [已知限制与延期工作](#known-limitations-and-deferred-work)
- [开发备注](#dev-note)

-----

<a id="use-this-package"></a>
## 使用本包

在 `dsh-browser` 之后挂载。每个运营上限都是 Config 字段。超过 `maxResultBytes` 的结果会失败，而不是截断。生成的[配置目录](../../../docs/config-catalog.zh.md#deepseek-aidsh-browser-playwright)列出每个受支持字段。

不发布运行时 invariant 伴生包；子进程占用由本提供方持有。

<a id="model-experience"></a>
## 模型体验

间接地，通过 dsh-tool-browser。

#### KV Cache 影响

无；该包既不组装也不发送提供方请求。

## 已知限制与延期工作
<a id="known-limitations-and-deferred-work"></a>

- **隔离不是安全边界** — 子进程是为了让 Playwright 对象离开 Host 线程，而不是沙箱化模型。
- **必须已安装 Chromium** — 启动失败会大声报错；工具仍保持注册。

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者的工作上下文——点击展开</summary>

未构建的引擎子进程（`worker.ts`）在 Node 的 strip-only TypeScript 下加载，而不是 tsx。该 import 图里的 constructor parameter properties 会让 `browser_open` 以 `BROWSER_ENGINE_EXIT` 崩溃。见[strip-only 子进程笔记](../../../.agents/notes/implemented/bug-fix/2026-09-03-browser-engine-strip-only-source.zh.md)。

</details>
