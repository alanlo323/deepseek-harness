# Agent Note: Product UI ships Traditional Chinese as locale `zh-Hant`

Status: implemented

English | [中文](2026-08-18-zh-hant-ui-locale.zh.md)

## Problem

The browser client shipped only Simplified Chinese `zh` and English `en`. `detectBrowserLocale()` matched on the primary subtag, so `zh-TW`, `zh-HK`, and `zh-Hant*` all resolved to `zh`. A Traditional Chinese reader therefore opened a Simplified product on first visit, and there was no Language-row option that kept Simplified available while selecting Traditional. Diff, Read, Search, and Web tool cards also hardcoded Simplified chrome, so even a later locale switch left those cards in Simplified.

## Decision

**The browser client ships three LocaleIds: `zh`, `en`, and `zh-Hant`.** Language-row labels are 简体中文 / 繁體中文 / English. `FALLBACK_LOCALE` stays `en`, owned by the [browser-derived initial locale](2026-07-31-browser-derived-initial-locale.md) decision. An explicit Host `locale.preference` still replaces the provisional value live and is never written from detection.

**Detection walks `navigator.languages` then `navigator.language`; the first match wins.** English still matches on the primary subtag (`en-GB` → `en`). Chinese matches script before region: a `hans` subtag → `zh` (including `zh-Hans-TW`); otherwise `hant` or region `tw`/`hk` → `zh-Hant`; remaining `zh*` (bare `zh`, `zh-CN`, unnamed `zh-MO`) → `zh`. Unshipped languages such as `fr` still yield nothing and leave `FALLBACK_LOCALE` in charge. `window` remains the browser test.

**Every typed `register` call supplies a complete dictionary for every shipped LocaleId.** `zh` remains the key-set source of truth. Untyped namespaces (`permission.access`, `directory-browser`) register a matching `zh-Hant` dictionary in the same effect. Missing keys are compile errors on the typed path.

**Diff, Read, Search, and Web primitives accept optional `labels` with Simplified Chinese defaults.** That DEFAULT-is-Simplified contract matches TerminalBlock: ui-primitives stays cordis-free. Conversation and ui-tool inject a full label set from the conversation locale seat at both the chat row and the details panel, including SearchBlock's complete `summaryText`. Copy / copied / collapse strings stay in the common namespace.

## Alternatives considered

**Runtime OpenCC or glyph conversion of the `zh` dictionary.** Rejected because Simplified must remain a selectable locale, conversion quality for product terms is uncontrolled, and the Language row would no longer name two Chinese locales.

**Keep LocaleId as `zh | en` and register `zh-Hant` only through the untyped `register(ns, locale, dict)` form.** Rejected because `LOCALES`, `setLocale`, and the Host settings schema only accept shipped LocaleIds; an untyped third dictionary would not appear in the Language row and would not persist as `preference`.

**Ship `zh-Hant` dictionaries incrementally and fall back missing keys to Simplified.** Rejected because lookup already falls back to `en`, and a mixed-language UI after the user chose Traditional would violate the completeness the typed `Record<LocaleId, dict>` registration exists to enforce.

## Consequences

Every new UI namespace now delivers three complete dictionaries, not two. First visit from a `zh-TW`/`zh-HK`/`zh-Hant*` browser lands in Traditional Chinese; `zh-Hans-TW` still lands in Simplified. The Language option formerly labelled 中文 is 简体中文. Documentation pairing (`.zh.md`) and the VitePress `root` locale remain Simplified/English — product UI locales and docs locales are independent. IN/OUT gutters, JsonTree's default English copy, and command descriptions captured at registration stay out of this locale set.

## Testing

`packages/client/locale` specs pin script-then-region detection, the three Language-row options, Host schema acceptance of `zh-Hant`, and occupancy of the `zh-Hant` dictionary seat. Primitive specs keep DEFAULT Simplified and assert injected labels. ui-tool card specs under `zh-Hant` assert Traditional chrome on Diff/Read/Search/Web. `apps/web/tests/settings-chrome.e2e.ts` asserts the renamed 简体中文 option and a preference-less Playwright `locale: 'zh-TW'` page opening on 繁體中文.
