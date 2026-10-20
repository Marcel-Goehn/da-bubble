# Keycloak login theme that matches the Figma

Research for [#5](https://github.com/Marcel-Goehn/da-bubble/issues/5) (map: [#1](https://github.com/Marcel-Goehn/da-bubble/issues/1)). Researched 2026-10-20 against Keycloak 26.8.1 (latest release) and Keycloakify 11.16.3 / `@keycloakify/angular` 22.1.0.

## Question

How do we customise Keycloak's login, registration (one name field + email + password), forgot-password, reset-password and verify-email pages to match a fixed design? Options: Keycloakify, a hand-written FreeMarker/CSS theme, or Keycloak's v2 login theme. How does the theme get into the docker-compose Keycloak, how does dev iteration work, how does registration collect one combined name, and can we reuse Tailwind?

## Recommendation

**Write the theme by hand: a FreeMarker login theme (`dabubble`) in the repo, styled with Tailwind 4, bind-mounted into the docker-compose Keycloak running `start-dev`.**

- Extend `base` (`parent=base`, `import=common/keycloak`). Override `template.ftl` plus the pages in the Figma. Do not load PatternFly.
- Compile the CSS with the Tailwind 4 CLI. Use `@source` to scan the `.ftl` files, and import the frontend's `@theme` tokens so the theme and the app share colours, fonts and spacing.
- For the single name field, **delete the `lastName` user-profile attribute** and relabel `firstName` as "Name". Keycloak's built-in full-name mapper then puts the whole name in the `name` claim with no custom code.
- **Fallback:** if hand-maintained FreeMarker becomes painful (many page states, client-side validation), switch to Keycloakify with `@keycloakify/angular` (it supports Angular 22) as a separate project in the monorepo.

Why not Keycloakify first: for Angular it is the second-class path. It cannot be installed into our existing Angular app, so it needs its own Vite/Analog project. It also needs Maven to build the JAR and adds Storybook/Nx tooling. The Angular starter is still on Angular 21. All of that is a lot of machinery for about 6 server-rendered forms with a fixed design. A plain FreeMarker theme needs only a folder, a CSS build step and a volume mount. Details below.

## Findings

### 1. What Keycloak offers out of the box

- A login theme is a folder `<theme>/login/` containing `theme.properties`, FreeMarker templates, message bundles and `resources/` (css/js/img). It sets `parent=` (usually `base`) and `import=common/keycloak`. Styles are listed in `styles=`. Parent styles are only included if you list them. To change a page you copy its template from the parent and edit it. Keycloak warns that custom templates may need updating on upgrades. ([Keycloak: Working with themes](https://www.keycloak.org/ui-customization/themes))
- **`keycloak.v2`** has been the default login theme since Keycloak 26.0: "For all new realms, `keycloak.v2` will be the default login theme". v1 (`keycloak`) "is now deprecated, and will be removed in a future release". v2 adds automatic dark mode. ([Keycloak 26.0.0 release notes](https://www.keycloak.org/2024/10/keycloak-2600-released))
- `keycloak.v2/login/theme.properties` is `parent=base`, `import=common/keycloak`, `stylesCommon=vendor/patternfly-v5/...`, `darkMode=true`, and maps about 120 `kc*Class` properties to PatternFly 5 classes (for example `kcButtonPrimaryClass=pf-v5-c-button pf-m-primary`). It also splits markup into macro files (`field.ftl`, `buttons.ftl`, `password-commons.ftl`). ([source: keycloak.v2/login](https://github.com/keycloak/keycloak/tree/main/themes/src/main/resources/theme/keycloak.v2/login))
  - **Implication:** extending `keycloak.v2` and only overriding CSS or `kc*Class` properties is enough for a re-brand. It is not enough to reproduce a fixed Figma layout, because the markup is PatternFly's. We would override the templates anyway, so extending `base` and dropping PatternFly avoids fighting PF5 CSS. The `base` templates are also the ones `keycloak.v2` itself builds on.
- The templates for our pages (in `base/login` and `keycloak.v2/login`) ([source: base/login](https://github.com/keycloak/keycloak/tree/main/themes/src/main/resources/theme/base/login)):

  | Figma screen | Template |
  |---|---|
  | Login | `login.ftl` |
  | Register | `register.ftl` (+ `register-commons.ftl`, `user-profile-commons.ftl`, `password-commons.ftl`) |
  | Forgot password (enter email) | `login-reset-password.ftl` |
  | Reset password (new password after email link) | `login-update-password.ftl` |
  | "Check your email" / verify email | `login-verify-email.ftl` |
  | Success/error messages after email links | `info.ftl`, `error.ftl` (also `login-page-expired.ftl`) |
  | Shared layout (card, logo, background, footer links) | `template.ftl` |

  Overriding `template.ftl` restyles every other page too, so pages missing from the Figma still look consistent.
- Server-side templates run inside Keycloak. Only install trusted themes and restrict write access to `themes/` and `providers/`. ([Working with themes](https://www.keycloak.org/ui-customization/themes))

### 2. Keycloakify

- Builds login, account, email and admin themes with React, Angular or Svelte. It bundles the theme into JAR files. "Keycloak 11 to 21 and 26 and newer: Use keycloak-theme-for-kc-all-other-versions.jar". ([Quick Start](https://docs.keycloakify.dev/readme), [Deploying](https://docs.keycloakify.dev/deploying-your-theme), [keycloakVersionTargets](https://docs.keycloakify.dev/features/compiler-options/keycloakversiontargets))
- **Angular caveats, from its own docs:** "React is recommended, as it has the most complete integration". "Keycloakify cannot be directly installed in an existing Angular project. Themes must either be standalone projects or a subproject in a monorepo." ([Quick Start](https://docs.keycloakify.dev/readme)) The Angular-workspace integration uses `@analogjs/platform:vite` builders, Vite and Nx packages ([Angular Workspace](https://docs.keycloakify.dev/integration-keycloakify-in-your-codebase/angular-workspace)).
- Versions (npm, 2026-10-20): `keycloakify` 11.16.3. `@keycloakify/angular` 22.1.0 has peers `@angular/core ^22.0.0` and `keycloakify ^11.15.3`, so it is compatible with our Angular 22. The official [`keycloakify-starter-angular-vite`](https://github.com/keycloakify/keycloakify-starter-angular-vite) is still on Angular 21 / `@keycloakify/angular` 21.x (last commit 2026-06-06).
- Customisation works by CSS on `kc*` classes (with PatternFly removed), or by ejecting pages (`npx keycloakify eject-page`). For Angular, ejecting `register` also ejects its sub-components. ([CSS Customization](https://docs.keycloakify.dev/css-customization), [Registration Page](https://docs.keycloakify.dev/page-specific-guides/registration-page))
- Tailwind: supported either via `@apply` on `kc*` classes or as utilities in ejected components ([Using Tailwind](https://docs.keycloakify.dev/common-use-case-examples/using-tailwind)).
- Dev loop:
  - Storybook with mock `kcContext` per page (`npx keycloakify add-story`, `npm run storybook`) ([Outside of Keycloak](https://docs.keycloakify.dev/testing-your-theme/outside-of-keycloak)).
  - `npx keycloakify start-keycloak` runs a Docker Keycloak with the theme "auto-rebuilt and updated in the Keycloak container". It needs Docker **and Maven**. ([Inside of Keycloak](https://docs.keycloakify.dev/testing-your-theme/inside-of-keycloak))
- Strengths: typed `kcContext`, mocked page states in Storybook, built-in real-time form validation, and it absorbs Keycloak template changes across versions ([Quick Start](https://docs.keycloakify.dev/readme)).

### 3. Packaging into docker-compose

- **Directory deployment (dev):** "copy the theme folder into the server's `themes` directory". In the official image that is `/opt/keycloak/themes`, so a bind mount `./keycloak/themes/dabubble:/opt/keycloak/themes/dabubble` works. ([Working with themes](https://www.keycloak.org/ui-customization/themes))
- **JAR deployment:** a JAR with `META-INF/keycloak-themes.json` placed in `/opt/keycloak/providers/` ([Working with themes](https://www.keycloak.org/ui-customization/themes)). Keycloakify's compose example mounts `./themes:/opt/keycloak/providers/` ([Deploying](https://docs.keycloakify.dev/deploying-your-theme)). Production hosting is out of scope for v1; both forms work there later.
- **Selecting the theme:** set `loginTheme` on the realm (Realm settings → Themes). For reproducibility, put it in the realm JSON that compose imports, along with the user-profile and registration settings below.

### 4. Dev iteration (hand-written route)

- `start-dev` sets: "Theme-caching and template-caching is disabled" ([Configuring Keycloak](https://www.keycloak.org/server/configuration)). With the bind mount, editing an `.ftl` file or the compiled CSS shows up on browser refresh, with no restart and no JAR rebuild. Outside dev mode the equivalent flags are `--spi-theme--static-max-age=-1 --spi-theme--cache-themes=false --spi-theme--cache-templates=false`. ([Working with themes](https://www.keycloak.org/ui-customization/themes))
- Run `tailwindcss -i theme.css -o .../login/resources/css/app.css --watch` next to the container.
- Downside compared with Keycloakify: no mocked page states. To see an error state you trigger it in the real flow, using the mail catcher for verify and reset emails.

### 5. One combined name field on registration

- The default user profile has `username`, `email`, `firstName`, `lastName`. For `username` and `email` "you are limited to changing their settings, and you can not remove them". `firstName` and `lastName` are ordinary attributes you can change or remove, and you can add your own. ([Server Admin: Understanding the Default Configuration](https://www.keycloak.org/docs/latest/server_admin/index.html#understanding-the-default-configuration))
- The registration form is rendered dynamically from the user profile (order, required markers, input type, permissions, `inputHelperText*` annotations) ([Server Admin: Customizing How UIs are Rendered / Defining UI Annotations](https://www.keycloak.org/docs/latest/server_admin/index.html#user-profile)). So removing an attribute removes the field, with no template change needed.
- **Recommended:** delete `lastName`, give `firstName` the display name "Name", and require it for users with a length validator. Turn on **Email as username** so the form is just name + email + password. Keycloak's `FullNameMapper` joins firstName and lastName, skipping empty values, into the `name` claim, so `name` = the full name ([source](https://github.com/keycloak/keycloak/blob/main/services/src/main/java/org/keycloak/protocol/oidc/mappers/FullNameMapper.java)). `given_name` will also hold the full name. The backend should read `name`.
- Alternative: a custom `fullName` attribute plus a "User Attribute" protocol mapper. It is cleaner semantically but needs more configuration, and the account console and admin UI would still show the firstName/lastName defaults unless we remove them too.
- Keep the Unmanaged Attributes policy on Disabled (the default). With Enabled, "Keycloak persists any attribute submitted during registration" ([Server Admin](https://www.keycloak.org/docs/latest/server_admin/index.html)).

### 6. Watch out: verify email + password on the register form

"When self-registrations is enabled together with Verify email realm switch, then password will not be set by default on the registration form. User will need first to verify his email and he will be able to setup his password on the subsequent screen." To keep the password on the register form (as the Figma shows), enable **Authentication → registration flow → Password validation settings → "Always set password on register form"**. The docs say this option "is deprecated and exists mostly for the backwards compatibility. It may be removed in the future." ([Server Admin: Clarification on verify email](https://www.keycloak.org/docs/latest/server_admin/index.html))

**Open decision for the auth/registration grilling:** either use the deprecated switch to match the Figma exactly, or accept Keycloak's recommended flow (name + email → verify → set password). This affects which screens the theme has to render. Keycloak also recommends enabling Forgot password alongside verify email.

### 7. Reusing Tailwind

- Tailwind 4 is CSS-first. `@source "<path>"` registers extra files to scan, and `@import "tailwindcss" source("../src")` sets the base path, which is "useful when working with monorepos" ([Tailwind: Detecting classes in source files](https://tailwindcss.com/docs/detecting-classes-in-source-files)). Theme variables live in `@theme` blocks that can sit in a shared CSS file and be imported by several projects ([Tailwind: Theme variables, Sharing across projects](https://tailwindcss.com/docs/theme#sharing-across-projects)).
- Plan: move the Figma tokens into e.g. `frontend/src/theme.css` (`@theme { --color-...; --font-... }`). The app's `styles.css` and the Keycloak theme's input CSS both `@import` it. The Keycloak CSS adds `@source "../login/**/*.ftl"`. The output is a static CSS file listed in `theme.properties` `styles=`, with no runtime JS. Fonts and the logo go into `login/resources/` and are referenced via `${url.resourcesPath}`.
- With Keycloakify the same shared-token file works (Tailwind via Vite), so this choice does not lock us in.

## Sources

- Keycloak, Working with themes: https://www.keycloak.org/ui-customization/themes
- Keycloak 26.0.0 release notes (keycloak.v2 default): https://www.keycloak.org/2024/10/keycloak-2600-released
- Keycloak theme sources: https://github.com/keycloak/keycloak/tree/main/themes/src/main/resources/theme
- Keycloak Server Administration Guide (User Profile, registration, verify email): https://www.keycloak.org/docs/latest/server_admin/index.html
- Keycloak, Configuring Keycloak (dev-mode defaults): https://www.keycloak.org/server/configuration
- Keycloak FullNameMapper: https://github.com/keycloak/keycloak/blob/main/services/src/main/java/org/keycloak/protocol/oidc/mappers/FullNameMapper.java
- Keycloakify docs: https://docs.keycloakify.dev/readme, /css-customization, /testing-your-theme/inside-of-keycloak, /testing-your-theme/outside-of-keycloak, /deploying-your-theme, /integration-keycloakify-in-your-codebase/angular-workspace, /common-use-case-examples/using-tailwind, /page-specific-guides/registration-page
- Keycloakify Angular starter: https://github.com/keycloakify/keycloakify-starter-angular-vite
- npm: `keycloakify` 11.16.3, `@keycloakify/angular` 22.1.0 (`npm view`)
- Tailwind CSS v4 docs: https://tailwindcss.com/docs/detecting-classes-in-source-files, https://tailwindcss.com/docs/theme
