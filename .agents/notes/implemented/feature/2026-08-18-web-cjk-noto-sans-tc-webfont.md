# Agent Note: Web UI CJK ships Noto Sans TC as a webfont fallback

Status: implemented

English | [中文](2026-08-18-web-cjk-noto-sans-tc-webfont.zh.md)

## Problem

`DshCjk` used only `local()` sources. PingFang TC is Apple-only and is not licensed to embed, so Windows without a copied PingFang face rendered Microsoft JhengHei, and hosts with neither family used generic sans. That left Traditional Chinese UI dependent on which gothic the OS happened to ship.

## Decision

**Each `DshCjk` face tries local PingFang TC / Heiti TC, then the OFL Noto Sans TC Traditional subset woff2 from `@fontsource/noto-sans-tc`, then Microsoft JhengHei as a last resort.** The woff2 sits in the same `src` list as the `local()` names so a successful PingFang match does not fetch Noto. Weights 400/500/600/700 each map to that weight's `noto-sans-tc-chinese-traditional-*-normal.woff2`. `font-display` is `swap`. PingFang binaries are still not bundled. The unicode-range family, stack order, and SimSun-avoidance in [PingFang TC CJK](2026-08-18-web-cjk-pingfang-tc.md) stay in force.

## Alternatives considered

**Keep `local()`-only and accept JhengHei on Windows.** Rejected because the product now requires a consistent Traditional gothic when PingFang is absent.

**Embed PingFang TC woff2.** Rejected: no web embedding license.

**Put `'Noto Sans TC'` in `font-family` as a second family instead of a `url()` inside `DshCjk`.** Rejected because a referenced family can download even when an earlier local face already covered the glyph.

**Import every Fontsource unicode-range CSS chunk as `Noto Sans TC`.** Rejected: the Traditional subset already ships as one woff2 per weight (`chinese-traditional-*.css`), and a second family would still prefetch.

## Consequences

Windows and Linux download about 1 MB woff2 per used weight (400 for body, 500/600/700 when those weights paint). macOS with PingFang TC does not fetch Noto. Linux CI aria goldens still do not pin `font-family`; any future pixel snapshot must expect Noto metrics. The OFL face is disclosed through the generated third-party notices from the ui-theme dependency. `OFL-1.1` is on that generator's permissive SPDX set so an open face can ship as a webfont without a per-package identity exception; see [generated third-party notices](../process/2026-07-30-generated-third-party-notices.md). The web Vite config aliases `@deepseek-ai/dsh-client-ui-theme/styles/*` onto `ui-theme/src/styles` so `url('@fontsource/...')` is rewritten into hashed `assets/fonts/` files; the package export remains `lib/styles` for Node consumers.

## Testing

`packages/client/ui-theme/tests/font-stacks.client.spec.ts` asserts each `DshCjk` face lists `local('PingFang TC')` before `url('@fontsource/noto-sans-tc/files/noto-sans-tc-chinese-traditional-<weight>-normal.woff2')` before `local('Microsoft JhengHei')`, `font-display: swap`, and that `require.resolve` finds each woff2. `apps/web/tests/cjk-webfont.spec.ts` asserts a Vite build of the shell base sheet rewrites those `url('@fontsource/...')` entries into hashed woff2 assets.
