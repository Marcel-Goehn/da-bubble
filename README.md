# DA Bubble

A Slack-style team chat. Monorepo: `frontend/` (Angular 22) and `backend/` (Spring Boot 4.1.1, Kotlin).

## Local stack

`compose.yaml` runs everything except the frontend:

| Service   | URL                         | What                                                                        |
| --------- | --------------------------- | --------------------------------------------------------------------------- |
| backend   | http://localhost:8081       | REST and WebSocket API (`/api`, `/ws`)                                      |
| Keycloak  | http://localhost:8080/admin | Login, realm `da-bubble`; admin console login defaults to `admin` / `admin` |
| Mailpit   | http://localhost:8025       | Catches every email Keycloak sends (SMTP on 1025)                           |
| SeaweedFS | http://localhost:8333       | S3 API, bucket `dabubble`                                                   |
| Postgres  | localhost:5432              | Databases `dabubble` (user `dabubble`) and `keycloak`, one volume           |

No `.env` is needed: every key has a dev default. To override one, copy `.env.example` to `.env`. Compose and the backend in host mode both read it.

### Start

```bash
docker compose up -d --wait
cd frontend && npm install && npm start
```

`--wait` returns once all five services report healthy. The first run builds the backend image, which takes a few minutes. Open http://localhost:4200. `ng serve` proxies `/api` and `/ws` to the backend on 8081, so the browser sees a single origin.

After changing backend code, rebuild the image with `docker compose up -d --wait --build backend`.

### Guest

"Gäste-Login" on the login page logs in as the one shared Guest (`guest@dabubble.com`, password `GUEST_PASSWORD`). The realm import creates it with the `guest` role and nothing else, so without `manage-account` the account console is closed to it, and the theme posts its credentials through the normal login. Keycloak would run a `kc_action` (UPDATE_PASSWORD, UPDATE_EMAIL, ...) for any User, so the realm's browser flow denies the Guest whenever one is requested, using the "Condition - kc_action requested" from `keycloak/extension/`. The reset flow denies the Guest too.

### Keycloak image

Compose builds Keycloak from `keycloak/Dockerfile`: the stock image plus the provider jar from `keycloak/extension/` (Maven, built inside the image build). After changing the extension, rebuild with `docker compose up -d --wait --build keycloak`.

### Host mode

To run the backend from your IDE or Gradle against the same stack:

```bash
docker compose stop backend
cd backend && ./gradlew bootRun
```

The backend's defaults point at the stack's published ports on `localhost`, and it reads the root `.env` too. `docker compose start backend` switches back.

### Keycloak theme

The login pages and emails are the hand-written `da-bubble` theme in `keycloak/themes/da-bubble/` (FreeMarker, parent `base`, German and English bundles). Compose bind-mounts it and `start-dev` doesn't cache themes, so `.ftl` and message edits show on the next page load. Verification and reset emails land in Mailpit.

The theme's CSS is Tailwind with the app's `tokens.css`, built from `frontend/src/keycloak-theme.css`. After changing classes in a `.ftl` file or the tokens, rebuild it; the result is committed, and `npm run check` fails while it's stale:

```bash
cd frontend && npm run build:keycloak-theme
```

The email lifetimes ("24 Stunden") are written out in `email/messages/`; keep them in step with the realm's `actionTokenGeneratedByUserLifespan.*` attributes.

### Reset

```bash
docker compose down -v
```

This deletes the Postgres and SeaweedFS volumes: all app data, every Keycloak user and the realm. The next `up` re-imports the realm from `keycloak/import/da-bubble-realm.json`. That is also how realm JSON changes take effect, because Keycloak skips the import while the realm exists.

## Checks

```bash
cd backend && ./gradlew check
cd frontend && npm run check
```

### E2E and Lighthouse

Before merging UI, auth, realtime or Keycloak changes, run the Playwright journeys and the Lighthouse gate. The first time, install the browser with `npx playwright install chromium`.

```bash
cd frontend
npm run e2e         # resets the stack (down -v && up -d --wait), then runs the journeys
npm run lighthouse  # starts the stack if needed; fails below 90 for Accessibility
```

Both start `ng serve --configuration production` themselves, so stop a running `ng serve` first. The journeys live in `frontend/e2e/`: `support/` holds the fixtures (Users created through the Keycloak Admin API, a Mailpit reader, the axe check every visited screen runs). Failures leave a trace and the HTML report in `frontend/playwright-report/` (`npx playwright show-report`); Lighthouse's reports are attached there too.
