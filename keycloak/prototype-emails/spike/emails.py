"""PROTOTYPE: send the three Keycloak emails through the dabubble email theme and print what arrives in Mailpit.

Usage (from spike/): python3 emails.py
verify = password login of a User with the VERIFY_EMAIL required action (what follows registration),
reset = "Passwort vergessen?" in a browser-like session, update = kc_action=UPDATE_EMAIL right after a password login.
"""
import base64, html, json, re, time, urllib.parse, urllib.request

from kc import KC, MAIL, REDIRECT, admin, auth_url, browser, form_action, go, password_login

NEW = f"alice+{int(time.time())}@neu.example.com"


def claims_of(link):
    key = urllib.parse.parse_qs(urllib.parse.urlparse(link).query)["key"][0].split(".")[1]
    return json.loads(base64.urlsafe_b64decode(key + "=" * (-len(key) % 4)))


def wait_mail(to, subject_hint=""):
    for _ in range(20):
        msgs = json.load(urllib.request.urlopen(f"{MAIL}/search?query=to:{urllib.parse.quote(to)}"))["messages"]
        if msgs:
            return json.load(urllib.request.urlopen(f"{MAIL}/message/{msgs[0]['ID']}"))
        time.sleep(1)
    raise SystemExit(f"no mail to {to}")


def report(name, m):
    print(f"\n== {name}")
    print(f"   from:     {m['From']['Name']} <{m['From']['Address']}>   to: {m['To'][0]['Address']}")
    print(f"   subject:  {m['Subject']}")
    link = html.unescape(re.search(r'href="([^"]+action-token[^"]+)"', m["HTML"]).group(1))
    c = claims_of(link)
    print(f"   link:     typ={c.get('typ')} lifetime={(c['exp'] - c['iat']) // 60} min")
    img = re.search(r'<img[^>]+src="([^"]+)"', m["HTML"])
    src = html.unescape(img.group(1)) if img else None
    status = urllib.request.urlopen(src).status if src and src.startswith("http") else "not absolute"
    print(f"   logo:     {src} -> {status}")
    lines = [l for l in m["Text"].splitlines()]
    print("   text part:")
    for l in lines:
        print("     |", l[:110])
    with open(f"out-{name}.html", "w") as f:
        f.write(m["HTML"])


urllib.request.urlopen(urllib.request.Request(f"{MAIL}/messages", method="DELETE"))

# verify
bob = json.loads(admin("GET", "/realms/da-bubble/users?exact=true&email=bob@example.com"))[0]["id"]
u = json.loads(admin("GET", f"/realms/da-bubble/users/{bob}"))
u.update(emailVerified=False, requiredActions=["VERIFY_EMAIL"])
admin("PUT", f"/realms/da-bubble/users/{bob}", "-d", json.dumps(u))
password_login(browser(), "bob@example.com")  # the VERIFY_EMAIL required action sends the mail, as after registration
report("verify", wait_mail("bob@example.com"))

# reset
b = browser()
url, body = go(b, auth_url()[0])
href = html.unescape(re.search(r'href="([^"]*reset-credentials[^"]*)"', body).group(1))
url, body = go(b, KC.rsplit("/realms", 1)[0] + href if href.startswith("/") else href)
url, body = go(b, form_action(body), dict(username="alice@example.com"))
report("reset", wait_mail("alice@example.com"))

# update
b = browser()
url, body, _ = password_login(b, "alice@example.com", kc_action="UPDATE_EMAIL")
url, body = go(b, form_action(body), dict(email=NEW))
report("update", wait_mail(NEW))
