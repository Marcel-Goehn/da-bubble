# Keycloak guest access options

Research for [#6](https://github.com/Marcel-Goehn/da-bubble/issues/6) (map [#1](https://github.com/Marcel-Goehn/da-bubble/issues/1)). The decision is made later in [#9](https://github.com/Marcel-Goehn/da-bubble/issues/9). This file lists facts and trade-offs only.

**Question.** The Figma has a guest login button. The backend only trusts JWTs that Keycloak issues, so a guest needs a Keycloak token. Which mechanisms does Keycloak offer, and what does each cost a small private team app?

**Constraints from the map.** Keycloak hosted login, themed to match the Figma. Angular runs Authorization Code + PKCE as a public client. The backend only validates JWTs. The User primary key is the Keycloak `sub`, provisioned just-in-time. About 5–50 users, one Workspace, not public. Note that `docs/adr/0001-keycloak-hosted-login-frontend-pkce.md` is referenced by the map but is not on `main` yet.

**Keycloak version checked.** Current docs are 26.8.x (October 2026).

## Short answer

- Keycloak has **no built-in anonymous or guest login**. No such feature appears in the [feature list](https://www.keycloak.org/server/features), and the [Keycloak forum](https://forum.keycloak.org/t/guest-user-login-through-keycloak/10174) says it is "not functionality supported natively by Keycloak". A search of `keycloak/keycloak` issues turned up no feature request for it.
- Every working option comes down to one of two things:
  - **One shared guest user** that everybody logs in as.
  - **A real Keycloak user per guest**, created on demand. Since 26.6, the supported **Workflows** feature can delete these users automatically.
- The "newer" mechanisms do not fit:
  - **Transient users** work only for users brokered from an external identity provider. They are experimental and are scheduled for removal.
  - **Standard token exchange (V2)** cannot impersonate.
  - **Legacy token exchange (V1)** can impersonate, but it is deprecated and will be removed.
  - **JWT Authorization Grant** requires a user that already exists and is linked to an identity provider.

## Options

### A. Shared guest account (one Keycloak user, for example `guest`)

How it works: create one normal realm user with a known password. The guest button sends the browser through the normal PKCE login, either with `login_hint=guest` and the password shown or auto-filled in the themed login page, or with the user typing the credentials shown on the button. ([Keycloak supports `login_hint`](https://www.keycloak.org/docs/latest/server_admin/index.html) on the OIDC auth endpoint.)

- **Cost:** close to zero. Only realm config (one user, maybe a `guest` role) and a small login theme tweak. No custom code in Keycloak.
- **Fit:** fully compatible with the hosted login, PKCE, and backend-validates-JWT setup. The backend sees one stable `sub`, so just-in-time provisioning creates exactly one guest User.
- **Risks and trade-offs:**
  - All guests are the **same User**. They share a profile, avatar, name, DM history, and authorship, and each can edit or delete what another guest wrote. Concurrent guests see each other's activity as "self".
  - The password is public. You must stop guests from changing it or the email: no `UPDATE_PASSWORD`, no account console access for that user, no reset-credentials email. Otherwise one guest can lock out all the others. Brute-force lockout on that user also affects every guest.
  - Data guests leave behind piles up under one user unless the app cleans it up.
  - The app cannot tell individual guests apart, so there is no per-guest moderation.

### B. Per-guest Keycloak users, created by a custom authenticator in the hosted login (Authentication SPI)

How it works: add a "Continue as guest" action to the themed login page. A custom `Authenticator` in the browser flow creates a fresh user, for example `guest-<random>` with a `guest` role or attribute, and calls `context.setUser(user)`. The normal Authorization Code + PKCE flow then completes, and Angular gets ordinary tokens, including refresh tokens. See the [Authentication SPI in the Server Developer Guide](https://www.keycloak.org/docs/latest/server_development/index.html#_auth_spi). The guide's example authenticator calls `context.setUser(user)`.

- **Cost:** a Java or Kotlin Keycloak extension (a jar in `providers/`), built and mounted in docker-compose, plus a browser-flow change and a theme button. Moderate effort.
- **Fit:** the best fit with the existing architecture. Each guest gets a distinct `sub`, so just-in-time provisioning gives each guest their own User, and the backend needs no special case beyond maybe reading a `guest` role.
- **Risks and trade-offs:**
  - The docs mark the Authentication SPI as **internal**: "any new release of Keycloak can change it without prior notice." Upgrades can break the extension.
  - Anyone who reaches the login page can create users without limit. Mitigations are rate limiting or a CAPTCHA (Keycloak has [reCAPTCHA integration for registration](https://www.keycloak.org/docs/latest/server_admin/index.html)) and cleanup (option D).
  - Guest users show up in the Keycloak user list, and app-side Users get created for them, so the backend needs its own cleanup of guest Users and their data. This is the same lifecycle question as option D.

### C. Per-guest Keycloak users, created by the backend through the Admin REST API

How it works: a backend endpoint, for example `POST /guest`, uses a confidential service-account client with `manage-users` to create a user. The guest then needs tokens, and Keycloak offers only poor ways to get them:

1. **Resource owner password grant (Direct Access Grants).** The backend sets a random password, calls the token endpoint with it, and returns the tokens to the browser. Keycloak still supports this ([admin guide: "Direct Access Grants are used by REST clients to obtain tokens on behalf of users"](https://www.keycloak.org/docs/latest/server_admin/index.html)). However, the OAuth security BCP ([RFC 9700 §2.4](https://www.rfc-editor.org/rfc/rfc9700#section-2.4)) says it "MUST NOT be used". The tokens would also come from a different client than the Angular PKCE client, which affects audience and refresh handling.
2. **Legacy token exchange V1, direct naked impersonation.** See option F. It is deprecated.
3. **Admin impersonation** (`impersonation` feature, supported, on by default). It is built for an admin acting through the Admin Console. Per the [admin guide](https://www.keycloak.org/docs/latest/server_admin/index.html), the admin "will be logged out and automatically logged in as the user", and that user's Account Console opens. It works through browser SSO cookies, not by handing tokens to an API client. Using it as a guest-token mint would be a hack.
4. **Create the user, then redirect to the login page.** The guest would still need credentials, so this collapses back into option A or B.

- **Cost:** a backend endpoint, a privileged service-account secret in the backend, and a second token-acquisition path in Angular next to PKCE.
- **Risks:** a backend credential that can create users (and, with option F, impersonate them). It goes against the "frontend runs PKCE, backend only validates" split in the auth decision. Every token route above is deprecated, discouraged, or a hack.

### D. Cleanup of per-guest users: Keycloak Workflows (supported since 26.6)

This option goes with B or C rather than standing alone.

- **History:**
  - Experimental in 26.4 ([blog](https://www.keycloak.org/2025/10/workflows-experimental-26-4)).
  - Preview in 26.5 and **supported in 26.6** ([release notes](https://www.keycloak.org/docs/latest/release_notes/index.html)).
  - Now listed as supported and enabled by default ([features](https://www.keycloak.org/server/features), `workflows:v1`).
- **How it works:** workflows are YAML definitions with a trigger (`on: user-created`, `user-authenticated`, `user-role-granted`, and others), a condition (`if: has-role(...)`, `has-user-attribute(...)`, `is-member-of(...)`), and steps such as `disable-user` and `delete-user`, with delays like `after: 24h`. Scheduled workflows (`schedule: after: ..., batch-size: ...`) can sweep matching users regularly. Source: [admin guide, "Managing workflows"](https://www.keycloak.org/docs/latest/server_admin/index.html).
- **Example:** `on: user-created`, `if: has-role(guest)`, `steps: [{uses: delete-user, after: 24h}]`.
- **Caveats:**
  - Due steps run in a background task **every 12 hours by default**. The interval is set with `spi-events-listener--workflow-event-listener--step-runner-task-interval`, so deletion times are approximate.
  - Deleting the Keycloak user does **not** delete the app's User row or the guest's messages. The backend still needs its own cleanup policy, triggered by a schedule or by Keycloak admin events.
  - Deleting the user does not revoke access tokens already issued. They stay valid until they expire.
- **Alternative:** a backend cron job that deletes guest users through the Admin API. It has the same caveats, plus a privileged client secret in the backend.

### E. Transient users ("do not store users"): not viable

- This is an identity-provider (brokering) setting: the IdP model's `transientUsers` flag means users "not stored in Keycloak database" ([Javadoc](https://www.keycloak.org/docs-api/latest/javadocs/org/keycloak/models/IdentityProviderModel.html)). It only applies to users coming from an **external IdP**, so a guest flow would need a separate IdP of our own just to feed it.
- It was never supported. `transient-users:v1` only appears as an option value on the [features page](https://www.keycloak.org/server/features). [keycloak/keycloak#45289](https://github.com/keycloak/keycloak/issues/45289), "Remove experimental transient users", milestone 27.0, says it "is being replaced by workflows". See also [#38108](https://github.com/keycloak/keycloak/issues/38108).
- Not to be confused with **transient sessions**, which are no-refresh sessions used for client-credentials and the JWT Authorization Grant. They are not anonymous users ([admin guide, "Transient sessions"](https://www.keycloak.org/docs/latest/server_admin/index.html)).

### F. Token exchange: V2 cannot, V1 can but is deprecated

Source: the [token exchange guide](https://www.keycloak.org/securing-apps/token-exchange).

- **Standard token exchange V2** (`token-exchange-standard:v2`) has been supported since 26.2 and is on by default. It is internal-to-internal only and needs an existing access token as `subject_token`. **Impersonation is "not implemented yet"** and public clients are not supported. A guest has no token to exchange, so V2 does not help.
- **Legacy V1** (`token-exchange:v1`, preview, off by default) supports **direct naked impersonation**: a confidential client sends `requested_subject=<user>` with no `subject_token`. The guide warns: "It is very risky to enable direct naked impersonation for a client. If the client's credentials are ever stolen, that client can impersonate any user in the system." V1 is deprecated, "will be removed in future versions", and needs the deprecated FGAP v1.

### G. JWT Authorization Grant (supported since 26.6): not viable today

- A **confidential** client exchanges a signed JWT assertion from a trusted issuer for an access token. It "never issues a refresh token", and **"the Keycloak user should be previously linked to the Identity Provider"** ([guide](https://www.keycloak.org/securing-apps/jwt-authorization-grant)). So the backend could only mint assertions for users that already exist and are linked, which brings back option C's provisioning plus a backend signing key.
- Support for users who are not stored persistently is only proposed, not built ([keycloak/keycloak#54087](https://github.com/keycloak/keycloak/issues/54087), open, no milestone).

### H. Client credentials or a service account: not viable

A confidential client's service account can get a token ([admin guide](https://www.keycloak.org/docs/latest/server_admin/index.html)). However, an SPA cannot hold a client secret, so the backend would have to hand out its own service-account token, and every guest would share one `sub`. That is option A with worse security.

### I. Guest session outside Keycloak (app-issued token): contradicts current auth

The forum also suggests letting the app create guest sessions itself ([thread](https://forum.keycloak.org/t/guest-user-and-update-it/12856)). That means the backend trusts a second token issuer, which goes against "the backend only trusts Keycloak-issued JWTs" and the `sub` = User ID rule. It is listed only for completeness.

## Comparison

| Option | Keycloak-native, supported? | Custom code | Distinct guest identity | Fits PKCE + backend-only-validates | Main risk |
|---|---|---|---|---|---|
| A. Shared guest user | Yes (plain user) | None (theme tweak) | No | Yes | Guests share one identity; password/account must be locked down |
| B. Custom authenticator creates user | SPI is supported but marked internal | Keycloak extension jar | Yes | Yes | Breaks on upgrades; unlimited account creation |
| C. Backend Admin API + token route | Admin API yes; token routes deprecated or discouraged | Backend endpoint + privileged secret | Yes | No (second token path) | ROPC, V1 impersonation, or hacks |
| D. Workflows cleanup (with B or C) | Yes, supported since 26.6 | YAML config | n/a | n/a | 12h default granularity; app data still needs its own cleanup |
| E. Transient users | Experimental, being removed in 27.0 | External IdP needed | Yes | No | Being removed |
| F. Token exchange V1 impersonation | Deprecated preview | Backend | Yes | No | Being removed; "very risky" |
| G. JWT Authorization Grant | Supported | Backend signing + pre-linked users | Yes | No | Needs existing linked users |

## What looks viable (not a decision)

- **A (shared guest account)** is the cheapest and fully native. Its cost is in the domain model: guests are one User.
- **B + D (custom authenticator plus Workflows cleanup)** is the only fully supported path that gives each guest their own identity and keeps the hosted-login PKCE architecture. Its cost is maintaining a Keycloak extension and deciding how app-side guest data gets cleaned up.
- C, E, F, G, H, and I either contradict the auth decision or depend on deprecated or experimental features.

## Questions for #9

- Should guests be distinct Users, or is one shared "Guest" User acceptable? This is the main fork between A and B.
- How long do guest accounts and their messages live, and who deletes the app-side data?
- What can a guest do? Read only, or post, create channels, and send DMs? Can a guest see real users' data?
- For a non-public team app, should guest login be on by default or controlled by config?
