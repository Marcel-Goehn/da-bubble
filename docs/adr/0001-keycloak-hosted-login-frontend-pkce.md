# Keycloak hosted login, PKCE in the frontend, backend only validates JWTs

Authentication is delegated entirely to Keycloak. The login, registration and password-reset screens from the Figma are built as a custom Keycloak theme rather than as Angular pages, and the Angular app runs the Authorization Code + PKCE flow itself. The Spring Boot backend is a pure OAuth2 resource server: it validates Keycloak-issued JWTs and never handles credentials, sessions or tokens of its own. A User's primary key is the Keycloak `sub`, and the backend creates the User record just in time on their first authenticated request.

## Considered Options

- **Embedded login (Angular forms posting credentials to Keycloak):** keeps the Figma pixel-perfect in Angular, but Keycloak and OAuth best practice advise against it, and it would bypass Keycloak's flows for verification, password reset and Google brokering.
- **Backend-for-frontend (Spring holds tokens, browser holds a session cookie):** more secure token storage, but it pulls auth back into the backend, which this design deliberately keeps out.

## Consequences

- Every auth screen the Figma shows has to be reproduced as a Keycloak theme.
- Anything a User does after the credentials step (e.g. choosing an avatar) is an Angular screen reached by redirect, not part of Keycloak.
- Guests also need a Keycloak-issued token; the backend can't fake one.
