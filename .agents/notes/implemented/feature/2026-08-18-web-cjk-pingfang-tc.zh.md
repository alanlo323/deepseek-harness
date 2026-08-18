# Agent Note: Web UI 的 CJK 使用 PingFang TC

Status: implemented

[English](2026-08-18-web-cjk-pingfang-tc.md) | 中文

## Problem

浏览器客户端的 UI 与代码字族清单写的是 PingFang SC、Hiragino Sans GB 和 Microsoft YaHei。因此 Windows 上的 CJK 会落到简体黑体。macOS 的 `-apple-system` 已按操作系统语言覆盖 CJK，所以同一清单里后出现的 PingFang TC 家族在英文或简体系统上永远轮不到汉字。若把 PingFang TC 整族放到第一位，拉丁文也会离开 San Francisco / Segoe UI，而 Chat 对齐的 UI 字重是按前者设定的。

## Decision

**CJK 码位使用排在 `-apple-system` 之前的家族 `DshCjk`。** `packages/client/ui-theme/src/styles/base.css` 用带 `unicode-range` 的 `@font-face` 声明。已安装时本机 PingFang TC（蘋方-繁）优先；Noto Sans TC 繁体 webfont 与其余后备用 [Noto Sans TC webfont](2026-08-18-web-cjk-noto-sans-tc-webfont.md) 拥有。`--dsw-font-family` 与 `--ds-font-family-code` 都以 `'DshCjk'` 开头。拉丁文仍走系统 UI 栈或等宽栈。不打包 PingFang。代码栈仍不加裸 `monospace` 尾巴，并以泛型 sans 结尾，以便 `DshCjk` 每个源都未命中时 CJK 仍能回落。[ui-trajectory](../../../../packages/client/ui-trajectory/README.md) 的 `.toolCallNameTypeface` 保留 Menlo 优先的拉丁前缀，尾巴为 `'DshCjk', sans-serif`。这是产品级字形选择，不是 `zh-Hant` locale 分支；见 [zh-Hant locale](2026-08-18-zh-hant-ui-locale.md)。[样式 RFC](../process/2026-07-19-web-styling-system.md) 的框架不变；token 值仍以 `ui-theme` 源码为准。

## Alternatives considered

**在现有清单里把简体家族改名为繁体，并让 `-apple-system` 仍排第一。** 否决，因为 macOS 的 CJK 仍来自 system-ui 按操作系统语言选择的 PingFang，永远轮不到 PingFang TC。

**把 `'PingFang TC'` 作为完整家族放到第一。** 否决，因为 PingFang TC 含拉丁字形，会挤掉 San Francisco，而 `design-platform.css` 把后者当作字重基线。

**设置 `html lang="zh-Hant"` 并让 system-ui 仍排第一。** 否决，因为产品并不设置文档语言，英文 UI 仍含繁体中文文案，且 `-apple-system` 跟随操作系统语言而非文档语言。

**以 webfont 提供 Noto Sans TC。** 仅本机的第一刀否决了它；webfont 现由 [Noto Sans TC webfont](2026-08-18-web-cjk-noto-sans-tc-webfont.md) 出货。

## Consequences

装有 PingFang TC 的 macOS 即使操作系统语言是英文，繁体中文也会走蘋方-繁。没有 PingFang 的主机按 [Noto Sans TC webfont](2026-08-18-web-cjk-noto-sans-tc-webfont.md) 加载 Noto Sans TC。斜体 CJK 没有专用 face，可能被合成，或落到 `-apple-system`。`DshCjk` 的 `unicode-range` 之外的码位走清单其余家族。

## Testing

`packages/client/ui-theme/tests/font-stacks.client.spec.ts` 断言两个 token 栈都以 `'DshCjk'` 开头、代码栈没有裸 `monospace` 尾巴、`DshCjk` face 的 `unicode-range` 含 `U+4E00-9FFF`、package 源 CSS 不再出现已退役的简体家族名，以及 `.toolCallNameTypeface` 仍保留 Menlo 优先前缀。webfont 的 `src` 顺序由 [Noto Sans TC webfont](2026-08-18-web-cjk-noto-sans-tc-webfont.md) 拥有。Web aria 金标不钉 `font-family`，也不是字体回归面。
