# PROTOTYPE: Keycloak emails (throwaway, never merged)

Answers [How do the Keycloak emails look?](https://github.com/Marcel-Goehn/da-bubble/issues/34).
Design: the Figma frame `17. Gmail - email` (`docs/design/pages/`), used for all three emails.

- `index.html`: open it in a browser. `?mail=reset|verify|update`, ↑/↓ cycles; "Text-Teil" shows the plain-text part, "430 px" the phone width.
- `spike/themes/dabubble/email/`: a working email theme (parent=base): `html/template.ftl` holds the layout as a macro,
  `html/*.ftl` and `text/*.ftl` per email, copy in `messages/messages_de.properties`, logo at `resources/img/logo.png`
  (cropped from the Figma frame at 1x; the real one is a 2x export).
- `spike/emails.py`: sends all three emails through Keycloak 26.8.1 and prints sender, subject, link lifetime (from the token), logo URL + status and the text part.
  `out-*.html` are the delivered HTML parts.

Run (from `spike/`):

```sh
podman pod create --name kc-mails -p 8080:8080 -p 8025:8025
podman run -d --pod kc-mails docker.io/axllent/mailpit:latest
podman run -d --pod kc-mails -e KC_BOOTSTRAP_ADMIN_USERNAME=admin -e KC_BOOTSTRAP_ADMIN_PASSWORD=admin \
  -v "$PWD/import:/opt/keycloak/data/import:Z" -v "$PWD/themes/dabubble:/opt/keycloak/themes/dabubble:Z" \
  quay.io/keycloak/keycloak:26.8.1 start-dev --import-realm
# once: kcadm.sh update realms/master -s sslRequired=NONE (inside the container, after kcadm config credentials)
python3 emails.py   # then look at http://localhost:8025
```
