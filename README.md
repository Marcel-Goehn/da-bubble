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

### Host mode

To run the backend from your IDE or Gradle against the same stack:

```bash
docker compose stop backend
cd backend && ./gradlew bootRun
```

The backend's defaults point at the stack's published ports on `localhost`, and it reads the root `.env` too. `docker compose start backend` switches back.

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
