# PROTOTYPE: remaining Keycloak pages (throwaway, never merged)

Answers [How do the remaining Keycloak pages look in the card style?](https://github.com/Marcel-Goehn/da-bubble/issues/33).

- `index.html`: open it in a browser. `?variant=A|B|C` × `?screen=error|terms|linkConfirm|linkEmail|brokerReauth|review|updateEmail|pending|reauthPassword|reauthGoogle`. Arrow keys: ←/→ variant, ↑/↓ screen. Under each card: when the page shows and which template variables it reads.
- `spike/`: a real Keycloak 26.8.1 with a `dump` login theme (parent=base; `template.ftl` = base's plus `dump.ftl`, which prints every variable of interest on every page) and `spike.py`, which drives each flow like a browser and prints the dump.
  `python3 spike/spike.py guest|pending|reauth|google|broker|review|error` (run from `spike/`; needs `admin.sh` there).

Run (same as the update-email prototype; set `sslRequired=NONE` on `master` once with kcadm):

```sh
podman pod create --name kc-pages -p 8080:8080 -p 8025:8025
podman run -d --pod kc-pages docker.io/axllent/mailpit:latest
podman run -d --pod kc-pages -e KC_BOOTSTRAP_ADMIN_USERNAME=admin -e KC_BOOTSTRAP_ADMIN_PASSWORD=admin \
  -v "$PWD/spike/import:/opt/keycloak/data/import:Z" -v "$PWD/spike/themes/dump:/opt/keycloak/themes/dump:Z" \
  quay.io/keycloak/keycloak:26.8.1 start-dev --import-realm
```

For `review`, disable `VERIFY_PROFILE` in the `fake-google` realm first, or the stand-in Google asks for the name itself.
