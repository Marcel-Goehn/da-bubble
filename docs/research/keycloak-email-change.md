# Email change through Keycloak

Research for [#28](https://github.com/Marcel-Goehn/da-bubble/issues/28). It covers Keycloak 26.8.1 (pinned in #7) with verify email ON, the hand-written `dabubble` login theme (#5) and the Google IdP from #15 (`trustEmail: true`, `syncMode: IMPORT`). The UI it has to serve is the profile-edit resolution from [#21](https://github.com/Marcel-Goehn/da-bubble/issues/21): an in-app "E-Mail-Adresse" field, a confirm dialog "E-Mail-Adresse ändern?" with "Link senden", a "nicht bestätigt" badge, and the old address staying valid until the link is opened. Source links point at the `26.8.1` tag.

## TL;DR

1. **Built-in update email is the right base.** In 26.8.1 the `UPDATE_EMAIL` feature is `Type.DEFAULT`, so no feature flag is needed [R1]. It became "supported" in 26.4 [R16]. But the realm creates the `UPDATE_EMAIL` required action **disabled** [R9]. The realm JSON has to switch it on.
2. **Old address stays.** With verify email ON, Keycloak does not touch `email`. It stores the new address in the user attribute **`kc.email.pending`** and mails a link to the new address. Only the link swaps the address and sets `emailVerified=true` [R2][R3][R4][R15].
3. **The app can read the pending address.** `kc.email.pending` is a normal user attribute. A plain "User Attribute" protocol mapper turns it into a token claim [R12]. The backend can also read it through the Admin API [R7].
4. **Discard works from the app. Resend does not.** The backend discards by clearing `kc.email.pending` and the `UPDATE_EMAIL` required action through the Admin API. The admin console does exactly this, and the old link then fails [R3][R14]. Resending only works on Keycloak's own page: the user submits the update-email form again, with a 30 s cooldown [R2][R13].
5. **Two catches for the #21 design.**
   - The new address can't be typed in the app. The user types it on Keycloak's hosted `update-email.ftl` page, reached with `kc_action=UPDATE_EMAIL`. No parameter carries a value into it [R2][R11].
   - While a change is pending, **every new login or page load lands on that page again**. It reads "A verification email was sent to …" and offers resend, a different address, or the old address. It has no cancel button. The app is usable again only after the link is opened or the change is undone [R2][R11][R15].
6. **The Admin API is the wrong tool for the change itself.** `PUT /users/{id}` with a new `email` writes it at once. It doesn't even reset `emailVerified` [R6][R7]. So the old address is gone straight away, and there is no pending state. The backend can still use it for *discard* and *read*. That needs a service-account client with `realm-management` roles `manage-users` and `view-users`.
7. **Google Users.** The flow is the same for them. Keycloak may ask them to sign in again first. After the change, their Keycloak email differs from their Google email. That is harmless: with `IMPORT`, later Google logins don't overwrite it, and the account link is keyed on Google's `sub`, not the email [R17].
8. **Templates.** One email template: `email-update-confirmation.ftl` (html + text). Keycloak sends **no** notice to the old address. Login pages: `update-email.ftl`, `info.ftl` ("link sent", "email updated") and `error.ftl` (stale or cancelled link). If a re-login is needed, `login.ftl` too.

## 1. The two options at a glance

| | A: `UPDATE_EMAIL` via `kc_action` | B: backend sets `email` via Admin API |
|---|---|---|
| Old address valid until link opened | **Yes.** `email` is unchanged, new value in `kc.email.pending` [R2] | **No.** Written at once. `emailVerified` stays as it was unless the backend sends `false` [R6][R7] |
| Pending address readable | **Yes.** Token claim via mapper, or Admin API `GET` [R12][R7] | Only if the backend keeps its own copy |
| Resend | Only on the hosted page: submit again, 30 s cooldown [R2][R13] | `send-verify-email` mails the *current* (already new) address [R8] |
| Discard | Backend clears `kc.email.pending` + `UPDATE_EMAIL` (Admin API). The link then fails [R3][R14] | Backend writes the old email back |
| Email template | `email-update-confirmation.ftl` [R10] | `email-verification.ftl` (send-verify-email) or `executeActions.ftl` |
| Where the new address is typed | Keycloak's `update-email.ftl` | In-app field (matches #21) |
| Re-authentication | Built in. Default max age 300 s [R15] | None, unless the app adds its own step-up |
| Google Users | Same flow, re-login via the Google button | Same. `IMPORT` keeps the value |

Option B with `emailVerified=false` + `send-verify-email` fails the core requirement. The backend rejects `email_verified=false` tokens (ADR 0001). With verify email ON, the next login also forces `VERIFY_EMAIL`. So the User would be locked out until they verify, and the old address would already be dead.

A third option, **C**, is "backend-owned pending change". The backend keeps the pending address in its own DB and sends its own link. When the link is opened, it writes `email` + `emailVerified=true` through the Admin API. That matches #21 one-to-one: in-app field, resend and discard in the app, no Keycloak page. The cost is a lot of security-relevant code. It needs SMTP and templates in the backend (a second place for mail branding), its own token signing and expiry, and its own re-authentication (e.g. `prompt=login` + checking `auth_time`). It is listed for completeness. It is not recommended for v1.

## 2. How `UPDATE_EMAIL` works in 26.8.1

### Enabling it

- `Profile.Feature.UPDATE_EMAIL("Update Email Action", Type.DEFAULT)`, so it is on by default and needs no `--features` flag [R1]. Release notes 26.4.0 call it "Update Email Workflow (supported)" [R16].
- `DefaultRequiredActions.addUpdateEmailAction` adds the required action with `setEnabled(false)` [R9]. `UpdateEmail.isEnabled(realm)` needs both the feature and an enabled required action [R2].
- Realm JSON (`requiredActions[]`):

  ```json
  {
    "alias": "UPDATE_EMAIL",
    "name": "Update Email",
    "providerId": "UPDATE_EMAIL",
    "enabled": true,
    "defaultAction": false,
    "priority": 70,
    "config": { "max_auth_age": "300", "emailResendCooldownSeconds": "30" }
  }
  ```

  Config keys: `verifyEmail` ("Force Email Verification", not needed here because the realm has verify email ON), `emailResendCooldownSeconds` (default 30) and `max_auth_age` (default 300) [R2][R13][R25]. The values shown are the defaults, so `config` can also stay empty. Check the JSON shape against a realm export.
- **Link lifetime.** The token type is `update-email` [R5]. Its lifetime is `realm.getActionTokenGeneratedByUserLifespan("update-email")`. That reads realm attribute `actionTokenGeneratedByUserLifespan.update-email` and otherwise falls back to "User-Initiated Action Lifespan", which is **5 minutes** by default [R2][R18][R19]. Five minutes is short for "check your other inbox". Set e.g. `"attributes": { "actionTokenGeneratedByUserLifespan.update-email": "86400" }`.
- With the action enabled, the email attribute is no longer editable in the `UPDATE_PROFILE` and `ACCOUNT` contexts. It stays editable in admin contexts (`USER_API`) [R6].

### The flow

1. **The app starts an AIA.** keycloak-js: `keycloak.login({ action: 'UPDATE_EMAIL', redirectUri })` adds `kc_action=UPDATE_EMAIL`. If the last authentication is older than the max auth age (300 s by default), Keycloak first asks the User to sign in again [R15].
2. **`update-email.ftl`** shows the email field (prefilled with the *current* address), the "Sign out from other devices" checkbox, and Submit / Cancel. Cancel appears only in an AIA [R11]. After authentication, Keycloak sends a 302 to `login-actions/required-action` [R20]. So nothing from the authorization request reaches the form, and the address the User typed in the app can't be prefilled.
3. **On submit** (`processAction`), the address is checked against the User Profile in context `UPDATE_EMAIL`: duplicate email, format, email-as-username [R2][R6]. If verify email is on and the address differs, `sendEmailUpdateConfirmation` runs [R2]. It:
   - checks the cooldown (default 30 s) [R13],
   - builds an `UpdateEmailActionToken(userId, exp, oldEmail, newEmail, clientId, logoutSessions, redirectUri)` [R2],
   - sends `email-update-confirmation` **to the new address** [R2][R10],
   - sets `kc.email.pending = newEmail` [R2][R4],
   - renders `info.ftl` with `emailUpdateConfirmationSentTitle` / `emailUpdateConfirmationSent` [R2].

   This is a `challenge`, not a `success`. So the AIA does **not** redirect back to the app with `kc_action_status`. `info.ftl` offers a "back to application" link only if `pageRedirectUri`, `actionUri` or the client's `baseUrl` is set [R21]. **The frontend client needs `baseUrl` in the realm JSON.** Otherwise the User is stranded on that page.
4. **Opening the link** runs `UpdateEmailActionTokenHandler` [R3]:
   - The token's `oldEmail` must still equal the user's email. Otherwise it fails.
   - `kc.email.pending` must still exist and equal the token's `newEmail`. Otherwise "This email verification has been cancelled by an administrator." (`emailVerificationCancelled`).
   - It re-validates, then calls `UpdateEmail.updateEmailNow`. That writes `email`, emits event `UPDATE_EMAIL` with `previous_email` / `updated_email`, and removes `kc.email.pending` [R2].
   - It sets `emailVerified=true` and removes `UPDATE_EMAIL` and `VERIFY_EMAIL` [R3].
   - If the box was ticked, it logs out other sessions.
   - It shows `info.ftl` with `emailUpdatedTitle` / `emailUpdated`.
   - The token is single-use (`canUseTokenRepeatedly` returns `false`) [R3].

### While the change is pending: the catch

`UpdateEmail.evaluateTriggers` runs on every authentication. It contains:

```java
if (user.getFirstAttribute(UserModel.EMAIL_PENDING) != null) {
    user.addRequiredAction(RequiredAction.UPDATE_EMAIL);
    return;
}
```

[R2]. Required-action triggers are evaluated after every completed authentication, including SSO-cookie logins [R15][R20]. So while `kc.email.pending` is set, **every new authorization request** shows `update-email.ftl` again. That covers a page reload (keycloak-js doesn't persist tokens), a new tab and another device. The form is prefilled with the pending address and shows the info `emailVerificationPending`: "A verification email was sent to {0}. You can submit without changes to resend the verification email, or enter a different email address." [R2][R22]. The admin guide documents this as intended ("Pending Email Verification") [R15].

Because `UPDATE_EMAIL` is now a required action on the User, a later `kc_action=UPDATE_EMAIL` counts as *enforced*, and the Cancel button no longer cancels [R20][R23]. There are three ways out:

- Open the link.
- Submit the **old** address again. The `Objects.equals(user.getEmail(), newEmail) && user.isEmailVerified()` branch then updates without confirmation and clears `kc.email.pending` [R2]. This is effectively "discard".
- Have the backend clear it (next section).

Refresh-token grants don't run required actions, so a SPA tab that is already open keeps refreshing tokens. The full-page AIA redirect replaces that tab, though. Not verified here: what silent `check-sso` (`prompt=none`) returns in this state. Most likely it is an `interaction_required` error, so the app would see "not logged in" and redirect into the page. **Confirm in a spike.**

What this means for #21: "Bis du ihn öffnest, bleibt alt@… deine Adresse für die Anmeldung" is true for the *address*. But the User cannot simply keep using the app until they open the link. Either the copy has to say so, or option C is needed.

### Reading the pending address (badge)

- **Token claim.** Add a protocol mapper of type `oidc-usermodel-attribute-mapper` with `user.attribute: kc.email.pending` and `claim.name: email_pending`, for the access token and the ID token [R12]. `UserAttributeMapper.setClaim` reads the raw attribute through `KeycloakModelUtils.resolveAttribute`. That call goes straight to `user.getAttributeStream(name)`, with no User Profile read filter [R12]. The claim is current from the next token refresh on.
- **Admin API.** `GET /admin/realms/da-bubble/users/{sub}` returns it under `attributes`. In the `USER_API` context, `kc.email.pending` is readable and writable whenever the feature is on and the value is non-empty [R6]. The admin console shows its "pending verification" alert from exactly this field [R14].
- Users themselves can't write it. It is in `DEFAULT_READ_ONLY_ATTRIBUTES` for non-admin contexts [R6].

### Resend and discard

- **Resend.** No Admin API endpoint creates an `update-email` token. `execute-actions-email` mails the *current* address with `executeActions.ftl` [R8]. So "Link erneut senden" has to send the User to `kc_action=UPDATE_EMAIL`. There they press Submit on the prefilled form, and the 30 s cooldown applies [R2][R13].
- **Discard ("Änderung verwerfen").** The backend does what the admin console does: `PUT /users/{sub}` with the existing representation, `attributes["kc.email.pending"] = ""`, and `UPDATE_EMAIL` removed from `requiredActions` [R14]. Blank values remove the attribute [R24]. `updateUserFromRep` removes required actions that are missing from the list [R7]. The handler then rejects the old link [R3]. The admin guide describes the same three effects [R15].

## 3. Admin API from the backend

- **Client.** A confidential client (e.g. `da-bubble-backend`) with `serviceAccountsEnabled: true` gets a token through `client_credentials`. Its service-account user needs client roles of `realm-management`:
  - `manage-users`: `PUT /users/{id}`, `execute-actions-email`, `send-verify-email` all call `auth.users().requireManage(user)` [R7][R8].
  - `view-users`: `GET` of users.

  `manage-users` covers every user in the realm, so the client secret must stay in the backend's `.env`.
- **`PUT /users/{id}` with a new email.** Runs in context `USER_API`, where `resetEmailVerified` is `false` [R6]. So the email changes at once, and `emailVerified` keeps its old value unless the representation sets it [R7]. There is no pending state and no re-auth.
- **`send-verify-email`** builds a `VerifyEmailActionToken` for `user.getEmail()` and mails `email-verification.ftl` [R8]. It only helps *after* the email has already been overwritten.
- **`execute-actions-email` with `["UPDATE_EMAIL"]`** mails the **current** address an "Update Your Account" link (`executeActions.ftl`). That link then shows `update-email.ftl` [R8]. It is an admin-initiated variant of option A, not an in-app one.

So for option A the backend needs the Admin API only to **discard**, and optionally to read the pending address. The claim mapper avoids the read. If discard is done by "submit the old address on the Keycloak page" instead, the backend needs no Admin API access at all.

## 4. Google Users

- **Is email editable?** Yes. Nothing marks it read-only for brokered users, and `UpdateEmail` skips only when the User Profile marks `email` read-only [R2].
- **Re-authentication.** A Google-only User has no password. If the 300 s max age has run out, the re-login page is the themed `login.ftl`, and they continue with "Anmelden mit Google". *Not traced in source here.* Confirm in the spike that a Google re-login with the same linked account satisfies the max-age check.
- **After the change.** Their Keycloak `email` (e.g. `neu@firma.de`) no longer matches Google's. With `syncMode: IMPORT`, `IdentityBrokerService.updateFederatedIdentity` calls `setBasicUserAttributes` (email, names) only for `FORCE` [R17]. So the next Google login keeps the new address. The link is stored as a federated identity keyed on Google's `sub`, so login keeps working. `trustEmail` only matters at first broker login.
- **Verified flag.** The link sets `emailVerified=true` [R3], so the backend's `email_verified` check keeps passing.
- **Side effect.** If someone later signs up with Google using the *old* Gmail address, nothing matches the existing User any more. First broker login creates a new User. That is expected behaviour.

## 5. Templates to theme

Email theme (`dabubble/email`, parent `base`):

- `html/email-update-confirmation.ftl` + `text/email-update-confirmation.ftl`, messages `emailUpdateConfirmationSubject`, `emailUpdateConfirmationBody`, `emailUpdateConfirmationBodyHtml`. Parameters: `link`, `newEmail`, `realmName`, `linkExpiration` [R10].
- There is no mail to the *old* address on change. The base theme has no `event-update_email` template [R10]. A "your address was changed" notice would need an event listener, or the backend reacting to the `UPDATE_EMAIL` event.

Login theme (`dabubble/login`):

- `update-email.ftl`: form via `userProfileCommons.userProfileFormFields`, `logoutOtherSessions`, and Cancel only when `isAppInitiatedAction??` [R11]. Message keys: `updateEmailTitle`, `emailVerificationPending`, `emailVerifySendCooldown` [R22].
- `info.ftl`: "sent" (`emailUpdateConfirmationSentTitle`, `emailUpdateConfirmationSent`) and "done" (`emailUpdatedTitle`, `emailUpdated`) [R21][R22].
- `error.ftl`: `emailVerificationCancelled`, `staleEmailVerificationLink`, and `emailSendError` when SMTP fails [R3][R23].
- `login.ftl` for re-authentication (already themed in #5).

The German text for these keys goes into `messages_de.properties` of both themes. The #21 confirm-dialog copy ("Wir schicken einen Bestätigungslink an …") would move into `update-email.ftl` / `info.ftl`.

## 6. Open questions this leaves

1. **Field or button.** With option A, the in-app field can't send the address. Either:
   - the profile dialog shows the email read-only, with "E-Mail-Adresse ändern" that redirects to the themed `update-email.ftl`, or
   - the field stays, and "Link senden" redirects and makes the User type the address a second time.

   The first is cleaner. It changes the #21 design.
2. **The "pending page on every login" behaviour.** Accept it and theme it as a proper "Bestätigung ausstehend" screen with resend, other address, back to old address? Or is it a deal-breaker that pushes toward option C?
3. **Discard in the app.** A badge action "Änderung verwerfen" needs the backend service account with `manage-users`. Without it, discard means typing the old address on the Keycloak page.
4. **Link lifetime.** Raise `actionTokenGeneratedByUserLifespan.update-email` from 5 minutes to e.g. 24 h?
5. **Spike items.** `prompt=none` behaviour while pending, Google re-auth under max age, the JSON shape of the `UPDATE_EMAIL` required-action config, and the `baseUrl` back-link on `info.ftl`.

## Sources

Keycloak source at tag `26.8.1` (https://github.com/keycloak/keycloak/tree/26.8.1):

- [R1] `common/src/main/java/org/keycloak/common/Profile.java` (`UPDATE_EMAIL("Update Email Action", Type.DEFAULT)`)
- [R2] `services/src/main/java/org/keycloak/authentication/requiredactions/UpdateEmail.java` (`isEnabled`, `evaluateTriggers`, `requiredActionChallenge`, `processAction`, `sendEmailUpdateConfirmation`, `updateEmailNow`, pending attribute helpers)
- [R3] `services/src/main/java/org/keycloak/authentication/actiontoken/updateemail/UpdateEmailActionTokenHandler.java`
- [R4] `server-spi/src/main/java/org/keycloak/models/UserModel.java` (`EMAIL_PENDING = "kc.email.pending"`)
- [R5] `services/src/main/java/org/keycloak/authentication/actiontoken/updateemail/UpdateEmailActionToken.java` (`TOKEN_TYPE = "update-email"`)
- [R6] `services/src/main/java/org/keycloak/userprofile/DeclarativeUserProfileProviderFactory.java` (`DEFAULT_READ_ONLY_ATTRIBUTES`, `editEmailCondition`, `createUserResourceValidation`, `isUpdateEmailFeatureEnabled`) and `server-spi/src/main/java/org/keycloak/userprofile/UserProfileContext.java` (`USER_API(true, false, false)`, `UPDATE_EMAIL(false, true, true, …)`)
- [R7] `services/src/main/java/org/keycloak/services/resources/admin/UserResource.java` (`updateUser`, `updateUserFromRep`)
- [R8] same file (`executeActionsEmail`, `sendVerifyEmail`)
- [R9] `server-spi-private/src/main/java/org/keycloak/models/utils/DefaultRequiredActions.java` (`addUpdateEmailAction`, `setEnabled(false)`)
- [R10] `themes/src/main/resources/theme/base/email/` (`html|text/email-update-confirmation.ftl`, `messages/messages_en.properties`)
- [R11] `themes/src/main/resources/theme/base/login/update-email.ftl`
- [R12] `services/src/main/java/org/keycloak/protocol/oidc/mappers/UserAttributeMapper.java` (`oidc-usermodel-attribute-mapper`, `setClaim`) and `server-spi-private/src/main/java/org/keycloak/models/utils/KeycloakModelUtils.java` (`resolveAttribute`)
- [R13] `services/src/main/java/org/keycloak/authentication/requiredactions/util/EmailCooldownManager.java` (`EMAIL_RESEND_COOLDOWN_DEFAULT_SECONDS = 30`)
- [R14] `js/apps/admin-ui/src/user/UserForm.tsx` (`handleEmailVerificationReset`, pending alert)
- [R15] `docs/documentation/server_admin/topics/login-settings/update-email-workflow.adoc` (Server Admin Guide, "Update Email Workflow", incl. "Pending Email Verification")
- [R16] `docs/documentation/release_notes/topics/26_4_0.adoc` ("Update Email Workflow (supported)")
- [R17] `services/src/main/java/org/keycloak/services/resources/IdentityBrokerService.java` (`updateFederatedIdentity`, `FORCE` only)
- [R18] `model/jpa/src/main/java/org/keycloak/models/jpa/RealmAdapter.java` (`getActionTokenGeneratedByUserLifespan(String)`)
- [R19] `docs/documentation/server_admin/topics/sessions/timeouts.adoc` ("User-Initiated Action Lifespan")
- [R20] `services/src/main/java/org/keycloak/services/managers/AuthenticationManager.java` (`nextRequiredAction`, `evaluateRequiredActionTriggers`, `getApplicableRequiredActionsSorted`, `setKcActionToEnforced`, `redirectToRequiredActions`) and `services/src/main/java/org/keycloak/authentication/AuthenticationProcessor.java` (redirect to required actions after authentication)
- [R21] `themes/src/main/resources/theme/base/login/info.ftl`
- [R22] `themes/src/main/resources/theme/base/login/messages/messages_en.properties`
- [R23] `services/src/main/java/org/keycloak/services/resources/LoginActionsService.java` (`CANCEL_AIA`, ignored when `KC_ACTION_ENFORCED`) and `services/src/main/java/org/keycloak/services/messages/Messages.java`
- [R24] `server-spi-private/src/main/java/org/keycloak/userprofile/DefaultUserProfile.java` (`updateInternal`: blank removes, `isResetEmailVerified`)
- [R25] `server-spi-private/src/main/java/org/keycloak/models/Constants.java` (`MAX_AUTH_AGE_KEY = "max_auth_age"`)

Related research: `docs/research/keycloak-google-idp.md` (branch `research/google-idp`), `docs/adr/0001-keycloak-hosted-login-frontend-pkce.md`.
