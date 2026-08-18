# @deepseek-ai/dsh-client-locale

English | [中文](README.zh.md)

Locale plugin: LocaleRuntime — the `zh`/`en`/`zh-Hant` preference stored as `locale.preference` in `$DSH_HOME/settings.yaml`; when that explicit Host value is absent, a fresh browser starts provisionally in the language `navigator` asks for (English on the primary subtag; Chinese on script then region: `hans` → `zh`, otherwise `hant` or region `tw`/`hk` → `zh-Hant`, remaining `zh*` → `zh`; `zh` when it asks for no language this app ships). The Host read runs after plugin activation so an unavailable settings service cannot block the page; its result replaces the provisional browser value live. Remote browsers retain only a process-local selection because the settings API is loopback-only. `locale/change` fires on switches. The service also owns the ns×locale dictionary registry (typed `register(ns, { zh, en, 'zh-Hant': zhHant })` checked against `LocaleNamespaceMap`, `bind(ns)`→`TranslateNS<ns>`; lookup chain ns → common → zh → key), implements the slot system's `LocaleFace`, and installs itself through `ctx.slots.installLocale`, backing the framework-injected `t` standard seat (`Translate`/`TranslateNS` are ui-slots types; import them from there — this package only re-exports for dictionary owners' convenience). The [Host-backed preferences decision](../../../.agents/notes/implemented/bug-fix/2026-08-06-host-backed-web-preferences.md) owns the persistence boundary. The [zh-Hant UI locale decision](../../../.agents/notes/implemented/feature/2026-08-18-zh-hant-ui-locale.md) owns the third locale, detection rule, and dictionary completeness requirement.

## Model Experience

None, as the locale registry serves browser UI copy; nothing here reaches a model request.

#### KV Cache effect

None; this package neither assembles nor sends a provider request.

## Known Limitations and Deferred Work

- **Some surfaces keep inline copy** — Settings rows, the sidebar, question composer, and model select use locale seats; other packages still own static text directly.
- **Registry-held text reads its translation once** — copy captured at registration time outside the slot render path (e.g. the `/model` command description in the command registry) keeps the language it was registered under until re-registration; slot-rendered copy follows switches live.
- **IN/OUT gutters, JsonTree defaults, and frozen command descriptions stay as authored** — Diff/Read/Search/Web cards take injected labels; those other chrome strings are not localized by this plugin.
- **Product UI locales are independent of documentation pairing** — `.zh.md` files stay Simplified Chinese, and the VitePress site `root` locale stays zh-CN. Shipping `zh-Hant` in the browser client does not add a documentation or site locale.
