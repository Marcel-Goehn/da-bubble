# Design tokens

Extracted from the Figma file `xgLbXuX3F3WmBG0BZ2kloW` ("DABubble (Slack Clone) (Copy)", last modified 2026-10-21) through the REST API (`GET /v1/files/:key`, 24.6 MB, kept local and gitignored as `docs/design/figma.json`), then checked by sampling pixels in the PNGs in `pages/`. Counts are how often a value appears on the *Prototype* and *Components* pages. Avatar illustrations, emoji, the Workspace logo, the Gmail mock (`17.`) and the designer's notes are excluded.

The Tailwind 4 theme is [`frontend/src/tokens.css`](../../frontend/src/tokens.css).

## Colours

The Figma has 32 named styles, but they are duplicated (e.g. two "Black", three "Text gray"). These are the distinct values that UI layers (frames, rectangles, text) actually use:

| Palette token | Hex | Figma style | Uses | Where |
|---|---|---|---|---|
| `--palette-purple-1` | `#444DF2` | Purple 1 | 1 320 | primary button, secondary button text and border hover, focus border, link hover |
| `--palette-purple-2` | `#797EF3` | Purple 2 | 834 | own speech bubble, primary button hover, input hover border, secondary button border, soft links |
| `--palette-purple-3` | `#535AF1` | Purple 3 | 280 | menu text on hover/active, "Bearbeiten", "2 Antworten", secondary button hover fill, focus border on login inputs |
| `--palette-purple-deep` | `#313AE5` | — | 2 | intro gradient start (bottom) |
| `--palette-lavender` | `#ADB0D9` | Ligth purple (Lines) | 1 161 | borders, separators, reaction chips |
| `--palette-lavender-light` | `#ECEEFE` | Bg color | 927 | page background, hover/selected rows, others' speech bubble, login input fill |
| `--palette-white` | `#FFFFFF` | White | 3 451 | panels, dialogs, text on accent |
| `--palette-black` | `#000000` | Black | 2 588 | body text, icons |
| `--palette-gray` | `#686868` | Text gray | 663 | timestamps, placeholders, "Aktiv", offline dot, disabled button |
| `--palette-gray-light` | `#E6E6E6` | — | 3 | Avatar hover ring |
| `--palette-slate` | `#42526E` | menu color | 8 | privacy checkbox label |
| `--palette-green` | `#92C83E` | online green | 300 | online dot, "Aktiv" on the profile card |
| `--palette-pink` | `#ED1E79` | Rosa error | 112 | field errors |
| `--palette-blue` | `#1381FF` | — | 16 | email link on the profile card |

Not taken over: `Gray 1/2/4/5`, `Blue 1`, `red-40` (only on the Gmail mock or not used), `#D9D9D9` (icon bounding boxes, not visible), `#9747FF` (Figma's component-set outline), `#1C1B1F` (inside Material icons, drawn in `currentColor` instead).

**Intro gradient:** linear, `#313AE5` at the bottom → `#797EF3` at the top (PNG: `#303AE5` / `#797EF3`) → `bg-linear-to-t from-intro-start to-intro-end`.

### Semantic layer

Components use only these. Tailwind prefixes the utility, so the text tokens read `text-text`, `text-text-muted`, `text-interactive`, and the borders `border-border`, `border-border-focus`. The resets in `tokens.css` remove Tailwind's default palette, radii, shadows and text sizes, so `bg-purple-500` or `rounded-lg` don't exist (verified with Tailwind 4.3.3).

| Semantic token | Palette | Role |
|---|---|---|
| `page` | lavender-light | app and login background |
| `surface` | white | panels, dialogs, cards, dropdowns |
| `hover` | lavender-light | hover and selected background of rows and icon buttons |
| `field` | lavender-light | filled inputs on the login pages |
| `text` | black | body text |
| `text-muted` | gray | timestamps, placeholders, status, hints |
| `text-subtle` | slate | privacy checkbox label |
| `text-inverse` | white | on accent buttons and the own bubble |
| `interactive` / `interactive-hover` | purple-3 / purple-1 | text links, active and hovered menu text |
| `link-soft` | purple-2 | "Passwort vergessen?", "Account erstellen", channel subtitle |
| `link-external` | blue | mailto link |
| `accent` / `accent-hover` | purple-1 / purple-2 | primary button |
| `accent-secondary-hover` | purple-3 | secondary button hover fill |
| `disabled` | gray | disabled primary button |
| `border` / `border-hover` / `border-focus` | lavender / purple-2 / purple-1 | inputs, cards, composer |
| `avatar-ring-hover` / `avatar-ring-selected` | gray-light / lavender-light | Avatar picker |
| `bubble-own` / `bubble-other` | purple-2 / lavender-light | speech bubbles |
| `online` / `offline` | green / gray | Presence dot |
| `error` | pink | field errors |
| `intro-start` / `intro-end` | purple-deep / purple-2 | intro gradient |

The focus border is `#444DF2` on the main composer and dialog inputs but `#535AF1` on the thread composer and login inputs. Both map to `border-focus` = purple-1; the difference isn't visible.

## Component states

How the semantic colours combine, read from the component sets:

| Component | Default | Hover | Active / pressed | Other |
|---|---|---|---|---|
| Primary button (`10.`) | `accent` bg, white bold 18 | `accent-hover` bg | `accent` bg | disabled: `disabled` bg |
| Secondary button (`11.`) | 1 px `accent-hover` border, `accent` text | `accent-secondary-hover` bg, white text | `accent` bg, white text | — |
| Login input (`2.`–`6.`) | `field` bg, no border, `text-muted` 500 18 placeholder | 1 px `text-muted` border | 1 px `border-focus` border | error: `error` 14 text below |
| Text box / composer (`33.`–`35.`, `61.`, `63.`) | white, 1 px `border` | `border-hover` | `border-focus` | — |
| Menu row (`18.`, `30.`) | transparent | `hover` bg | `hover` bg, bold `interactive` text | — |
| Section heading (`17.`, `23.`) | black bold 20 | `interactive` text | black | — |
| Icon button (`16.`, `19.`, `45.`, `59.`) | transparent | `hover` bg | `hover` bg | — |
| Text link (`40.`, `50.`) | `interactive` 600/400 | `interactive-hover`, bold | — | — |
| Soft link (`8.`, `9.`) | `link-soft` 400 | `accent` 500 + `hover` bg pill (`9.`) or `border` outline (`8.`) | — | — |
| Google login (`12.`) | `field` bg, `accent` text | + 1 px `accent` border, bold | 1 px `text-muted` border | — |
| Message row (`48.`, `49.`) | transparent | `hover` bg, reaction bar appears | — | edit: `hover` bg + text box |
| Reaction chip (`54.`–`57.`) | white, 1 px `border`, r20 | `border-hover` + tooltip bubble (`accent` bg, r30 with bottom-left 0) | `border-focus` | — |
| Avatar picker (`80.`, `81.`) | — | 4/8 px `avatar-ring-hover` ring | 4/8 px `avatar-ring-selected` ring | — |

Hover in the Figma often makes text bold (400/600 → 700). That shifts the layout. Whether to keep it or only change colour is a build-time call.

## Typography

**Nunito only.** A few links on `01-Log In`/`02-Sign In` use Figtree or Open Sans, which looks like a slip: the same components use Nunito everywhere else. Inter, Roboto and Patrick Hand appear only on the type sheet, the Gmail mock and the designer's notes.

Sizes the screens actually use:

| Token | px | rem | Line height | Weights | Desktop | Mobile |
|---|---|---|---|---|---|---|
| `text-46` | 46 | 2.875 | 1.2 | 700 | page titles ("Anmeldung") | — |
| `text-32` | 32 | 2 | 1.2 | 700 | profile-card / user-menu name | page titles, user-menu name |
| `text-24` | 24 | 1.5 | 1.364 | 400, 600, 700 | panel/dialog titles, "Devspace", search field, user menu items | dialog titles |
| `text-20` | 20 | 1.25 | 1.364 | 400, 500, 600, 700 | "Channels"/"Direktnachrichten", profile labels, Mention lists, nav tab | section headings, hints |
| `text-18` | 18 | 1.125 | 1.364 | 400, 500, 700 | **body**: messages, menu rows, inputs (500), buttons (700) | body |
| `text-17` | 17 | 1.0625 | 1.364 | 400 | — | login buttons, links, inputs, `@`/`#` field |
| `text-16` | 16 | 1 | 1.364 | 400 | reaction counts, "hat reagiert", privacy checkbox | same |
| `text-14` | 14 | 0.875 | 1.364 | 400 | timestamps, "Letzte Antwort …", field errors | same |

Line height: most text in the Figma uses Nunito's "auto" line height (ascent + descent, 24.6 px at 18 px = 1.364). The two named display styles (*Bold Display* 46, *Bold Mobile Display* 32) use 120 %. Weights are Tailwind's `font-normal` / `medium` / `semibold` / `bold` (400/500/600/700). Letter spacing is always 0.

**This doesn't match How is the Angular app structured?** That ticket fixed the scale 46/38/32/26/22/18/15/12 from the designer's sheet *00d. Font size – Nunito*. The sheet's sample text is set in Inter at 38/32/26/22/18/15/12, and the screens don't use 38, 26, 22, 15 or 12 at all. They use 14/16/17/18/20/24 instead. `tokens.css` follows the screens. The rem conversion (px ÷ 16 on the browser's 16 px root) is kept as decided.

## Spacing

Figma gaps (counts): 10 (1 925), 15 (877), 20 (434), 5 (254), 8 (192), 25 (185), 30 (129), 16, 40, 13, 6, 32, 45. Common paddings: 8/8 (icon buttons), 4/20 (menu rows), 12/25 (buttons), 18/32 (login inputs), 20 (text boxes, menus), 40 (dialogs), 32/30 (sidebar).

The values are mostly multiples of 5, mixed with 4/8/12/16/32. A 4 px Tailwind step would turn 10/15/25 into `2.5`/`3.75`/`6.25`, so **`--spacing: 0.0625rem`** (1 Figma px per step) instead: `p-20 gap-15`, `w-366` read exactly like the Figma and need no arbitrary values. Still rem, so spacing scales with the user's font size.

Layout reference (desktop 1920×1080): page padding 20 at the sides, 25 top, panels start at y 115 with 20 between them; workspace menu 366 wide (padding 32/30); main chat flexible (989 at full width), thread 485; panel header 96 (main) / 104 (thread) high; search bar 70 high. Mobile 430×932: 4-column grid, 16 px margin and gutter; mobile header 80 high (padding 15/16).

## Radii

| Token | px | Uses | Where |
|---|---|---|---|
| `rounded-full` | 100 / 500 / ≥ ½ height | 151 + 20 | login inputs, menu rows, pills, Avatars (35/40/42/50/60) |
| `rounded-30` | 30 | 931 | panels, dialogs, speech bubbles, text boxes, time separators |
| `rounded-25` | 25 | 69 + 90 | buttons (49 high, so effectively pills), reaction bar |
| `rounded-20` | 20 | 756 | composer, icon buttons, menu buttons, dropdowns, reaction chips |
| `rounded-15` | 15 | 70 | section headings |
| `rounded-10` | 10 | 55 | small elements |
| `rounded-5` | 5 | 107 | small elements |
| `rounded-40` | 40 | 56 | "Text box + ICON" |

**Asymmetric corners** (one corner 0) are the speech-bubble / popover tail, pointing at whatever opened the element. Use `rounded-30` plus one `rounded-*-none`, never a separate token:

- own bubble: top-right 0
- others' bubble and popovers to the right of their trigger: top-left 0
- user menu, Members and Add-members popovers: top-right 0
- reaction bar: bottom-right 0
- `@`/`#` dropdowns: bottom-left 0 (above the composer) or top-left 0 (below the search)
- nav tab: left side 0

Radii are in px, so they don't scale with font size. That's intentional.

## Shadows

| Token | Value | Uses | Where |
|---|---|---|---|
| `shadow-header` | `0 2px 10px rgb(0 0 0 / .08)` | 63 | panel headers, `@`/`#` dropdowns |
| `shadow-overlay` | `0 6px 10px rgb(0 0 0 / .2)` | 62 | dialogs, popovers, profile card, user menu |
| `shadow-overlay-up` | `0 -3px 10px rgb(0 0 0 / .2)` | 13 | mobile bottom sheets |
| `shadow-tab` | `4px 4px 7px rgb(0 0 0 / .2)` | 20 | "Workspace-Menü schließen" tab |
| `shadow-avatar` | `0 2px 10px rgb(0 0 0 / .1)` | 27 | own Avatar beside own Messages |

The "Nachricht bearbeiten" popover uses `0 6px 14px` (7 uses). The difference isn't visible, so it's merged into `shadow-overlay`. Borders are 1 px everywhere except the Avatar picker rings (4/8 px) and the hide-menu icon (2/2.5 px).

## Not in the Figma

- **Dialog backdrop:** no frame shows a scrim behind dialogs, and no prototype overlay has a background. The CDK Dialog's backdrop colour needs choosing during the build.
- **Focus ring for keyboard users:** the Figma has only hover/click states. Accessibility needs a visible `:focus-visible` ring. `border-focus` (purple-1, 5.85:1 on white) is the obvious colour.
- **Dark mode:** not designed, not in v1.

## Contrast (WCAG 2.2 AA)

The decision so far is to build with the Figma values and adjust tokens after the Lighthouse run. These pairs will need that:

| Pair | Ratio | Needs | Where |
|---|---|---|---|
| `#92C83E` on white | 1.99 | 4.5 | "Aktiv" text on the profile card |
| `#ADB0D9` on white | 2.10 | 4.5 | "2 Antworten" thread separator text |
| `#ADB0D9` on white | 2.10 | 3 (UI) | input, card and chip borders |
| `#797EF3` on white | 3.45 | 4.5 | soft links, channel subtitle |
| white on `#797EF3` | 3.45 | 4.5 | own speech bubble text, primary button hover |
| `#1381FF` on white | 3.74 | 4.5 | email link |
| `#ED1E79` on white / `#ECEEFE` | 4.15 / 3.60 | 4.5 | field errors |
| `#535AF1` on `#ECEEFE` | 4.45 | 4.5 | active menu text on its hover bg |

These pass: black, `#686868` (5.57 on white, 4.84 on `#ECEEFE`), `#444DF2` both ways (5.85), `#535AF1` on white (5.12), `#42526E` (7.88).

## Updating

The Figma JSON isn't committed (24.6 MB). To re-extract, download it with a personal access token (scope `file_content:read`):

```bash
curl --compressed --fail -H "X-Figma-Token: <token>" \
  "https://api.figma.com/v1/files/xgLbXuX3F3WmBG0BZ2kloW" -o docs/design/figma.json
```
