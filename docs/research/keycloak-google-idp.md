# Google login in the Keycloak realm

Research for [#15](https://github.com/Marcel-Goehn/da-bubble/issues/15). This covers Keycloak 26.8.1 (the version pinned in #7) with the hand-written `dabubble` login theme (#5) and the registration flow from #11. Source links point at the `26.8.1` tag.

## TL;DR

1. **Realm JSON.** Add one `identityProviders[]` entry with `providerId: "google"`, `trustEmail: true`, and `clientId`/`clientSecret` as `${GOOGLE_CLIENT_ID:unset}` / `${GOOGLE_CLIENT_SECRET:unset}`. Add two `identityProviderMappers[]` entries of type `google-user-attribute-mapper`, one mapping `name` to `firstName` and one mapping `picture` to `picture`. In the Google Cloud console, create a "Web application" OAuth client with redirect URI `http://localhost:8080/realms/da-bubble/broker/google/endpoint`. Plain HTTP is allowed for localhost.
2. **Button.** `login.ftl` gets a `social.providers` list. Each entry has `alias`, `displayName`, `loginUrl`, `iconClasses` and `providerId`. The theme renders "Anmelden mit Google" as an `<a href="${p.loginUrl}">`. The base template shows the list only when `realm.password && social?? && social.providers?has_content` is true.
3. **New email.** Keycloak's default `first broker login` flow creates the account silently, with no extra screen. Review Profile is set to `missing`, and Google supplies email and name. With `trustEmail: true`, `emailVerified` is copied from Google's `email_verified` claim, so our verification email is skipped. The privacy checkbox (Terms and conditions) is skipped too. The user then goes on into the app.
4. **Existing email.** Keycloak does **not** auto-link. Instead it shows `login-idp-link-confirm.ftl`, then sends a link email (`login-idp-link-email.ftl`). As a fallback, the user can re-authenticate with their password. After that, the Google identity is linked to the existing `sub`. That means two or three more templates to theme.
5. **Claims.** Google sends `sub`, `email`, `email_verified`, `name`, `given_name`, `family_name` and `picture`. `name` and `picture` are "never guaranteed". **Keycloak's own token**, which is what the backend sees, carries the Keycloak user's values. `email_verified` comes from the user's `emailVerified` flag. `name` is built from firstName + lastName. `picture` appears only if the user has a `picture` attribute, which needs the mapper above and a `picture` attribute declared in the User Profile. `sub` is the Keycloak user id, not Google's.

## 1. Declaring the IdP in the realm JSON

`IdentityProviderRepresentation` fields in 26.8.1 [R1]: `alias`, `displayName`, `providerId`, `enabled` (default `true`), `trustEmail`, `storeToken`, `linkOnly`, `hideOnLogin` (a **top-level** field in 26.x, not a `config` key), `firstBrokerLoginFlowAlias`, `postBrokerLoginFlowAlias` and `config`. The Google-specific `config` keys are `hostedDomain`, `userIp` and `offlineAccess` [R2]. The Google provider hard-codes its endpoints and the default scope `openid profile email` [R3].

```json
"identityProviders": [
  {
    "alias": "google",
    "providerId": "google",
    "displayName": "Google",
    "enabled": true,
    "trustEmail": true,
    "storeToken": false,
    "linkOnly": false,
    "hideOnLogin": false,
    "firstBrokerLoginFlowAlias": "first broker login",
    "config": {
      "clientId": "${GOOGLE_CLIENT_ID:unset}",
      "clientSecret": "${GOOGLE_CLIENT_SECRET:unset}",
      "defaultScope": "openid profile email",
      "syncMode": "IMPORT",
      "guiOrder": "1"
    }
  }
],
"identityProviderMappers": [
  {
    "name": "full name",
    "identityProviderAlias": "google",
    "identityProviderMapper": "google-user-attribute-mapper",
    "config": { "jsonField": "name", "userAttribute": "firstName", "syncMode": "INHERIT" }
  },
  {
    "name": "picture",
    "identityProviderAlias": "google",
    "identityProviderMapper": "google-user-attribute-mapper",
    "config": { "jsonField": "picture", "userAttribute": "picture", "syncMode": "INHERIT" }
  }
]
```

- **Placeholders.** These follow #7. `${VAR:default}` is resolved from Keycloak's environment at import time, and `.env` feeds the values through compose. With the `:unset` default, `docker compose up` still works without credentials, and only the Google button fails.
- **Google Cloud setup** [R4]: create an OAuth consent screen with user type *External*. Then create an OAuth Client ID of type *Web application* and paste Keycloak's Redirect URI as an authorized redirect URI. The broker endpoint is `{issuer}/broker/{alias}/endpoint`, so here it is `http://localhost:8080/realms/da-bubble/broker/google/endpoint`. Google requires HTTPS redirect URIs, but "Localhost URIs (including localhost IP address URIs) are exempt from this rule" [G2].
- **`hostedDomain`** would restrict sign-in to one Google Workspace domain [R4]. The check compares the token's `hd` claim with the configured list and is skipped when the value is unset or `*` [R3]. It is not needed for v1 unless the team all shares one Workspace domain.
- **`syncMode: IMPORT`.** Profile data is taken only when the user is first created. `FORCE` would overwrite first and last name on every login [R7]. That would undo a user renaming themselves in the app, so IMPORT fits, because v1 lets users edit their name (#3).
- **Mapper type.** For the `google` provider, the JSON attribute importer is `GoogleUserAttributeMapper` (`google-user-attribute-mapper`, compatible only with `google`). It extends `AbstractJsonUserAttributeMapper` and has the config keys `jsonField` and `userAttribute` [R5][R6]. It reads the stored UserInfo JSON. Google's provider sets a UserInfo URL (`https://openidconnect.googleapis.com/v1/userinfo`) [R3], and `OIDCIdentityProvider` calls it unless the UserInfo service is disabled [R8].

## 2. How the themed login page renders the button

The base `login.ftl` [R9]:

```ftl
<#if realm.password && social?? && social.providers?has_content>
  ... ${msg("identity-provider-login-label")} ...
  <#list social.providers as p>
    <a data-once-link id="social-${p.alias}" type="button" href="${p.loginUrl}">
      <#if p.iconClasses?has_content><i class="... ${p.iconClasses!}"></i></#if>
      <span>${p.displayName!}</span>
    </a>
  </#list>
</#if>
```

- `social.providers` is built by `IdentityProviderBean` [R10]. It includes only IdPs that are "enabled, not link-only, and not set to be hidden on login page", and it is sorted by `guiOrder`. Each entry exposes `alias`, `providerId`, `loginUrl`, `guiOrder`, `displayName`, `iconClasses` and `themeConfig`.
- `iconClasses` comes from the theme property `kcLogoIdP-google` (by alias or by providerId), and otherwise from the provider's display icon classes [R10]. Our theme doesn't use PatternFly icons, so it should ignore `iconClasses` and inline the Google "G" SVG from the Figma.
- **For DA Bubble:** in the hand-written `login.ftl`, loop over `social.providers` (or pick `p.alias == "google"`) and render the Figma's "Anmelden mit Google" button as `<a href="${p.loginUrl}">`. `loginUrl` already carries the session/tab parameters, so it must not be built by hand. Keep the `realm.password` guard. Wrapping the block in `<#if social.providers?has_content>` makes the button disappear cleanly when the IdP is disabled.
- The Figma shows the button only on the login card. `register.ftl` doesn't need it.

## 3. First broker login: new vs existing email

The default `first broker login` flow in 26.8.1 [R11]:

```
first broker login
├─ Review Profile (idp-review-profile)            REQUIRED   update.profile.on.first.login = "missing"
└─ User creation or linking                         REQUIRED
   ├─ Create User If Unique (idp-create-user-if-unique)  ALTERNATIVE  require.password.update.after.registration = false
   └─ Handle Existing Account                          ALTERNATIVE
      ├─ Confirm Link Existing Account (idp-confirm-link)       REQUIRED
      └─ Account verification options                          REQUIRED
         ├─ Verify Existing Account By Email (idp-email-verification)  ALTERNATIVE
         └─ Verify Existing Account by Re-authentication               ALTERNATIVE
            ├─ idp-username-password-form   REQUIRED
            └─ First broker login - Conditional 2FA  CONDITIONAL
```

(An Organization sub-flow is added only when the ORGANIZATION feature is on.)

### New email (no Keycloak user with that email)

1. **Review Profile, `missing` mode.** The profile page (`idp-review-user-profile.ftl`) appears only "if the identity provider does not provide mandatory information" [R12]. Our User Profile requires email and `firstName` ("Name", per #5). Google normally sends both, so the page is skipped. If Google sends no name, the page appears, so it needs theming as a fallback.
2. **Create User If Unique** finds no duplicate by email or username and creates the user [R13]. With "Email as username" on (#5), the username is the Google email: `realm.isRegistrationEmailAsUsername() ? brokerContext.getEmail() : ...`. Brokered attributes are copied onto the user. No password is set, and `require.password.update.after.registration` is `false`.
3. **Email verified.** After creation, `IdentityBrokerService.afterFirstBrokerLogin` calls `idp.updateBrokeredUser`, then `updateEmail`, then `setEmailVerified` [R7][R14]. `OIDCIdentityProvider.setEmailVerified` copies Google's `email_verified` claim into the user's `emailVerified` when `trustEmail` is true and the claim is present. Otherwise, the base class sets `emailVerified = trustEmail` for a new user [R8][R14]. So a Gmail user is verified and Keycloak doesn't send a VERIFY_EMAIL mail. A Google account whose `email_verified` is false would still get the verify-email step, which is consistent with the backend rejecting `email_verified=false` (#11).
4. **Skipped steps.** The registration form (`register.ftl`) is never shown to Google users. That means **the privacy checkbox (Terms and conditions registration action, #11) is skipped**, along with the set-password and verify-email steps. The user lands in the app logged in, and the backend provisions them just in time from `sub`.

### Existing email (a local account with the same email exists)

1. Create User If Unique detects the duplicate and stores `EXISTING_USER_INFO`. The flow falls through to **Handle Existing Account** [R13].
2. **Confirm Link Existing Account** shows `login-idp-link-confirm.ftl`: "users see a Keycloak account with the same email" and "can confirm that they want to link" [R12].
3. **Verify Existing Account By Email** sends a link to the existing address and shows `login-idp-link-email.ftl`. It runs only when the realm has SMTP; we do, via the mail catcher. Without SMTP it calls `attempted()` [R15]. This step does **not** short-circuit on `trustEmail` [R15]. The fallback is **re-authentication** with the existing account's password (`idp-username-password-form`) [R11][R12].
4. Once the user has confirmed, the Google identity is linked to the existing user and their `sub` stays the same. Later Google logins go straight in: `authenticated()` finds the federated link and calls `updateFederatedIdentity` [R7].

**Auto-linking is possible but risky.** A custom flow with *Create User If Unique* plus *Automatically Set Existing User*, both ALTERNATIVE, links without prompting. Keycloak warns this "is dangerous in a generic environment where users can register themselves using arbitrary usernames or email addresses" [R12]. In DA Bubble anyone can register and an account can stay unverified (#11). An attacker could pre-register a victim's email with their own password, and auto-linking would then hand the victim's Google login an account the attacker can also enter. **Keep the default flow.**

## 4. Which claims arrive

### From Google (to Keycloak)

From Google's OpenID Connect docs [G1]:

| Claim | Scope | Present? |
|---|---|---|
| `sub` | always | always. "unique among all Google Accounts and never reused". Google says to use `sub`, not `email`, as the identifier. |
| `email`, `email_verified` | `email` | when `email` is requested |
| `name`, `picture` | `profile` | "never guaranteed to be present" |
| `given_name`, `family_name`, `locale` | `profile` | "Might be provided when a name claim is present" |
| `hd` | none | only for Google Workspace / Cloud org accounts |

Keycloak's `OIDCIdentityProvider.extractIdentity` [R8] reads the ID token and then UserInfo, which overrides it. It sets `firstName = given_name` and `lastName = family_name`. `name` is used (split at the last space) only when both are null. `email` is taken from the claim. `email_verified` is stored in the context data for `setEmailVerified`. **`picture` is not mapped by default.** It is only in the stored UserInfo JSON for mappers.

### In DA Bubble's Keycloak tokens (what the backend and Angular see)

Keycloak issues its own tokens. The claims come from the Keycloak user through the default client scopes [R16]:

- `sub` is the **Keycloak** user id, which is the User primary key per ADR 0001. Google's `sub` is stored only in the federated-identity link.
- `email` and `email_verified` come from the `email` scope. `email_verified` is a `UserPropertyMapper` over `emailVerified`, so for Google users it reflects the step 3 result above.
- `name`, `given_name`, `family_name` come from the `profile` scope's full-name / given-name / family-name mappers.
- `picture` comes from the `profile` scope's built-in `picture` mapper, which reads the **user attribute `picture`**: `createUserAttributeMapper(PICTURE, "picture", IDToken.PICTURE, "String")` [R16]. It is empty unless the user has that attribute.

### Two things that need config because of decisions in #5

1. **The full name in a single "Name" field.** #5 deletes `lastName` from the User Profile and keeps Unmanaged Attributes disabled. With the default import, Google's `given_name` lands in `firstName`, and `family_name` goes into a `lastName` that the profile doesn't keep. The `name` claim would then say just "Max" instead of "Max Mustermann". The fix is the `name` to `firstName` attribute importer in section 1. `AbstractJsonUserAttributeMapper.preprocessFederatedIdentity` puts it into the brokered context attributes [R6], and Create User If Unique copies those onto the new user [R13]. **This precedence (mapper attribute over the default given_name) should be confirmed in the prototype.** It runs through `SerializedBrokeredIdentityContext`, which I did not trace to the end.
2. **`picture`.** Only needed if the Google photo is used. It needs the `picture` to `picture` importer **and** a `picture` attribute declared in the User Profile, because Unmanaged Attributes are disabled and undeclared attributes would not be stored. Then the built-in `picture` mapper puts it in the token with no further mapper.

## Open decisions this surfaces

1. **Privacy consent for Google users.** Google sign-up skips `register.ftl`, so it skips the Terms and conditions checkbox. Options:
   - (a) Accept that, and rely on the legal links in the app.
   - (b) Enable the `TERMS_AND_CONDITIONS` required action as a default action for new users. That also hits email registrations, which already consented, unless it is only added to Google users through a custom first-broker-login step.
   - (c) Add it to the first broker login flow with a custom flow.
2. **Google profile photo as Avatar.** v1 has an Avatar choice step after sign-up and Avatar upload (#3). The options are to offer the Google `picture` URL as a preselected Avatar, or to ignore it. If it is ignored, drop the picture mapper and the User Profile attribute.
3. **Do Google users go through the Avatar step?** The Avatar step follows registration in the Figma. A just-in-time-provisioned Google user without an Avatar should probably get the same step. This is an app-side decision, since Keycloak redirects straight into the app.
4. **Theming the broker pages.** Extra templates are needed:
   - `login-idp-link-confirm.ftl` and `login-idp-link-email.ftl` (existing email)
   - `idp-review-user-profile.ftl` (when Google provides no name)
   - re-authentication, which reuses the login form
   - possibly `login-idp-link-confirm-override.ftl`

   The Figma has no designs for these, so they are prototype candidates in the card style, like #12.
5. **Developer credentials.** Each developer needs their own Google OAuth client, or a shared one. With the consent screen *External* in "Testing" status, only listed test users can sign in. Decide who owns the Google Cloud project and how `.env` values are shared.

## Sources

Keycloak source at tag `26.8.1` (https://github.com/keycloak/keycloak/tree/26.8.1):

- [R1] `core/src/main/java/org/keycloak/representations/idm/IdentityProviderRepresentation.java`
- [R2] `services/src/main/java/org/keycloak/social/google/GoogleIdentityProviderConfig.java`
- [R3] `services/src/main/java/org/keycloak/social/google/GoogleIdentityProvider.java`
- [R4] `docs/documentation/server_admin/topics/identity-broker/social/google.adoc` (Server Admin Guide, "Google")
- [R5] `services/src/main/java/org/keycloak/social/google/GoogleUserAttributeMapper.java`
- [R6] `services/src/main/java/org/keycloak/broker/oidc/mappers/AbstractJsonUserAttributeMapper.java`
- [R7] `services/src/main/java/org/keycloak/services/resources/IdentityBrokerService.java` (`afterFirstBrokerLogin`, `authenticated`, `updateFederatedIdentity`)
- [R8] `services/src/main/java/org/keycloak/broker/oidc/OIDCIdentityProvider.java` (`extractIdentity`, `setEmailVerified`, `getEmailVerifiedClaim`)
- [R9] `themes/src/main/resources/theme/base/login/login.ftl`
- [R10] `services/src/main/java/org/keycloak/forms/login/freemarker/model/IdentityProviderBean.java`
- [R11] `server-spi-private/src/main/java/org/keycloak/models/utils/DefaultAuthenticationFlows.java` (`firstBrokerLoginFlow`)
- [R12] `docs/documentation/server_admin/topics/identity-broker/first-login-flow.adoc` (Server Admin Guide, "First login flow")
- [R13] `services/src/main/java/org/keycloak/authentication/authenticators/broker/IdpCreateUserIfUniqueAuthenticator.java`
- [R14] `server-spi-private/src/main/java/org/keycloak/broker/provider/AbstractIdentityProvider.java` (`updateBrokeredUser`, `updateEmail`, `setEmailVerified`)
- [R15] `services/src/main/java/org/keycloak/authentication/authenticators/broker/IdpEmailVerificationAuthenticator.java`
- [R16] `services/src/main/java/org/keycloak/protocol/oidc/OIDCLoginProtocolFactory.java` (default `profile` and `email` scopes)
- Base login theme templates: `themes/src/main/resources/theme/base/login/` (`login-idp-link-confirm.ftl`, `login-idp-link-confirm-override.ftl`, `login-idp-link-email.ftl`, `idp-review-user-profile.ftl`)

Google:

- [G1] OpenID Connect, ID token claims: https://developers.google.com/identity/openid-connect/openid-connect
- [G2] OAuth 2.0 for Web Server Applications, redirect URI validation: https://developers.google.com/identity/protocols/oauth2/web-server
