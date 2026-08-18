# Agent Note: Web UI CJK ships Noto Sans TC as a webfont fallback

Status: implemented

[English](2026-08-18-web-cjk-noto-sans-tc-webfont.md) | 中文

## Problem

`DshCjk` 当时只用 `local()` 源。PingFang TC 仅苹果提供且无权嵌入，因此没有拷贝蘋方的 Windows 会落到微软正黑体，两者都没有的主机则走泛型 sans。繁体 UI 黑体取决于操作系统碰巧安装了哪一套。

## Decision

**每个 `DshCjk` face 先试本机 PingFang TC / Heiti TC，再加载 `@fontsource/noto-sans-tc` 的 OFL Noto Sans TC 繁体子集 woff2，最后才是微软正黑体。** woff2 写在同一条 `src` 里，命中蘋方时不会去拉 Noto。字重 400/500/600/700 各自对应 `noto-sans-tc-chinese-traditional-*-normal.woff2`。`font-display` 为 `swap`。仍不打包 PingFang 二进制。[PingFang TC CJK](2026-08-18-web-cjk-pingfang-tc.md) 的 unicode-range 家族、栈顺序与避免 SimSun 的约定仍然有效。

## Alternatives considered

**维持仅 `local()`，Windows 接受正黑体。** 否决，因为产品现在要求在没有蘋方时仍有稳定的繁体黑体。

**嵌入 PingFang TC woff2。** 否决：没有网页嵌入授权。

**把 `'Noto Sans TC'` 当作 `font-family` 的第二个家族，而不是写进 `DshCjk` 的 `url()`。** 否决，因为被引用的家族即使前面的本机 face 已覆盖该字形，仍可能被下载。

**把 Fontsource 的每一段 unicode-range CSS 都 import 成 `Noto Sans TC`。** 否决：繁体子集已按字重提供单一 woff2（`chinese-traditional-*.css`），第二个家族仍会预取。

## Consequences

Windows 与 Linux 每个实际用到的字重大约下载 1 MB woff2（正文 400，用到 500/600/700 再拉）。装有 PingFang TC 的 macOS 不会拉取 Noto。Linux CI 的 aria 金标仍不钉 `font-family`；若以后有像素快照，必须按 Noto 度量来预期。OFL 字型通过 ui-theme 依赖进入生成的第三方声明。该生成器的宽松 SPDX 集合包含 `OFL-1.1`，因此开源字型可作为 webfont 交付，而无需按包身份例外；见[生成的第三方声明](../process/2026-07-30-generated-third-party-notices.md)。web 的 Vite 配置把 `@deepseek-ai/dsh-client-ui-theme/styles/*` 别名到 `ui-theme/src/styles`，以便 `url('@fontsource/...')` 被改写成带哈希的 `assets/fonts/` 文件；包导出仍是给 Node 消费方用的 `lib/styles`。

## Testing

`packages/client/ui-theme/tests/font-stacks.client.spec.ts` 断言每个 `DshCjk` face 都是先 `local('PingFang TC')`，再 `url('@fontsource/noto-sans-tc/files/noto-sans-tc-chinese-traditional-<weight>-normal.woff2')`，再 `local('Microsoft JhengHei')`，且 `font-display: swap`，并且 `require.resolve` 能找到每个 woff2。`apps/web/tests/cjk-webfont.spec.ts` 断言对壳层 base 样式表做 Vite 构建时，会把这些 `url('@fontsource/...')` 改写成带哈希的 woff2 资源。
