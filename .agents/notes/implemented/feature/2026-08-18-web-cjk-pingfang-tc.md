# Agent Note: Web UI CJK uses PingFang TC

Status: implemented

English | [中文](2026-08-18-web-cjk-pingfang-tc.zh.md)

## Problem

The browser client's UI and code stacks named PingFang SC, Hiragino Sans GB, and Microsoft YaHei. Windows CJK therefore rendered in a Simplified gothic. macOS `-apple-system` already covers CJK using the OS language, so a later PingFang TC family in the same list never ran for Chinese characters on English or Simplified systems. Putting the PingFang TC family first would also take Latin off San Francisco / Segoe UI, which the Chat-aligned UI weights assume.

## Decision

**CJK code points use a family `DshCjk` that precedes `-apple-system`.** `packages/client/ui-theme/src/styles/base.css` declares `@font-face` rules with `unicode-range`. Local PingFang TC (蘋方-繁) wins when installed; the Noto Sans TC Traditional webfont and remaining fallbacks are owned by [Noto Sans TC webfont](2026-08-18-web-cjk-noto-sans-tc-webfont.md). `--dsw-font-family` and `--ds-font-family-code` both start with `'DshCjk'`. Latin stays on the system UI stack or the mono stack. PingFang is not bundled. The code stack still omits a bare `monospace` tail and ends with generic sans so CJK can fall through if every `DshCjk` source misses. `.toolCallNameTypeface` in [ui-trajectory](../../../../packages/client/ui-trajectory/README.md) keeps its Menlo-first Latin prefix and tails with `'DshCjk', sans-serif`. This is a product-wide glyph choice, not a `zh-Hant` locale branch; see [zh-Hant locale](2026-08-18-zh-hant-ui-locale.md). The [styling RFC](../process/2026-07-19-web-styling-system.md) framework is unchanged; token values stay in `ui-theme` source.

## Alternatives considered

**Rename SC families to TC in the existing list and leave `-apple-system` first.** Rejected because macOS CJK would still come from system-ui's OS-language PingFang and never reach PingFang TC.

**Put `'PingFang TC'` first as a full family.** Rejected because PingFang TC includes Latin glyphs and would displace San Francisco, which `design-platform.css` treats as the weight baseline.

**Set `html lang="zh-Hant"` and keep system-ui first.** Rejected because the product does not set document language, English UI still contains Traditional Chinese copy, and `-apple-system` follows the OS language, not the document language.

**Ship Noto Sans TC as a webfont.** Rejected in the local-only first cut; the webfont now ships per [Noto Sans TC webfont](2026-08-18-web-cjk-noto-sans-tc-webfont.md).

## Consequences

macOS with PingFang TC renders Traditional Chinese from 蘋方-繁 even when the OS language is English. Hosts without PingFang load Noto Sans TC as described in [Noto Sans TC webfont](2026-08-18-web-cjk-noto-sans-tc-webfont.md). Italic CJK has no dedicated face and may synthesize or fall through to `-apple-system`. Code points outside `DshCjk`'s `unicode-range` follow the rest of the stack.

## Testing

`packages/client/ui-theme/tests/font-stacks.client.spec.ts` asserts both token stacks start with `'DshCjk'`, the code stack has no bare `monospace` tail, `DshCjk` faces keep `U+4E00-9FFF` in `unicode-range`, package source CSS names none of the retired Simplified families, and `.toolCallNameTypeface` keeps the Menlo-first prefix. Webfont `src` order is owned by [Noto Sans TC webfont](2026-08-18-web-cjk-noto-sans-tc-webfont.md). Web aria goldens do not pin `font-family` and are not a font regression surface.
