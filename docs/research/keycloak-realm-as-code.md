# Keycloak realm as code in docker-compose

Research for [#7](https://github.com/Marcel-Goehn/da-bubble/issues/7) (map [#1](https://github.com/Marcel-Goehn/da-bubble/issues/1)). Researched 2026-10-20.

## Question

How do we configure the DA Bubble realm as code so `docker compose up` gives a working setup? The setup needs:

- a public SPA client with PKCE
- the audience and claims the backend validates
- Google as an identity provider, with its secret handled locally
- SMTP to the mail catcher
- email verification and password reset
- a mounted theme

It also asks which Keycloak version to use, and how the backend's resource server reaches the issuer from inside and outside the compose network (the issuer URL mismatch).

## Recommendation (TL;DR)

1. **Use Keycloak's built-in realm import.** Commit a `keycloak/import/da-bubble-realm.json` and mount it at `/opt/keycloak/data/import`. Start Keycloak with `start-dev --import-realm`, persisting to Postgres. Put secrets in the JSON as `${ENV_VAR}` placeholders, filled from an untracked `.env`. **Do not use keycloak-config-cli or Terraform for v1.** Both add a moving part, and keycloak-config-cli lags the current Keycloak release.
2. **Use Keycloak `quay.io/keycloak/keycloak:26.8.1`**, the latest release (2026-10-13). Pin the exact tag.
3. **Fix the issuer mismatch on the Spring side.** Set `KC_HOSTNAME=http://localhost:8080` so every token's `iss` is `http://localhost:8080/realms/da-bubble`. In the backend, set **both** `issuer-uri` (the public URL, used only to validate `iss`) and `jwk-set-uri` (the compose-internal URL `http://keycloak:8080/...`, used to fetch keys). With both set, Spring Boot never runs discovery against the issuer URL, so the backend never needs to resolve `localhost:8080` from inside the network.
4. **Use an Audience mapper for the audience.** Put it on the SPA client's dedicated scope, with `Included Custom Audience = da-bubble-api`. Set `spring.security.oauth2.resourceserver.jwt.audiences=da-bubble-api` in the backend.

## 1. Import JSON vs keycloak-config-cli vs Terraform

| Option | How it applies | Updates an existing realm? | Extra moving parts | Fit for v1 |
|---|---|---|---|---|
| **Built-in `--import-realm`** | Keycloak reads `data/import/*.json` at startup | **No.** "If a realm already exists in the server, the import operation is skipped." [1] | None | **Chosen** |
| keycloak-config-cli | One-shot container calls the Admin API | Yes, idempotent, with remote state [3] | Extra container, admin credentials, wait-for-Keycloak | Upgrade path |
| Terraform provider | `terraform apply` against the Admin API | Yes | Terraform toolchain plus state file, outside `docker compose up` | No |

Evidence:

- **Built-in import.** `start --import-realm` makes the server "try to import any realm configuration file from the `data/import` directory". Only regular `.json` files are read, and sub-directories are ignored. In the container the directory is `/opt/keycloak/data/import` [1][2]. The containers guide shows exactly `-v /path/to/realm/data:/opt/keycloak/data/import ... start-dev --import-realm` [2].
- **Placeholders in the import file.** "You are able to use placeholders to resolve values from environment variables for any realm configuration", for example `"realm": "${MY_REALM_NAME}"` [1]. In the source, `AbstractFileBasedImportProvider` runs the file through `StringPropertyReplacer.replaceProperties` with a resolver that reads `System.getenv` [9]. `StringPropertyReplacer` also supports defaults (`${p:v}`), and it leaves unresolved references unchanged [10]. That second point matters: Keycloak's own `${role_...}` i18n keys in exported JSON survive the substitution.
- **keycloak-config-cli.** It provides "declarative, idempotent configuration for Keycloak via the Admin API". Its stated support policy is "the latest 4 releases of keycloak, if possible" [3]. The latest release is v6.5.1 (2026-05-22). Its CI matrix tests Keycloak only up to **26.5.5** [4][5], while Keycloak is at 26.8.1. Variable substitution is off by default (`import.var-substitution.enabled`) and uses `$(env:VAR)` syntax [3].
- **Terraform.** The provider is now `keycloak/terraform-provider-keycloak` (v5.10.0, 2026-10-05) [6]. It needs a separate toolchain and a state file, which does not fit "just `docker compose up`".

**Trade-off we accept.** With built-in import, editing the realm JSON does **not** change an existing realm. To pick up realm changes locally, drop Keycloak's database (for example `docker compose down -v`, or a dedicated `keycloak` database or volume you can reset). Alternatively, re-run the `import` command explicitly before startup [1]. For a small team on a local-only setup, this is cheaper than running another tool. If in-place updates become a real pain later, switch to keycloak-config-cli. It reads the same realm-export JSON format [3], so the file carries over, but the placeholder syntax changes from `${VAR}` to `$(env:VAR)`.

**Authoring workflow.** Build the realm once by hand in the admin console. Export it with `kc.sh export --realm da-bubble --file ...` [1] and strip the noise (generated ids, default clients and scopes you do not change, keys). Commit the trimmed JSON and replace secrets with `${...}` placeholders.

## 2. Keycloak version

- The latest release is **26.8.1**, published 2026-10-13 [7]. The image is `quay.io/keycloak/keycloak` [7], and quay has the tags `26.8.1` and `26.8` [8].
- Pin `quay.io/keycloak/keycloak:26.8.1`, not `latest`. The realm JSON export format and the defaults change between minors.
- Use `start-dev` for local work. It is "strictly avoided in production environments" [2], but production is out of scope for v1.
- Set the bootstrap admin with `KC_BOOTSTRAP_ADMIN_USERNAME` and `KC_BOOTSTRAP_ADMIN_PASSWORD` [2].
- Use the shared Postgres (`KC_DB=postgres` plus `KC_DB_URL`, user and password) instead of the dev H2 database. Imported state then survives restarts, and resetting it is an explicit step.
- Health endpoints need `KC_HEALTH_ENABLED=true`. They are served at `/health/ready` on management port 9000 [2].

## 3. Realm contents and their JSON fields

All of these are top-level `RealmRepresentation` fields unless noted [11].

| Requirement | Realm JSON |
|---|---|
| Realm | `"realm": "da-bubble", "enabled": true` |
| Self-registration | `"registrationAllowed": true` (if the Figma has sign-up) |
| Email verification | `"verifyEmail": true` |
| Password reset | `"resetPasswordAllowed": true`. The docs recommend enabling Forgot password together with Verify email, so users who miss the verification email are not stuck [12]. |
| Login with email | `"loginWithEmailAllowed": true`, `"duplicateEmailsAllowed": false` |
| SMTP to the mail catcher | `"smtpServer": { "host": "mailcatcher", "port": "1025", "from": "noreply@da-bubble.local", "fromDisplayName": "DA Bubble", "auth": "false", "ssl": "false", "starttls": "false" }`. Keys as read by `DefaultEmailSenderProvider`: `host`, `port`, `from`, `fromDisplayName`, `replyTo`, `envelopeFrom`, `auth`, `authType`, `user`, `password`, `ssl`, `starttls` [13]. The host is the mail catcher's compose service name. |
| Themes | `"loginTheme": "da-bubble"`, `"emailTheme": "da-bubble"` |

### Public SPA client with PKCE

In `clients[]`:

```json
{
  "clientId": "da-bubble-spa",
  "publicClient": true,
  "standardFlowEnabled": true,
  "implicitFlowEnabled": false,
  "directAccessGrantsEnabled": false,
  "redirectUris": ["http://localhost:4200/*"],
  "webOrigins": ["http://localhost:4200"],
  "attributes": {
    "pkce.code.challenge.method": "S256",
    "post.logout.redirect.uris": "http://localhost:4200/*"
  },
  "protocolMappers": [{
    "name": "da-bubble-api-audience",
    "protocol": "openid-connect",
    "protocolMapper": "oidc-audience-mapper",
    "config": {
      "included.custom.audience": "da-bubble-api",
      "access.token.claim": "true",
      "id.token.claim": "false"
    }
  }]
}
```

- **PKCE.** Setting the PKCE method to `S256` makes Keycloak *require* S256 for this client. With the field blank, PKCE is optional [12].
- **Audience.** By default an access token for `da-bubble-spa` has no audience that names the backend. The Keycloak docs recommend limiting each token to a few audiences and having each service verify `aud` [12]. The Audience mapper adds a fixed value to the access token's `aud`. "Included Custom Audience" is used when "Included Client Audience" is empty, so no backend client is needed [12][14]. The mapper's config key names (`included.custom.audience`, `access.token.claim`) should be confirmed against a real export from 26.8.1 when the file is authored.
- **Claims the backend uses.** `sub` (the User primary key, per ADR 0001), `email`, `email_verified`, `name`/`given_name`/`family_name`, `preferred_username`. All of these come from the default `profile`, `email` and `basic` scopes. No custom mapper is needed beyond the audience mapper.

### Google identity provider and its secret

In `identityProviders[]` [11]:

```json
{
  "alias": "google",
  "providerId": "google",
  "enabled": true,
  "trustEmail": true,
  "config": {
    "clientId": "${GOOGLE_CLIENT_ID:unset}",
    "clientSecret": "${GOOGLE_CLIENT_SECRET:unset}",
    "defaultScope": "openid profile email",
    "syncMode": "IMPORT"
  }
}
```

- **Setup.** Create a Google OAuth client of type "Web application" and register Keycloak's broker redirect URI as an authorized redirect URI. Copy the Client ID and Client Secret into the IdP. The default scopes are `openid profile email` [12]. Locally the redirect URI is `http://localhost:8080/realms/da-bubble/broker/google/endpoint`, which the admin console shows as "Redirect URI".
- **`trustEmail: true`.** "If the realm requires email validation, users that log in from this identity provider do not need to perform the email verification process" [12]. Google-verified addresses skip our verification email.
- **Secrets.** Keycloak substitutes `${GOOGLE_CLIENT_ID}` and `${GOOGLE_CLIENT_SECRET}` from its own environment at import time [1][9]. Compose passes them in from an untracked `.env` next to `compose.yaml`, which Compose loads automatically [15]. Commit a `.env.example`. The `:unset` default keeps `docker compose up` working for developers without Google credentials: only the Google button fails. Use `${GOOGLE_CLIENT_SECRET:?...}` in `compose.yaml` instead if a missing secret should be a hard error [15].
- **Caveat.** The secret is substituted once, at first import, and is then stored in Keycloak's database. Changing `.env` later needs a realm reset, the same as any other realm change.

### Theme mount

- Themes go in the server distribution's `themes/` directory [16]. Mount `./keycloak/themes/da-bubble` at `/opt/keycloak/themes/da-bubble`.
- During theme development, start with `--spi-theme--static-max-age=-1 --spi-theme--cache-themes=false --spi-theme--cache-templates=false`, so edits show without a restart [16].

## 4. The issuer URL mismatch

**The problem.** The browser reaches Keycloak at `http://localhost:8080`. The backend container reaches it at `http://keycloak:8080`. The backend must validate `iss` against what the browser-obtained token says, but it cannot reach `localhost:8080` from inside its container.

**What Keycloak puts in `iss`.** The issuer is always built from the **frontend** URL. Endpoints such as `jwks_uri` and `token_endpoint` use the **backchannel** URL. From `OIDCWellKnownProvider` [17]:

```java
config.setIssuer(Urls.realmIssuer(frontendUriInfo.getBaseUri(), realm.getName()));
...
config.setJwksUri(jwksUri.toString()); // built from backendUriInfo
```

- Setting `--hostname` to a full URL fixes the frontend URL. Explicitly setting it means "we avoid a situation where tokens could be issued by a fraudulent issuer" [18].
- `--hostname-backchannel-dynamic true` resolves backchannel URLs from the request, for "your application accesses Keycloak via a private network". It requires `hostname` to be a full URL [18].
- So with `KC_HOSTNAME=http://localhost:8080` (and optionally `KC_HOSTNAME_BACKCHANNEL_DYNAMIC=true`), every token has `iss = http://localhost:8080/realms/da-bubble`, whichever URL the user or backend used.

**What Spring Boot 4.1.1 does with the properties.**

- If **only `issuer-uri`** is set, Boot builds `NimbusJwtDecoder.withIssuerLocation(issuerUri)` inside a `SupplierJwtDecoder` [19]. That means lazy OIDC discovery against the issuer URL on the first request [20]. From inside the container, `http://localhost:8080` is the backend itself, so this fails.
- If **`jwk-set-uri` is set**, `IssuerUriCondition` returns no match ("found jwk-set-uri property"), and Boot uses `NimbusJwtDecoder.withJwkSetUri(jwkSetUri)` instead [21][19]. `issuer-uri` is still honored: `getValidator()` adds `new JwtIssuerValidator(issuerUri)` whenever `issuer-uri` is set, and it adds an `aud` validator when `audiences` is non-empty [19].
- The Spring Security docs describe exactly this: "Resource Server will not ping the authorization server at startup. We still specify the `issuer-uri` so that Resource Server still validates the `iss` claim on incoming JWTs" [20].

**Backend configuration (in compose):**

```yaml
spring:
  security:
    oauth2:
      resourceserver:
        jwt:
          issuer-uri: http://localhost:8080/realms/da-bubble          # only compared to iss
          jwk-set-uri: http://keycloak:8080/realms/da-bubble/protocol/openid-connect/certs  # fetched over the compose network
          audiences: da-bubble-api
```

- When the backend runs on the host (from an IDE), override `jwk-set-uri` to `http://localhost:8080/...` through an env var or profile. `issuer-uri` stays the same.
- Keys are fetched lazily, so the backend does not need `depends_on: keycloak: condition: service_healthy` to start [20].

**Rejected alternatives.**

- Making `keycloak` resolvable from the browser through an `/etc/hosts` entry adds a manual step per developer.
- `extra_hosts: "localhost:host-gateway"` is fragile.
- Disabling issuer validation is a security regression.

## Proposed compose sketch (illustrative, not verified by running)

```yaml
keycloak:
  image: quay.io/keycloak/keycloak:26.8.1
  command: ["start-dev", "--import-realm"]
  environment:
    KC_BOOTSTRAP_ADMIN_USERNAME: admin
    KC_BOOTSTRAP_ADMIN_PASSWORD: admin
    KC_HOSTNAME: http://localhost:8080
    KC_HOSTNAME_BACKCHANNEL_DYNAMIC: "true"
    KC_HEALTH_ENABLED: "true"
    KC_DB: postgres
    KC_DB_URL: jdbc:postgresql://postgres:5432/keycloak
    KC_DB_USERNAME: keycloak
    KC_DB_PASSWORD: keycloak
    KC_SPI_THEME__CACHE_THEMES: "false"
    KC_SPI_THEME__CACHE_TEMPLATES: "false"
    KC_SPI_THEME__STATIC_MAX_AGE: "-1"
    GOOGLE_CLIENT_ID: ${GOOGLE_CLIENT_ID:-unset}
    GOOGLE_CLIENT_SECRET: ${GOOGLE_CLIENT_SECRET:-unset}
  ports: ["8080:8080"]
  volumes:
    - ./keycloak/import:/opt/keycloak/data/import:ro
    - ./keycloak/themes/da-bubble:/opt/keycloak/themes/da-bubble:ro
  depends_on: [postgres]
```

The env-var form of the theme SPI options (`KC_SPI_THEME__...`) is derived from the CLI option names in [16]. Confirm it when implementing, or pass the options as CLI flags.

## Open points for implementation

- Confirm the exact mapper config keys and IdP fields against an export from 26.8.1, rather than hand-writing them.
- Decide the mail catcher's service name and port, and the Keycloak database (separate database vs schema in the shared Postgres). Both belong to the compose-topology decision.
- Decide whether `registrationAllowed` is on. That depends on the Figma inventory.

## Sources

1. Keycloak, *Importing and exporting realms*: https://www.keycloak.org/server/importExport
2. Keycloak, *Running Keycloak in a container*: https://www.keycloak.org/server/containers
3. adorsys/keycloak-config-cli README: https://github.com/adorsys/keycloak-config-cli
4. keycloak-config-cli releases (v6.5.1, 2026-05-22) and CHANGELOG: https://github.com/adorsys/keycloak-config-cli/releases, https://github.com/adorsys/keycloak-config-cli/blob/main/CHANGELOG.md
5. keycloak-config-cli CI matrix (tests Keycloak 26.0.5, 26.1.0, 26.5.5): https://github.com/adorsys/keycloak-config-cli/blob/main/.github/workflows/ci.yaml
6. keycloak/terraform-provider-keycloak (v5.10.0): https://github.com/keycloak/terraform-provider-keycloak
7. Keycloak downloads (26.8.1) and GitHub release: https://www.keycloak.org/downloads, https://github.com/keycloak/keycloak/releases/tag/26.8.1
8. quay.io image tags: https://quay.io/repository/keycloak/keycloak?tab=tags
9. Keycloak source, `AbstractFileBasedImportProvider`: https://github.com/keycloak/keycloak/blob/main/model/storage-services/src/main/java/org/keycloak/exportimport/AbstractFileBasedImportProvider.java
10. Keycloak source, `StringPropertyReplacer`: https://github.com/keycloak/keycloak/blob/main/common/src/main/java/org/keycloak/common/util/StringPropertyReplacer.java
11. Keycloak source, `RealmRepresentation`: https://github.com/keycloak/keycloak/blob/main/core/src/main/java/org/keycloak/representations/idm/RealmRepresentation.java
12. Keycloak, *Server Administration Guide* (Google IdP, Trust Email, Verify email, PKCE method, Audience support): https://www.keycloak.org/docs/latest/server_admin/index.html
13. Keycloak source, `DefaultEmailSenderProvider`: https://github.com/keycloak/keycloak/blob/main/services/src/main/java/org/keycloak/email/DefaultEmailSenderProvider.java
14. Keycloak, *Protocol mappers* (admin API): https://www.keycloak.org/admin-api/protocol-mappers
15. Docker, *Compose variable interpolation*: https://docs.docker.com/compose/how-tos/environment-variables/variable-interpolation/
16. Keycloak, *Working with themes*: https://www.keycloak.org/ui-customization/themes
17. Keycloak source, `OIDCWellKnownProvider`: https://github.com/keycloak/keycloak/blob/main/services/src/main/java/org/keycloak/protocol/oidc/OIDCWellKnownProvider.java
18. Keycloak, *Configuring the hostname (v2)*: https://www.keycloak.org/server/hostname
19. Spring Boot v4.1.1 source, `JwtDecoderConfiguration`: https://github.com/spring-projects/spring-boot/blob/v4.1.1/module/spring-boot-security-oauth2-resource-server/src/main/java/org/springframework/boot/security/oauth2/server/resource/autoconfigure/JwtDecoderConfiguration.java
20. Spring Security, *OAuth 2.0 Resource Server JWT*: https://docs.spring.io/spring-security/reference/servlet/oauth2/resource-server/jwt.html
21. Spring Boot v4.1.1 source, `IssuerUriCondition`: https://github.com/spring-projects/spring-boot/blob/v4.1.1/module/spring-boot-security-oauth2-resource-server/src/main/java/org/springframework/boot/security/oauth2/server/resource/autoconfigure/IssuerUriCondition.java
