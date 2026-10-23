# Design exports

PNG exports of the DA Bubble Figma, so agents can read the design without Figma access.

Figma: https://www.figma.com/design/xgLbXuX3F3WmBG0BZ2kloW

**The Figma is fixed**: v1 is exactly what these frames show.

## Layout

A straight export of the Figma file, one PNG per frame, named after the Figma frame (order prefix included).

- `pages/DABubble (Slack Clone) (Copy)/`: full screens at 1x — desktop frames are 1920×1080, mobile frames 430×932. Numbered `00`–`19` follow the user journey: intro, log in, sign up, choose avatar, password reset (`04`/`05`), then the workspace (`06`–`16`: channels, threads, direct messages, new message, editing messages), the reset email (`17`) and the legal pages (`18`, `19`). Overlays (`02B`, `03B`, …), dialogs (`37`–`43`, `64`, `65`, `Channel Edition`, `Profile view main`) and search/mention states (`Searching bar …`, `Tagging person`) sit alongside.
- `components/DABubble (Slack Clone) (Copy)/`: component sheets at **2x** (halve pixel sizes to get CSS px) and their states (icons, emojis, avatars, font, buttons, inputs, menus, reaction bars, message boxes). Numbers match the components referenced from the pages.

## Reading the names

- A `-1`, `-2`, … suffix is Figma de-duplicating identical frame names; it is usually the other breakpoint (e.g. `01-Log In.png` is mobile, `01-Log In-1.png` desktop) or another state of the same frame.
- A trailing `B`/`b`/`c` is a variant of the same frame, often mobile.
- `Note …` frames are the designer's annotations explaining behaviour; read them alongside the screens.
- `components/…/77. Hide/show navigation bar.png` landed in a subfolder because the Figma name contains a slash.
