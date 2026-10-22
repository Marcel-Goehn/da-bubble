"""PROTOTYPE: confirm what the remaining Keycloak pages can see, on a real Keycloak 26.8.1 with the "dump" theme.

Usage: python3 spike.py guest|pending|reauth|google|broker|review|error
"""
import base64, hashlib, html, http.cookiejar, json, re, secrets, subprocess, sys, time
import urllib.parse, urllib.request

KC = "http://localhost:8080/realms/da-bubble"
MAIL = "http://localhost:8025/api/v1"
REDIRECT = "http://localhost:4200/"
MAX_AUTH_AGE = 20  # UPDATE_EMAIL config in the realm JSON
urllib.request.install_opener(urllib.request.build_opener(urllib.request.ProxyHandler({})))


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        # follow Keycloak's own redirects, stop at the app
        return None if newurl.startswith(REDIRECT) else super().redirect_request(req, fp, code, msg, headers, newurl)


def browser():
    # browsers treat localhost as secure, so they send Keycloak's Secure cookies over http
    policy = http.cookiejar.DefaultCookiePolicy()
    policy.return_ok_secure = lambda cookie, request: True
    jar = http.cookiejar.CookieJar(policy)
    return urllib.request.build_opener(urllib.request.ProxyHandler({}), urllib.request.HTTPCookieProcessor(jar), NoRedirect())


def go(op, url, data=None):
    try:
        r = op.open(url, urllib.parse.urlencode(data).encode() if data is not None else None)
        return r.geturl(), r.read().decode()
    except urllib.error.HTTPError as e:
        if e.code in (301, 302, 303) and e.headers["Location"].startswith(REDIRECT):
            return e.headers["Location"], ""
        return url, e.read().decode()


def text(fragment):
    return " ".join(html.unescape(re.sub("<.*?>", " ", fragment)).split())


def show(step, url, body):
    print(f"\n== {step}\n   url:    {url[:150]}")
    if not body:
        q = urllib.parse.parse_qs(urllib.parse.urlparse(url).query)
        print("   app got:", {k: v[0][:20] for k, v in q.items()})
        return
    title = re.search(r'id="kc-page-title"[^>]*>(.*?)</h1>', body, re.S)
    if title:
        print("   title: ", text(title.group(1)))
    for t in re.findall(r'class="(?:instruction|kc-feedback-text|pf-v5-c-alert__title[^"]*)"[^>]*>(.*?)</', body, re.S):
        if text(t):
            print("   text:  ", text(t))
    for name, value in re.findall(r'<input[^>]+name="([^"]+)"(?:[^>]+value="([^"]*)")?', body):
        print(f"   input:  {name}={html.unescape(value)!r}")
    for b in re.findall(r'<(?:button|input)[^>]+type="submit"[^>]*?(?:value="([^"]*)")?[^>]*>([^<]*)', body):
        print("   button:", text(b[0] or b[1]))
    for href, t in re.findall(r'<a[^>]+href="([^"]+)"[^>]*>(.*?)</a>', body, re.S):
        if "login-actions" in href or "broker" in href or REDIRECT in href or "logout" in href:
            print(f"   link:   {text(t)!r} -> {html.unescape(href)[:100]}")


def form_action(body):
    return html.unescape(re.search(r'<form[^>]+action="([^"]+)"', body).group(1))


def auth_url(**extra):
    verifier = secrets.token_urlsafe(48)
    challenge = base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).rstrip(b"=").decode()
    q = dict(client_id="da-bubble-app", redirect_uri=REDIRECT, response_type="code", scope="openid",
             code_challenge=challenge, code_challenge_method="S256", state="s", nonce="n", **extra)
    return f"{KC}/protocol/openid-connect/auth?" + urllib.parse.urlencode(q), verifier


def tokens(url, verifier):
    code = urllib.parse.parse_qs(urllib.parse.urlparse(url).query)["code"][0]
    data = dict(grant_type="authorization_code", code=code, redirect_uri=REDIRECT, client_id="da-bubble-app", code_verifier=verifier)
    return json.load(urllib.request.urlopen(f"{KC}/protocol/openid-connect/token", urllib.parse.urlencode(data).encode()))


def refresh(tok):
    data = dict(grant_type="refresh_token", refresh_token=tok["refresh_token"], client_id="da-bubble-app")
    try:
        return json.load(urllib.request.urlopen(f"{KC}/protocol/openid-connect/token", urllib.parse.urlencode(data).encode()))
    except urllib.error.HTTPError as e:
        return {"error": e.read().decode()}


def claims(step, tok):
    if "error" in tok:
        print(f"\n== {step}\n   error:  {tok['error']}")
        return
    p = tok["access_token"].split(".")[1]
    c = json.loads(base64.urlsafe_b64decode(p + "=" * (-len(p) % 4)))
    print(f"\n== {step}\n   claims: " + json.dumps({k: c.get(k) for k in ("email", "email_verified", "email_pending")}))


def admin(method, path, *args):
    return subprocess.run(["./admin.sh", method, path, *args], capture_output=True, text=True).stdout.strip()


def user_state(email):
    u = json.loads(admin("GET", f"/realms/da-bubble/users?exact=true&email={email}"))[0]
    full = json.loads(admin("GET", f"/realms/da-bubble/users/{u['id']}?userProfileMetadata=false"))
    print(f"   admin:  email={full['email']} verified={full['emailVerified']} requiredActions={full.get('requiredActions')} "
          f"attributes={full.get('attributes')}")
    return u["id"]


def discard(user_id):
    # a partial PUT fails user-profile validation, and [] or a missing key leaves the attribute: send the full user with [""]
    u = json.loads(admin("GET", f"/realms/da-bubble/users/{user_id}"))
    u["attributes"] = {**u.get("attributes", {}), "kc.email.pending": [""]}
    u["requiredActions"] = [a for a in u.get("requiredActions", []) if a != "UPDATE_EMAIL"]
    print("   discard PUT:", admin("PUT", f"/realms/da-bubble/users/{user_id}", "-d", json.dumps(u)) or "204")


def mails(to):
    return json.load(urllib.request.urlopen(f"{MAIL}/search?query=to:{urllib.parse.quote(to)}"))["messages"]


def latest_link(to, count=1):
    for _ in range(20):
        msgs = mails(to)
        if len(msgs) >= count:
            m = json.load(urllib.request.urlopen(f"{MAIL}/message/{msgs[0]['ID']}"))
            print(f"   mail:   {len(msgs)} to {to}, latest {m['Subject']!r}")
            return html.unescape(re.search(r'href="([^"]+action-token[^"]+)"', m["HTML"]).group(1))
        time.sleep(1)
    sys.exit("no mail")


def password_login(b, email, **extra):
    url, verifier = auth_url(**extra)
    url, body = go(b, url)
    show("login page", url, body)
    url, body = go(b, form_action(body), dict(username=email, password="Passw0rd!x"))
    return url, body, verifier


def dump(step, url, body):
    show(step, url, body)
    m = re.search(r'<pre id="dump">(.*?)</pre>', body, re.S)
    if m:
        for line in html.unescape(m.group(1)).strip().splitlines():
            if not line.endswith(("=-", "=false")) or "??" in line or "authenticatorConfigured" in line:
                print("   dump:  ", line)


def google_login(b, who, extra=None):
    url, verifier = auth_url(**(extra or {}))
    url, body = go(b, url)
    href = html.unescape(re.search(r'href="([^"]+/broker/google/login[^"]*)"', body).group(1))
    url, body = go(b, KC.rsplit("/realms", 1)[0] + href if href.startswith("/") else href)
    url, body = go(b, form_action(body), dict(username=who, password="Passw0rd!x"))
    return url, body, verifier


def kc_action(b):
    url, _ = auth_url(kc_action="UPDATE_EMAIL")
    return go(b, url)


def wait_auth_age():
    print(f"\n   ... waiting {MAX_AUTH_AGE + 5}s so the login is older than max_auth_age")
    time.sleep(MAX_AUTH_AGE + 5)


mode = sys.argv[1]
tag = secrets.token_hex(2)

if mode == "guest":
    # 4: the realm-JSON Guest must land in the app without terms.ftl, although TERMS_AND_CONDITIONS is a default action
    url, body, _ = password_login(browser(), "guest@dabubble.com")
    dump("Gäste-Login after password", url, body)
    user_state("guest@dabubble.com")

if mode == "pending":
    # 1: user.attributes.email on the pending page, then "Alte Adresse behalten" as a hidden post of it
    discard(json.loads(admin("GET", "/realms/da-bubble/users?search=alice"))[0]["id"])
    b = browser()
    url, body, _ = password_login(b, "alice@example.com")
    url, body = kc_action(b)
    dump("kc_action=UPDATE_EMAIL (first form)", url, body)
    url, body = go(b, form_action(body), dict(email=f"alice.{tag}@example.com"))
    url, body = go(browser(), auth_url()[0])  # fresh browser: log in again while pending
    url, body = go(b := browser(), auth_url()[0])
    url, body = go(b, form_action(body), dict(username="alice@example.com", password="Passw0rd!x"))
    dump("pending page after login", url, body)
    old = re.search(r"user\.attributes\.email=(\S+)", html.unescape(body)).group(1)
    url, body = go(b, form_action(body), dict(email=old))
    dump(f"hidden post email={old} ('Alte Adresse behalten')", url, body)
    user_state("alice@example.com")

if mode == "reauth":
    # 2 (password User): the max_auth_age re-login arrives with the User known
    b = browser()
    password_login(b, "alice@example.com")
    wait_auth_age()
    url, body = kc_action(b)
    dump("re-auth login.ftl (password User)", url, body)

if mode == "google":
    # 2 (Google User): sign-up via Google sees terms.ftl, re-auth shows only the Google button
    b = browser()
    url, body, _ = google_login(b, "gina@example.com")
    dump("after Google sign-up", url, body)
    if "terms" in body.lower() and 'name="accept"' in body:
        url, body = go(b, form_action(body), dict(accept="Yes"))
        dump("after accepting terms", url, body)
    wait_auth_age()
    url, body = kc_action(b)
    dump("re-auth login.ftl (Google User)", url, body)

if mode == "broker":
    # 3: existing email via Google: link-confirm, link-email, and the broker re-auth login.ftl on first render
    b = browser()
    url, body, _ = google_login(b, "bob@example.com")
    dump("first broker login, email exists", url, body)
    url, body = go(b, form_action(body), dict(submitAction="linkAccount"))
    dump("after 'Add to existing account'", url, body)
    for href, t in re.findall(r'<a[^>]+href="([^"]+)"[^>]*>(.*?)</a>', body, re.S):
        print(f"   link:   {text(t)!r} -> {html.unescape(href)[:120]}")
    # "Einen anderen Weg versuchen" posts tryAnotherWay: the first render of the broker re-auth login.ftl
    url, body = go(b, form_action(body), dict(tryAnotherWay="on"))
    dump("after 'Einen anderen Weg versuchen'", url, body)
    if "select-authenticator" in body or 'name="authenticationExecution"' in body:
        ex = re.findall(r'name="authenticationExecution"[^>]*value="([^"]+)"', body)
        print("   executions:", ex)
        url, body = go(b, form_action(body), dict(authenticationExecution=ex[-1]))
        dump("picked the last option", url, body)
    if 'name="password"' in body:
        url, body = go(b, form_action(body), dict(username="bob@example.com", password="Passw0rd!x"))
        dump("after re-entering password", url, body)

if mode == "review":
    b = browser()
    url, body, _ = google_login(b, "nona@example.com")
    dump("Google user without a name", url, body)

if mode == "error":
    b = browser()
    url, body, _ = password_login(b, "alice@example.com")
    url, body = go(browser(), f"{KC}/login-actions/authenticate?session_code=x&execution=y&client_id=da-bubble-app&tab_id=z")
    dump("stale login-actions URL without cookies", url, body)
    url, body = go(browser(), auth_url()[0].replace("redirect_uri=http", "redirect_uri=https"))
    dump("bad redirect_uri", url, body)
