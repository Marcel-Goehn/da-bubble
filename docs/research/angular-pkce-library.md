# Which Angular library runs the PKCE flow against Keycloak?

Research for [#4](https://github.com/Marcel-Goehn/da-bubble/issues/4) (map: [#1](https://github.com/Marcel-Goehn/da-bubble/issues/1)). Checked 2026-10-20 against npm, GitHub, and the official docs. The frontend is on Angular `^22.2.0` (`frontend/package.json`).

## Recommendation

Use **`keycloak-angular` 22.x together with the official `keycloak-js` adapter**, with `keycloak-js` pinned to the same major version as the Keycloak server.

- Auth is already settled on Keycloak hosted login (map #1 Notes / ADR 0001), so a generic OIDC client buys us nothing. `keycloak-js` is Keycloak's own adapter, maintained in the `keycloak` GitHub org. It does Authorization Code + PKCE (S256 by default), handles the redirect callback in `init()`, and has `login()`, `logout()`, `register()` and `updateToken()`.
- `keycloak-angular` 22 needs Angular `^22` and is built for standalone apps only: `provideKeycloak` with `provideAppInitializer`, a functional `includeBearerTokenInterceptor`, auth events exposed as a **signal** (`KEYCLOAK_EVENT_SIGNAL`), and `withAutoRefreshToken`, which can also log users out after inactivity.
- **Fallback:** `angular-auth-oidc-client` 22.x. It is the most actively released of the three, certified by the OpenID Foundation, and exposes `authenticated` / `userData` signals and a functional `authInterceptor()`. Switch to it if `keycloak-angular` is slow to support Angular 23, or if we ever need to work with any OIDC provider rather than Keycloak only.

## Comparison

| | keycloak-angular + keycloak-js | angular-auth-oidc-client | angular-oauth2-oidc |
|---|---|---|---|
| Latest / Angular peer | 22.0.0 (2026-06-15), `@angular/core ^22`; keycloak-js 26.2.4 (2026-04-22) | 22.0.2 (2026-10-18), `@angular/core >=20` | 22.0.2 (2026-06-26), `@angular/core >=22` |
| Weekly downloads (Oct 12–18, 2026) | 78k (keycloak-js 577k) | 78k | 222k |
| Repo activity | last push 2026-09-28, 51 open issues; keycloak-js last push 2026-10-19 | last push 2026-10-19, 269 open issues | last push 2026-07-05, 310 open issues |
| Standalone setup | `provideKeycloak({config, initOptions, features})`; the NgModule `KeycloakService` API has been deprecated since v19 | `provideAuth(...)`, `ng add --standalone` | `provideOAuthClient()` |
| Signals | `KEYCLOAK_EVENT_SIGNAL` (auth, logout and token events) | `authenticated`, `userData` signals on `OidcSecurityService` | none documented (RxJS events) |
| PKCE | keycloak-js `pkceMethod: 'S256'` (default) | Code flow + PKCE (RFC 7636) | Code flow + PKCE with `responseType: 'code'` |
| Token refresh | `withAutoRefreshToken` (refreshes on expiry, inactivity timeout → logout); `updateToken(minValidity)` | `silentRenew` + `useRefreshToken` | refresh token + automatic refresh before expiry |
| HTTP bearer | functional `includeBearerTokenInterceptor` + URL/method conditions; off by default | functional `authInterceptor()` + `secureRoutes` prefix match | built-in `sendAccessToken` / custom interceptor |
| Post-login redirect | `init({onLoad})` parses the callback; `redirectUri` | `checkAuth()` on the callback route | `loadDiscoveryDocumentAndTryLogin()` |
| Logout | `keycloak.logout({redirectUri})` (RP-initiated) | `logoff()` with `postLogoutRedirectUri` | `logOut()` / `revokeTokenAndLogout()` |
| Keycloak-specific | `register()`, `accountManagement()`, realm/resource role helpers | generic OIDC (Keycloak supported) | generic OIDC (Keycloak used in testing) |

## Notes per concern

- **Websocket:** none of the three libraries attaches tokens to websocket connections; their interceptors only cover `HttpClient`. With keycloak-js, call `await keycloak.updateToken(30)` and then pass `keycloak.token` in the handshake, e.g. a STOMP `CONNECT` header (preferred) or a query parameter. The backend must validate it at connect time. This affects the real-time research ticket.
- **Silent SSO / third-party cookies:** the Keycloak docs warn that the session-status iframe and silent `check-sso` rely on third-party cookies, which browsers increasingly block. Use `onLoad: 'login-required'` for the app shell, or `check-sso` without `silentCheckSsoRedirectUri`, and rely on refresh tokens rather than iframes. The generic libraries have the same iframe caveat for silent renew, and the same fix (refresh tokens).
- **Version matching:** keycloak-angular follows Angular's major version and only actively supports the latest Angular major. The Keycloak docs recommend matching the keycloak-js version to the server.
- **Registration:** the Figma signup can go straight to Keycloak's registration page with `keycloak.register()`. Generic libraries need custom auth params (e.g. `prompt=create`) to do the same.

## Sources

- npm metadata (`npm view <pkg> version time peerDependencies`) and npm downloads API, 2026-10-20: [keycloak-angular](https://www.npmjs.com/package/keycloak-angular), [keycloak-js](https://www.npmjs.com/package/keycloak-js), [angular-auth-oidc-client](https://www.npmjs.com/package/angular-auth-oidc-client), [angular-oauth2-oidc](https://www.npmjs.com/package/angular-oauth2-oidc)
- keycloak-angular README (versions table, provideKeycloak, interceptors, event signal, auto refresh, deprecations): https://github.com/mauriciovigolo/keycloak-angular ; [docs/provide.md](https://github.com/mauriciovigolo/keycloak-angular/blob/main/docs/provide.md) ; [docs/interceptors.md](https://github.com/mauriciovigolo/keycloak-angular/blob/main/docs/interceptors.md)
- Keycloak JavaScript adapter guide (pkceMethod S256 default, responseMode, updateToken, onTokenExpired, third-party cookie limits): https://www.keycloak.org/securing-apps/javascript-adapter ; repo https://github.com/keycloak/keycloak-js
- angular-auth-oidc-client README (PKCE, refresh tokens, provideAuth, certification): https://github.com/damienbod/angular-auth-oidc-client ; [interceptors docs](https://github.com/damienbod/angular-auth-oidc-client/blob/main/docs/site/angular-auth-oidc-client/docs/documentation/interceptors.md) ; signals in [oidc.security.service.ts](https://github.com/damienbod/angular-auth-oidc-client/blob/main/projects/angular-auth-oidc-client/src/lib/oidc.security.service.ts)
- angular-oauth2-oidc README (Angular 22 support, provideOAuthClient, code flow + PKCE, logout, refresh): https://github.com/manfredsteyer/angular-oauth2-oidc
- GitHub repo API (`pushed_at`, `open_issues_count`), 2026-10-20.
