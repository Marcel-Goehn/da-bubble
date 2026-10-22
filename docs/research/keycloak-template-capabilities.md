# What the Keycloak FreeMarker templates can see and do

Research for [What can the Keycloak FreeMarker templates see and do?](https://github.com/Marcel-Goehn/da-bubble/issues/32) (map: [Map: DA Bubble v1 spec](https://github.com/Marcel-Goehn/da-bubble/issues/1)). Researched 2026-10-22 against the Keycloak **26.8.1** tag. Each claim links to the source line that owns it. `KC` below means `https://github.com/keycloak/keycloak/blob/26.8.1`.

## Question

For the login-theme pages we still have to theme, what can the FreeMarker templates read, and what can they do?

1. Can `update-email.ftl` read the User's **current** email, so we can offer an "Alte Adresse behalten" button that cancels the Pending Email Change?
2. Can the re-auth `login.ftl` (the `max_auth_age` re-login) tell whether the User has a password, so the password field can be hidden for Google Users?
3. Does ticking the privacy checkbox on the register form clear the `TERMS_AND_CONDITIONS` default action, so that `terms.ftl` only shows for Google sign-ups?
4. Which variables do `error.ftl`, `terms.ftl` and the broker pages expose, and do they inherit our hand-written `template.ftl`?

## Answer in short

- **Q1: Yes.** Use `user.attributes.email`. It is always the stored, current address. The pending address is in `user.attributes['kc.email.pending']`. Watch out: `user.email` and the form field value are **not** safe for this. On the pending page they hold the *pending* address. A hidden form that posts the current address back to `url.loginAction` cancels the change, using the same path as "retype the old address".
- **Q2: Yes.** On the re-auth page the User is already known. `authenticatorConfigured("auth-password-form")` returns true only if the User has a password credential. `social.providers` is then limited to the IdPs **linked to that User**, so it only lists Google for Google Users. Both checks need a `??` guard, because on the normal login page there is no User yet.
- **Q3: Yes.** When the posted `termsAccepted` value is `"on"`, `RegistrationUserCreation` sets the `terms_and_conditions` attribute and removes `TERMS_AND_CONDITIONS` from the new user. Google sign-ups get the default action added on creation and see `terms.ftl`. Users imported from the realm JSON (the Guest) do not get default actions.
- **Q4:** Every page in scope imports `template.ftl` and calls `layout.registrationLayout`, so our `template.ftl` styles them all. They all get the common variables (`realm`, `url`, `client`, `auth`, `social`, `msg`, `properties`, `message`, `messagesPerField`, `pageId`, ...). `terms.ftl` is rendered with `createForm`, so it **lacks** `login`, `authenticationSession` and `statusCode`. The table below lists each page's own extra variables.

## Findings

### Where the variables come from

`FreeMarkerLoginFormsProvider` builds the template data model in three steps ([KC services/.../FreeMarkerLoginFormsProvider.java](https://github.com/keycloak/keycloak/blob/26.8.1/services/src/main/java/org/keycloak/forms/login/freemarker/FreeMarkerLoginFormsProvider.java)):

1. **On every page**, `createCommonAttributes` ([L496](https://github.com/keycloak/keycloak/blob/26.8.1/services/src/main/java/org/keycloak/forms/login/freemarker/FreeMarkerLoginFormsProvider.java#L496)) and `handleThemeResources`/`handleMessages` add:
   - `realm` (RealmBean), `title`, `url` (UrlBean), `requiredActionUrl`, `auth` (AuthenticationContextBean), `social` (IdentityProviderBean), `passwordPolicies` and `lang`.
   - `client` (ClientBean) only if a client is in context.
   - `locale` only if i18n is enabled. `org` only with the organizations feature.
   - `authenticatorConfigured` only if a user is set ([L605](https://github.com/keycloak/keycloak/blob/26.8.1/services/src/main/java/org/keycloak/forms/login/freemarker/FreeMarkerLoginFormsProvider.java#L605)).
   - `isAppInitiatedAction` only for AIA that was not enforced. `traceId` only with tracing.
   - `msg`, `advancedMsg`, `properties`, `themeResources`, `darkMode`, `messagesPerField`, and `message` (only when a message is set).
   - `processTemplate` adds `pageId` and `templateName`.
   - Anything an authenticator passed via `form.setAttribute(...)`, e.g. `usernameHidden`, `registrationDisabled`, `termsAcceptanceRequired` or `hideReviewButton`.
2. **Only for pages rendered by `createResponse(page)`** (every page in a `LoginFormsPages` enum): `login` (LoginBean over the form data, [L252](https://github.com/keycloak/keycloak/blob/26.8.1/services/src/main/java/org/keycloak/forms/login/freemarker/FreeMarkerLoginFormsProvider.java#L252)), `statusCode`, and `authenticationSession` (during AUTHENTICATE/REQUIRED_ACTIONS/OAUTH_GRANT). Then a per-page switch adds page beans (below).
3. **`createForm(name)`** ([L366](https://github.com/keycloak/keycloak/blob/26.8.1/services/src/main/java/org/keycloak/forms/login/freemarker/FreeMarkerLoginFormsProvider.java#L366)) is used by `terms.ftl` and the "email sent" `info.ftl`. It runs only step 1, so `login`, `statusCode` and `authenticationSession` are **absent**.
   - The base `template.ftl` only touches `authenticationSession` inside `<#if authenticationSession??>`, so this is safe. Our template must guard it the same way, and must not read `login.*` unguarded.

### Q1: `update-email.ftl` and the current email

How the page is built:

- `UpdateEmail.requiredActionChallenge` renders `createResponse(RequiredAction.UPDATE_EMAIL)` ([KC services/.../UpdateEmail.java#L171](https://github.com/keycloak/keycloak/blob/26.8.1/services/src/main/java/org/keycloak/authentication/requiredactions/UpdateEmail.java#L171)).
- When a change is already pending, it first replaces the form data with `{email: <pending>}` and sets the info message `emailVerificationPending` with the pending address.
- During the 30 s resend cooldown it does the same and sets an error instead (L225).

Page variables ([FreeMarkerLoginFormsProvider L195, L287](https://github.com/keycloak/keycloak/blob/26.8.1/services/src/main/java/org/keycloak/forms/login/freemarker/FreeMarkerLoginFormsProvider.java#L195)):

| Variable | Bean | What `email` resolves to |
|---|---|---|
| `user` | `ProfileBean(UserUpdateProfileContext(realm,user), formData)` | `user.email`: `formData.email` if form data is set, else the stored email ([ProfileBean L88](https://github.com/keycloak/keycloak/blob/26.8.1/services/src/main/java/org/keycloak/forms/login/freemarker/model/ProfileBean.java#L88)). **On the pending page this is the pending address.** |
| `user.attributes` | `Map<String,String>` built from `UserModel.getAttributes()`. Only form keys named `user.attributes.*` override it. | `user.attributes.email` is **always the stored, current email**: the JPA `UserAdapter.getAttributes()` adds `email`, `firstName`, `lastName` and `username` to the map ([KC model/jpa/.../UserAdapter.java#L302-L311](https://github.com/keycloak/keycloak/blob/26.8.1/model/jpa/src/main/java/org/keycloak/models/jpa/UserAdapter.java#L302)). `user.attributes['kc.email.pending']` is the pending address. |
| `profile`, `email` | `EmailBean` (UPDATE_EMAIL user profile) | `profile.attributesByName.email.value` / `email.value`: the form data if set, else the stored email ([EmailBean](https://github.com/keycloak/keycloak/blob/26.8.1/services/src/main/java/org/keycloak/forms/login/freemarker/model/EmailBean.java)). On the pending page this is the pending address, which the stock form prefills. |
| `message` | info `emailVerificationPending` (pending), error (cooldown/validation) | |
| `isAppInitiatedAction` | set when started by `kc_action=UPDATE_EMAIL` from the app | When the pending gate fires on a normal login it is a regular required action, so this is absent and the stock template shows no Cancel button. |

How "Alte Adresse behalten" can work, using only the theme:

```ftl
<form action="${url.loginAction}" method="post">
  <input type="hidden" name="email" value="${user.attributes.email}">
  <button type="submit">Alte Adresse behalten</button>
</form>
```

- `processAction` calls `updateEmailWithoutConfirmation` when the posted email equals the stored one and the stored one is verified ([UpdateEmail.java#L207](https://github.com/keycloak/keycloak/blob/26.8.1/services/src/main/java/org/keycloak/authentication/requiredactions/UpdateEmail.java#L207)). That path removes `UPDATE_EMAIL` and `kc.email.pending` and calls `context.success()`, so login continues into the app.
- The cooldown check only happens on the send path, so this button also works during the 30 s cooldown.
- This is the same "retype the old address" exit that [Does the UPDATE_EMAIL flow behave as researched?](https://github.com/Marcel-Goehn/da-bubble/issues/29) confirmed. The button only saves the typing.
- Caveat: if the stored email were unverified, the same post would *send* a confirmation mail to the old address instead. The backend rejects `email_verified=false`, so this should not happen in practice.
- **Confirm in a spike:** that `user.attributes.email` renders the current address on the pending page with the infinispan-cached user (the cache adapter delegates `getAttributes()` to the same model).

### Q2: re-auth `login.ftl` and password detection

How the re-auth page is reached:

- When re-authentication is needed (`max_auth_age` on the required action), `CookieAuthenticator` still calls `context.setUser(authResult.user())`. It then sets `FORCED_REAUTHENTICATION`, forwards the info message `reauthenticate` and returns `attempted()` ([KC .../CookieAuthenticator.java#L57-L66](https://github.com/keycloak/keycloak/blob/26.8.1/services/src/main/java/org/keycloak/authentication/authenticators/browser/CookieAuthenticator.java#L64)).
- `UsernamePasswordForm.authenticate` sees `context.getUser() != null`. It sets `usernameHidden=true` and `registrationDisabled=true` ([UsernamePasswordForm.java#L103](https://github.com/keycloak/keycloak/blob/26.8.1/services/src/main/java/org/keycloak/authentication/authenticators/browser/UsernamePasswordForm.java#L103)) and renders `login.ftl`.
- The flow's `form()` passes the user to the forms provider ([AuthenticationProcessor.java#L615](https://github.com/keycloak/keycloak/blob/26.8.1/services/src/main/java/org/keycloak/authentication/AuthenticationProcessor.java#L615)).

What the template can use there:

- **`authenticatorConfigured("auth-password-form")`**. `AuthenticatorConfiguredMethod` calls `Authenticator.configuredFor(session, realm, user)` for the given provider id ([AuthenticatorConfiguredMethod.java](https://github.com/keycloak/keycloak/blob/26.8.1/services/src/main/java/org/keycloak/forms/login/freemarker/AuthenticatorConfiguredMethod.java)). For `auth-password-form` (`PasswordFormFactory.PROVIDER_ID`) that is `user.credentialManager().isConfiguredFor("password")`, OR conditional passkeys being enabled, OR having already logged in with a passkey ([PasswordForm.java#L61-L65](https://github.com/keycloak/keycloak/blob/26.8.1/services/src/main/java/org/keycloak/authentication/authenticators/browser/PasswordForm.java#L61)). We do not enable passkeys, so the result is exactly "has a password".
  - Do **not** use `auth-username-password-form`. Its `configuredFor` always returns `true` ("never called").
- **`social.providers`**. With a user set, `IdentityProviderBean.getLinkedBrokerAliases` returns that user's federated identities. When organizations are disabled it returns them even if the set is empty. The page then lists only those IdPs ([IdentityProviderBean.java#L190-L206](https://github.com/keycloak/keycloak/blob/26.8.1/services/src/main/java/org/keycloak/forms/login/freemarker/model/IdentityProviderBean.java#L190)). Result: a Google User sees the Google button, and a password-only User sees none.
- `usernameHidden??` is true. `auth.showUsername()` is true and `auth.attemptedUsername` holds the username, so we can show "Angemeldet als …" ([AuthenticationContextBean.java](https://github.com/keycloak/keycloak/blob/26.8.1/services/src/main/java/org/keycloak/forms/login/freemarker/model/AuthenticationContextBean.java)). `message` is the info `reauthenticate`.

Suggested logic:

```ftl
<#assign reauth = usernameHidden??>
<#assign hasPassword = !(authenticatorConfigured??) || authenticatorConfigured("auth-password-form")>
<#if realm.password && hasPassword> ...password field... </#if>
<#-- social.providers is already filtered to linked IdPs on re-auth -->
```

- A Google User who later set a password through "Passwort vergessen" has both a credential and a link, so they see both options. That is correct.
- The same `login.ftl` is also used by the broker re-auth (`IdpUsernamePasswordForm`: "confirm link → log in with your existing password", from [How is Google login configured in the Keycloak realm?](https://github.com/Marcel-Goehn/da-bubble/issues/15)).
  - There the username is pre-filled via form data, and the info message is `federatedIdentityConfirmReauthenticateMessage`.
  - The context user is only set on submit, so `authenticatorConfigured` and `usernameHidden` are likely **absent** on first render.
  - `social.providers` drops the IdP currently being linked (`getExistingIDP`, same file L158-L175).
  - With the `??` guard above, the password field still shows. **Confirm in a spike** which of these variables are present on that page.
- **Confirm in a spike:** the `max_auth_age` re-login really goes through `CookieAuthenticator`'s re-auth branch (and not a fresh flow with no user) in our realm's browser flow. #29 saw a one-click Google re-login, which fits this branch.

### Q3: privacy checkbox vs. the `TERMS_AND_CONDITIONS` default action

- The registration-flow form action `RegistrationTermsAndConditions` (`registration-terms-and-conditions`) does three things ([RegistrationTermsAndConditions.java](https://github.com/keycloak/keycloak/blob/26.8.1/services/src/main/java/org/keycloak/authentication/forms/RegistrationTermsAndConditions.java)):
  - It sets `termsAcceptanceRequired` for the template, which makes `register-commons.ftl` render the `termsAccepted` checkbox.
  - It checks `formData.containsKey("termsAccepted")`. If the box is unticked, it reports the field error `termsAcceptanceRequired`.
  - Its `success()` does nothing itself.
- The clearing happens in `RegistrationUserCreation.success` ([RegistrationUserCreation.java#L162-L170](https://github.com/keycloak/keycloak/blob/26.8.1/services/src/main/java/org/keycloak/authentication/forms/RegistrationUserCreation.java#L162)). If `termsAccepted` equals `"on"` and the `TERMS_AND_CONDITIONS` required action is enabled, it sets `terms_and_conditions=<epoch>` on the user and removes the action from the user and the auth session. This runs right after `profile.create()`.
- `profile.create()` goes through `addUser(..., addDefaultRequiredActions=true)`, which adds every enabled default action ([JpaUserProvider.java#L148-L154](https://github.com/keycloak/keycloak/blob/26.8.1/model/jpa/src/main/java/org/keycloak/models/jpa/JpaUserProvider.java#L148)). So the action is added and then removed in the same transaction, and a form-registered User never sees `terms.ftl`.
- **Theme requirement:** the checkbox must post the value `"on"`. Leave out `value=` (the browser default is `on`) or set `value="on"`. Any other value passes validation (`containsKey`) but does **not** clear the action, so the User would see `terms.ftl` after registering.
- Realm requirements: the `TERMS_AND_CONDITIONS` required action is enabled with `defaultAction: true` (already decided in [Which User data is copied from the JWT just in time, and how does first login lead to the avatar step?](https://github.com/Marcel-Goehn/da-bubble/issues/10)), and the `registration-terms-and-conditions` execution is `REQUIRED` in the registration flow.
- **Google sign-ups:** `IdpCreateUserIfUniqueAuthenticator` calls `session.users().addUser(realm, username)` ([L99](https://github.com/keycloak/keycloak/blob/26.8.1/services/src/main/java/org/keycloak/authentication/authenticators/broker/IdpCreateUserIfUniqueAuthenticator.java#L99)), which is `addUser(..., true, true)` (JpaUserProvider L160-L161). The default action is added, and `terms.ftl` shows after the first Google login.
- **Guest:** realm-JSON import creates users with `addUser(..., false, false)` (`DefaultExportImportManager`, "Import users just to user storage"). The Guest gets no default actions, so the Gäste-Login does not hit `terms.ftl` unless the JSON lists it. (Checked on `main`. **Confirm in a spike** that 26.8.1 behaves the same.)
- The stock `terms.ftl` posts `accept` or `cancel`. `cancel` removes the attribute and fails the login with `termsAndConditionsDeclined` ([TermsAndConditions.java](https://github.com/keycloak/keycloak/blob/26.8.1/services/src/main/java/org/keycloak/authentication/requiredactions/TermsAndConditions.java)).

### Q4: variables per page, and template inheritance

All templates below start with `<#import "template.ftl" as layout>` and wrap their content in `<@layout.registrationLayout …>` ([base/login](https://github.com/keycloak/keycloak/tree/26.8.1/themes/src/main/resources/theme/base/login)). Keycloak resolves `template.ftl` from our theme first (`parent=base`), so overriding `template.ftl` styles all of them, as [How do we build a Keycloak login theme that matches the Figma?](https://github.com/Marcel-Goehn/da-bubble/issues/5) assumed. We only need to copy a page template when its *inner* markup must change.

| Template | How rendered | Page-specific variables (on top of the common ones) | Notes |
|---|---|---|---|
| `error.ftl` | `createErrorPage(status)` → `createResponse(ERROR)` | `message.summary` (the error text), `statusCode`, `skipLink` (set by some callers), `client.baseUrl` for "Zurück zur Anwendung" | `client` may be **absent** (e.g. an expired link with no client context). Guard with `client??`. JSON requests get an OAuth2 error body instead of HTML. |
| `terms.ftl` | `TermsAndConditions` → `createForm("terms.ftl")` with `user` = the raw **`UserModel`** (not ProfileBean) | `user.email`, `user.firstName`, `user.username`, `user.attributes` (UserModel getters) | No `login`, `statusCode` or `authenticationSession`. `auth` exists but has no flow context, so `auth.showUsername()` is false. `url.loginAction` works. The text comes from `msg("termsText")`, so put the Datenschutz copy in our message bundle. |
| `login-idp-link-confirm.ftl` | `IdpConfirmLinkAuthenticator` → `createResponse(LOGIN_IDP_LINK_CONFIRM)` | `brokerContext` (BrokeredIdentityContext: `username`, `email`, `firstName`, …), `idpAlias` (capitalised alias), `idpDisplayName`, `hideReviewButton` (true unless review-profile ran successfully), error `message` `federatedIdentityConfirmLinkMessage` (duplicate attribute name and value) | Posts `submitAction=linkAccount` or `updateProfile` to `url.loginAction`. No `user` and no `authenticatorConfigured` (the user is not resolved yet). |
| `login-idp-link-email.ftl` | `IdpEmailVerificationAuthenticator` → `createIdpLinkEmailPage()` | `brokerContext`, `idpAlias`, `idpDisplayName`, warning `message` `linkIdp` | Only used if the first-broker-login flow verifies by email. In the default flow the alternative is re-auth via `login.ftl` (Q2). |
| `idp-review-user-profile.ftl` | `IdpReviewProfileAuthenticator` → `createUpdateProfilePage()` → `IDP_REVIEW_USER_PROFILE` | `profile` (IdpReviewProfileBean: dynamic attributes from the Google data, used by `user-profile-commons.ftl`), `user` (ProfileBean over the broker context) | Default `updateProfileFirstLogin=missing`: shown only if the Google data fails IDP_REVIEW profile validation ([IdpReviewProfileAuthenticator.java#L85-L103](https://github.com/keycloak/keycloak/blob/26.8.1/services/src/main/java/org/keycloak/authentication/authenticators/broker/IdpReviewProfileAuthenticator.java#L85)). With `trustEmail` and the `name` → firstName mapper it should rarely show. |
| `login-update-profile.ftl` | `UPDATE_PROFILE` / `VERIFY_PROFILE` required actions (**not** the broker review page in 26.x) | `profile` (VerifyProfileBean), `user` (ProfileBean), `isAppInitiatedAction` | Shows if a User's stored profile fails validation, e.g. an empty name. |
| `login.ftl` (re-auth) | `UsernamePasswordForm` → `createResponse(LOGIN)` | `usernameHidden`, `registrationDisabled`, `authenticatorConfigured`, filtered `social.providers`, `auth.attemptedUsername` | See Q2. |
| `info.ftl` (after the email-change mail is sent) | `createForm(info.ftl)` with `messageHeader` | `message.summary`, `messageHeader`, `pageRedirectUri` / `actionUri` / `client.baseUrl`, `requiredActions` | Same `createForm` limits as `terms.ftl`. |

Template mapping: [Templates.java](https://github.com/keycloak/keycloak/blob/26.8.1/services/src/main/java/org/keycloak/forms/login/freemarker/Templates.java). Per-page beans: [FreeMarkerLoginFormsProvider L266-L350](https://github.com/keycloak/keycloak/blob/26.8.1/services/src/main/java/org/keycloak/forms/login/freemarker/FreeMarkerLoginFormsProvider.java#L266).

Variables the base `template.ftl` reads, which our template should either guard or avoid:

- Always present: `realm.displayNameHtml`, `url.resourcesPath`, `url.loginAction`, `url.loginRestartFlowUrl`, `properties.*`, `pageId`, `lang`.
- Need a guard: `locale` (only with i18n), `authenticationSession` (absent on `createForm` pages), `isAppInitiatedAction`, `message`, `auth.showUsername()` / `auth.attemptedUsername`, and `displayInfo`/`displayMessage`/`displayRequiredFields` (macro parameters with defaults).

## Open points to confirm in a spike

- `user.attributes.email` on the pending `update-email.ftl` page with the cached user (Q1).
- The `max_auth_age` re-login lands in `CookieAuthenticator`'s forced-re-auth branch, so `authenticatorConfigured` is defined there (Q2).
- Which variables exist on the broker re-auth `login.ftl` (`IdpUsernamePasswordForm`) on first render (Q2).
- Realm-JSON-imported users (the Guest) get no default required actions on 26.8.1 (Q3).

## Sources

All at tag `26.8.1` of https://github.com/keycloak/keycloak:

- `themes/src/main/resources/theme/base/login/`: `template.ftl`, `login.ftl`, `update-email.ftl`, `terms.ftl`, `error.ftl`, `info.ftl`, `register-commons.ftl`, `login-idp-link-confirm.ftl`, `login-idp-link-email.ftl`, `idp-review-user-profile.ftl`, `login-update-profile.ftl`
- `services/src/main/java/org/keycloak/forms/login/freemarker/`: `FreeMarkerLoginFormsProvider.java`, `AuthenticatorConfiguredMethod.java`, `Templates.java`, `model/ProfileBean.java`, `model/EmailBean.java`, `model/AbstractUserProfileBean.java`, `model/AuthenticationContextBean.java`, `model/IdentityProviderBean.java`
- `services/src/main/java/org/keycloak/authentication/`: `requiredactions/UpdateEmail.java`, `requiredactions/TermsAndConditions.java`, `requiredactions/util/UserUpdateProfileContext.java`, `forms/RegistrationTermsAndConditions.java`, `forms/RegistrationUserCreation.java`, `authenticators/browser/CookieAuthenticator.java`, `authenticators/browser/UsernamePasswordForm.java`, `authenticators/browser/PasswordForm.java`, `authenticators/broker/IdpConfirmLinkAuthenticator.java`, `authenticators/broker/IdpUsernamePasswordForm.java`, `authenticators/broker/IdpReviewProfileAuthenticator.java`, `authenticators/broker/IdpCreateUserIfUniqueAuthenticator.java`, `AuthenticationProcessor.java`, `RequiredActionContextResult.java`
- `model/jpa/src/main/java/org/keycloak/models/jpa/`: `UserAdapter.java`, `JpaUserProvider.java`
- `model/storage-private/src/main/java/org/keycloak/storage/datastore/DefaultExportImportManager.java` (realm import, checked on `main`)
