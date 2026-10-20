# PROTOTYPE: email-verification screens (throwaway, never merged)

Answers [What do the email-verification screens look like?](https://github.com/Marcel-Goehn/da-bubble/issues/12).

- `index.html`: open it in a browser. `?variant=A|B|C`, `?screen=check|confirm|verified`, `?state=idle|sent|cooldown`. Arrow keys: ←/→ variant, ↑/↓ screen.
- `flow-check/`: drives a real Keycloak 26.8.1 registration like a browser to confirm the required-action order.
  Run Keycloak + Mailpit (podman pod, ports 8080/8025) with `realm.json` imported via `start-dev --import-realm`, then `python3 flow-check/flow.py same|other`.
