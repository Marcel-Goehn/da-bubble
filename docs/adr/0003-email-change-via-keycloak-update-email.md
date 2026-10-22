# Email changes go through Keycloak's UPDATE_EMAIL, and we accept its pending gate

A User changes their email through Keycloak's built-in `UPDATE_EMAIL` required action, not through a flow the backend owns. The profile dialog shows the email read-only with an "E-Mail-Adresse ändern" button, and the button redirects to `kc_action=UPDATE_EMAIL`, where the new address is typed. Keycloak keeps the current email, stores the new one in `kc.email.pending`, which a mapper puts into the token as `email_pending`, and swaps the address only when the User opens the link (valid 1 h). The cost is that while a change is pending, every full page load or new login shows Keycloak's update-email page, which has no Cancel. We theme it as "Bestätigung ausstehend" instead of avoiding it. We chose this because building our own pending change means writing our own tokens, expiry, cooldown and mail, which is security-relevant code that Keycloak already ships.

## Considered Options

- **Backend-owned pending change** (own table, own mail and token, then an Admin API write once the link is opened): matches the original profile-edit design exactly and never gates logins. Rejected because it puts security-relevant code in our hands.
- **Typing the new address in the app and again on Keycloak's page**: rejected because the app can't pass the address into Keycloak's form, so the User would type it twice.

## Consequences

- The realm JSON enables `UPDATE_EMAIL` (`max_auth_age` 300) and sets `actionTokenGeneratedByUserLifespan.update-email` to `3600`.
- "Änderung verwerfen" needs a confidential backend client with a service account (`manage-users`, `view-users`). It PUTs the full User back with `kc.email.pending: [""]` and without `UPDATE_EMAIL`.
- After a discard, or after returning with `kc_action_status=success`, the app forces a token refresh so the badge follows `email_pending`.
- A User who closed every tab gets out of the gate only by opening the link, resending it, or retyping their old address on the themed page.
