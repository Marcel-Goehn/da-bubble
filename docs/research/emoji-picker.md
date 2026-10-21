# Which emoji picker fits Angular 22?

Research for [#13](https://github.com/Marcel-Goehn/da-bubble/issues/13). Checked on 2026-10-21 against npm, GitHub and the projects' own READMEs.

## Answer

Use **`emoji-picker-element`** (v1.29.1). It is a framework-free web component that works in a standalone Angular component through `CUSTOM_ELEMENTS_SCHEMA`. You load it lazily with a dynamic `import()` or `@defer` when the picker opens. It has search, categories, skin tones, a German UI translation and German emoji data, and you style it with CSS custom properties. The core is about 12.5 kB min+gz, and the emoji data (about 440–470 kB of JSON) is fetched once and kept in IndexedDB. It returns native Unicode, so the stored value is a plain string such as `"👍🏾"`.

**Fallback:** `emoji-mart` v5 (also a web component). It has the same shape (search, categories, `de` locale, native output) but has had no release since April 2024 and its emoji data stops at Emoji 15. **Avoid** `@ctrl/ngx-emoji-mart` (archived) and `picmo` (archived and deprecated on npm).

## Comparison

| | emoji-picker-element | emoji-mart v5 (+ `@emoji-mart/data`) | @ctrl/ngx-emoji-mart | picmo |
|---|---|---|---|---|
| Latest version / date | 1.29.1, 2026-03-01 [1] | 5.6.0, 2024-04-25; data 1.2.1, 2024-04-25 [2] | 9.3.0, 2025-09-16 [3] | 5.8.5, 2023-06-24 [4] |
| Repo status | active, last push 2026-06 [5] | not archived, last push 2024-08, 221 open issues [5] | **archived** [5] | **archived**, npm-deprecated [4][5] |
| Angular integration | web component + `CUSTOM_ELEMENTS_SCHEMA` | web component (`<em-emoji-picker>`) + `CUSTOM_ELEMENTS_SCHEMA` | native Angular component, standalone-capable, peer `@angular/core >=15` [3][7] | web component / vanilla |
| Bundle | ~12.5 kB min+gz core, no deps [1][6] | 1.6 MB unpacked package, no deps; data loaded separately [2] | 5 MB unpacked; data bundled [3] | depends on emojibase [4] |
| Emoji data | fetched from `dataSource` URL (default jsDelivr `emoji-picker-element-data`), cached in **IndexedDB**; `en/emojibase` 440 kB, `de/cldr` 467 kB JSON; built from emojibase-data 17.0.0 [6][8] | `@emoji-mart/data` (`sets/15/native.json` 433 kB), bundled or fetched async [2][9] | `emoji-datasource` 14.0.0 [7] | emojibase 6 |
| Search / categories | yes / yes, custom categories, favorites [6] | yes / yes, frequent, configurable order [9] | yes / yes [7] | yes / yes |
| Selection payload | `{ emoji: { unicode, shortcodes, ... }, skinTone, unicode }` (native Unicode) [6] | `{ id, native, unified, shortcodes, ... }` [9] | `{ colons: ':santa::skin-tone-3:', native, ... }`; renders sprite sheets by default (`set: apple`) [7] | native |
| German | UI `i18n/de` + `de` emoji data [6][8] | `locale: 'de'` [9] | i18n object by hand [7] | – |
| Styling | Shadow DOM; ~30 CSS custom properties (`--background`, `--emoji-size`, `--num-columns`, `--emoji-font-family`, ...); extra CSS via `shadowRoot` [6] | Shadow DOM; `theme`, `perLine`, `dynamicWidth`, CSS variables [9] | global stylesheet `picker.css` [7] | – |

## Notes for Angular 22 (standalone, signals, zoneless)

- **Standalone:** a standalone component that hosts `<emoji-picker>` sets `schemas: [CUSTOM_ELEMENTS_SCHEMA]`. No NgModule and no Angular wrapper library is needed.
- **Zoneless:** Angular runs change detection after "bound host or template listener callbacks" and after signal updates [10]. A template binding `(emoji-click)="onPick($event)"` that writes to a signal therefore works without Zone.js. emoji-picker-element does its own DOM work inside its Shadow DOM and never relies on Angular change detection.
- **Lazy-loading:** `import('emoji-picker-element')` inside the click handler, or the picker host inside `@defer (on interaction)`, keeps the picker out of the initial bundle. The README itself says to "lazy-load upon user interaction" and that the picker is client-side only (no SSR) [6].
- **Data hosting:** set `dataSource` to a copy of `emoji-picker-element-data/de/cldr/data.json` served from the app's own assets, so the app does not need jsDelivr at runtime. Set `locale: 'de'` too. The data is versioned (emojibase 17), so new Unicode releases come from upgrading the data package [6][8].
- **Safari clipboard:** use `emoji-click-sync` only if the picker writes to the clipboard. Inserting into the composer works with `emoji-click` [6].

## Data format to store

Store the **native Unicode string with the skin tone already applied** (`event.detail.unicode`), for example `"👍🏾"`, as the Reaction's emoji and inline in Message text. Reasons:

- Every candidate can produce it: `unicode` in epe, `native` in emoji-mart and ngx-emoji-mart.
- Shortcodes differ between sets (emojibase, GitHub, iamcal and CLDR all name emoji differently [8]), so a stored shortcode would tie the database to one library.
- Native text needs no lookup to show it in Message text, search or emails.
- `Database.getEmojiByUnicodeOrName()` can turn a stored Unicode string back into metadata (for example a tooltip name) if one is ever needed [6].

Reaction emoji are grapheme clusters of up to about 7 code points (ZWJ sequences plus a skin tone), so the column should be a short `varchar`/`text`, not a single `char`.

## Figma

The Figma has no picker frame. It shows only reaction emoji in the components export (`docs/design/components/DABubble (Slack Clone) (Copy)/51. Emojis.png`). The designer's note (`00b. Emojis.png`) says those emoji images come from the **Emojitwo** set on iconduck. No picker ships Emojitwo. With native Unicode stored, the app renders the OS emoji font by default. If the Emojitwo look is required, emoji-picker-element's `--emoji-font-family` can point at a self-hosted emoji font for the picker [6], and the same font can be applied to Message text. Windows has no native flag emoji, and the project's "flags" demo shows a font-based fallback [6]. Matching the picker chrome (border radius, colours, search field) to the app's Tailwind tokens is done through the CSS custom properties.

## Sources

1. npm `emoji-picker-element`: https://www.npmjs.com/package/emoji-picker-element (latest 1.29.1, published 2026-03-01, Apache-2.0, zero dependencies)
2. npm `emoji-mart` (5.6.0, 2024-04-25) and `@emoji-mart/data` (1.2.1, 2024-04-25): https://www.npmjs.com/package/emoji-mart, https://www.npmjs.com/package/@emoji-mart/data
3. npm `@ctrl/ngx-emoji-mart` (9.3.0, 2025-09-16, peer `@angular/core >=15.0.0-0`): https://www.npmjs.com/package/@ctrl/ngx-emoji-mart
4. npm `picmo` / `@picmo/popup-picker` (5.8.5, marked deprecated: "Package no longer supported"): https://www.npmjs.com/package/picmo
5. GitHub repo metadata (`gh api repos/<repo>`, 2026-10-21): nolanlawson/emoji-picker-element (not archived, pushed 2026-06-08), missive/emoji-mart (not archived, pushed 2024-08-12, 221 open issues), scttcper/ngx-emoji-mart (archived, last commit 2025-09-16 "publish new version", previous 2023-06), joeattardi/picmo (archived)
6. emoji-picker-element README: https://github.com/nolanlawson/emoji-picker-element#readme (bundle size, Shadow DOM, CSS variables, `dataSource`/`locale`/`i18n`, `emoji-click` payload, IndexedDB, custom emoji, tree-shaking, SSR/lazy-loading note); German UI strings: https://github.com/nolanlawson/emoji-picker-element/tree/master/src/picker/i18n
7. ngx-emoji-mart README and package.json: https://github.com/scttcper/ngx-emoji-mart (standalone `PickerComponent`, `emojiSelect` payload with `colons`, default `set: apple` sprite sheets from unpkg; dev deps `@angular/core 16.0.5`, `emoji-datasource 14.0.0`)
8. npm `emoji-picker-element-data` 1.8.0 (2025-11-19, built from `emojibase-data` 17.0.0); file list via https://data.jsdelivr.com/v1/packages/npm/emoji-picker-element-data@1.8.0?structure=flat (`/de/cldr/data.json` 467,048 B; `/en/emojibase/data.json` 439,662 B; also `github`, `iamcal`, `joypixels`, `cldr-native` shortcode flavours)
9. emoji-mart README: https://github.com/missive/emoji-mart#readme (data decoupling and async fetch, options incl. `locale` `de`, `theme`, `dynamicWidth`, `set`, `emojiVersion` max 14 in the README; `getEmojiDataFromNative` payload); data files: https://data.jsdelivr.com/v1/packages/npm/@emoji-mart/data@1.2.1?structure=flat (`sets/15/native.json` 432,733 B)
10. Angular zoneless guide: https://angular.dev/guide/zoneless ("Bound host or template listeners callbacks" and signal updates read in templates notify change detection); source https://github.com/angular/angular/blob/main/adev/src/content/guide/zoneless.md
