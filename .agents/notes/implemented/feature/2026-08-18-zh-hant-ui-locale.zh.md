# Agent Note: 产品 UI 以 locale `zh-Hant` 出货繁体中文

Status: implemented

[English](2026-08-18-zh-hant-ui-locale.md) | 中文

## Problem

浏览器客户端只出货简体中文 `zh` 与英文 `en`。`detectBrowserLocale()` 按主子标签匹配，因此 `zh-TW`、`zh-HK` 与 `zh-Hant*` 全部解析成 `zh`。繁体中文读者第一次打开产品就会落到简体界面，语言行也没有在保留简体选项的同时选出繁体的入口。Diff、Read、Search 与 Web 工具卡还把 chrome 写死为简体，即使之后切换 locale，这些卡片仍是简体。

## Decision

**浏览器客户端出货三个 LocaleId：`zh`、`en` 与 `zh-Hant`。** 语言行标签为简体中文／繁體中文／English。`FALLBACK_LOCALE` 仍是 `en`，由[由浏览器派生的初始 locale](2026-07-31-browser-derived-initial-locale.md)决策拥有。显式 Host `locale.preference` 仍会实时替换暂定值，且探测结果从不写回 settings。

**探测遍历 `navigator.languages` 再加 `navigator.language`；先到先赢。** 英文仍按主子标签匹配（`en-GB` → `en`）。中文先看 script 再看 region：含 `hans` → `zh`（包括 `zh-Hans-TW`）；否则含 `hant` 或 region 为 `tw`／`hk` → `zh-Hant`；其余 `zh*`（裸 `zh`、`zh-CN`、未点名的 `zh-MO`）→ `zh`。未出货语言如 `fr` 仍匹配不到，交由 `FALLBACK_LOCALE` 接管。判定浏览器用的仍是 `window`。

**每个类型化 `register` 调用都为每个已出货 LocaleId 提供完整词典。** `zh` 仍是 key-set 真源。非类型化 namespace（`permission.access`、`directory-browser`）在同一 effect 里注册对应的 `zh-Hant` 词典。类型化路径上缺键是编译错误。

**Diff、Read、Search 与 Web primitive 接受可选 `labels`，默认仍是简体中文。** 这条 DEFAULT 为简体的约定与 TerminalBlock 相同：ui-primitives 保持不依赖 cordis。对话与 ui-tool 在聊天行和详情面板两处都从 conversation locale seat 注入完整 labels，包括 SearchBlock 的完整 `summaryText`。copy／copied／collapse 字符串仍在 common namespace。

## Alternatives considered

**对 `zh` 词典做运行时 OpenCC 或字形转换。** 否决：简体必须仍是可选 locale，产品用词的转换质量不受控，语言行也无法再命名两个中文 locale。

**LocaleId 维持 `zh | en`，只通过非类型化 `register(ns, locale, dict)` 注册 `zh-Hant`。** 否决：`LOCALES`、`setLocale` 与 Host settings schema 只接受已出货 LocaleId；非类型化第三本词典不会出现在语言行，也不能作为 `preference` 持久化。

**分批出货 `zh-Hant` 词典，缺键回落到简体。** 否决：查找链已经回落到 `en`，用户选了繁体后仍混用另一种语言，会破坏类型化 `Record<LocaleId, dict>` 注册所要强制的完备性。

## Consequences

此后每个新 UI namespace 都要交三本完整词典，而不是两本。来自 `zh-TW`／`zh-HK`／`zh-Hant*` 浏览器的首访落在繁体中文；`zh-Hans-TW` 仍落在简体。语言行原先标注为「中文」的选项现为「简体中文」。文档配对（`.zh.md`）与 VitePress `root` locale 仍是简体／英文——产品 UI locale 与文档 locale 彼此独立。IN／OUT 槽位、JsonTree 的默认英文文案，以及注册时捕获的命令描述，仍不在此 locale 集合内。

## Testing

`packages/client/locale` 用例钉住 script-then-region 探测、语言行三个选项、Host schema 接受 `zh-Hant`，以及 `zh-Hant` 词典席位占用。primitive 用例保持 DEFAULT 为简体，并断言注入的 labels。ui-tool 卡片用例在 `zh-Hant` 下断言 Diff／Read／Search／Web 的繁体 chrome。`apps/web/tests/settings-chrome.e2e.ts` 断言更名后的「简体中文」选项，以及无 preference 时 Playwright `locale: 'zh-TW'` 页面打开为「繁體中文」。
