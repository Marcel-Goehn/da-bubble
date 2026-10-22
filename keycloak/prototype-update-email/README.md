# PROTOTYPE: UPDATE_EMAIL flow on Keycloak 26.8.1 (throwaway, never merged)

Answers [Does the UPDATE_EMAIL flow behave as researched?](https://github.com/Marcel-Goehn/da-bubble/issues/29).

- `import/da-bubble-realm.json`: throwaway realm with `UPDATE_EMAIL` enabled (`max_auth_age` 20 s so the re-login check can be tested fast), the `kc.email.pending` → `email_pending` mapper and `actionTokenGeneratedByUserLifespan.update-email` = 86400.
- `import/fake-google-realm.json`: a second realm used as a stand-in for Google (generic `oidc` IdP, same broker code path as the `google` provider).
- `flow.py`: drives the flow like a browser. `python3 flow.py pending|reauth|google|cancel|oldaddress|discard`.
- `admin.sh`: Admin API calls as the bootstrap admin.

Run (rootless podman makes host requests look external, so `sslRequired` is `none` in the realms; set it on `master` once with `kcadm.sh update realms/master -s sslRequired=NONE`):

```sh
podman pod create --name kc-email -p 8080:8080 -p 8025:8025
podman run -d --pod kc-email docker.io/axllent/mailpit:latest
podman run -d --pod kc-email -e KC_BOOTSTRAP_ADMIN_USERNAME=admin -e KC_BOOTSTRAP_ADMIN_PASSWORD=admin \
  -v "$PWD/import:/opt/keycloak/data/import:Z" quay.io/keycloak/keycloak:26.8.1 start-dev --import-realm
```
