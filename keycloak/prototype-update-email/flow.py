"""PROTOTYPE: drive Keycloak's UPDATE_EMAIL flow like a browser and print every page.

Usage: python3 flow.py pending|reauth|google|discard
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


def start_change(b, new_email):
    url, verifier = auth_url(kc_action="UPDATE_EMAIL")
    url, body = go(b, url)
    show("kc_action=UPDATE_EMAIL", url, body)
    if 'name="email"' not in body:
        return url, body
    url, body = go(b, form_action(body), dict(email=new_email))
    show("after submitting new email", url, body)
    return url, body


mode = sys.argv[1] if len(sys.argv) > 1 else "pending"
tag = secrets.token_hex(2)

if mode in ("pending", "discard", "reauth", "cancel", "oldaddress"):
    email, new_email = "alice@example.com", f"alice.{tag}@example.com"
    discard(json.loads(admin("GET", "/realms/da-bubble/users?search=alice"))[0]["id"])  # start without a pending change
    b = browser()
    url, body, verifier = password_login(b, email)
    show("after password", url, body)
    tok = tokens(url, verifier)
    claims("tokens before change", tok)
    if mode == "reauth":
        print(f"\n   ... waiting {MAX_AUTH_AGE + 5}s so the login is older than max_auth_age")
        time.sleep(MAX_AUTH_AGE + 5)
        url, body = start_change(b, new_email)
        if 'name="password"' in body:
            url, body = go(b, form_action(body), dict(username=email, password="Passw0rd!x"))
            show("after re-entering password", url, body)
            url, body = go(b, form_action(body), dict(email=new_email))
            show("after submitting new email", url, body)
        sys.exit()
    if mode == "cancel":
        url, verifier = auth_url(kc_action="UPDATE_EMAIL")
        url, body = go(b, url)
        url, body = go(b, form_action(body), {"cancel-aia": "true"})
        show("Cancel on the kc_action page", url, body)
        sys.exit()
    url, body = start_change(b, new_email)
    user_id = user_state(email)
    if mode == "oldaddress":
        url, verifier = auth_url()
        url, body = go(b, url)
        url, body = go(b, form_action(body), dict(email=email))
        show("type the old address on the pending page", url, body)
        user_state(email)
        sys.exit()
    claims("refresh while pending", refresh(tok))

    url, verifier = auth_url(prompt="none")
    url, body = go(b, url)
    show("silent check-sso (prompt=none) while pending", url, body)
    if "code=" in url:
        claims("tokens from silent check-sso", tokens(url, verifier))

    url, verifier = auth_url()
    url, body = go(b, url)
    show("normal auth request, same browser (= page reload)", url, body)

    b2 = browser()
    url, body, verifier = password_login(b2, email)
    show("fresh browser, after password", url, body)

    if mode == "discard":
        print("\n== discard via Admin API")
        discard(user_id)
        user_state(email)
        url, verifier = auth_url()
        url, body = go(b, url)
        show("normal auth request after discard", url, body)
        url, body = go(browser(), latest_link(new_email))
        show("old mail link after discard", url, body)
        sys.exit()

    # resubmit the prefilled form on the pending page: resend, then the cooldown
    url, body = go(b2, form_action(body), dict(email=new_email))
    show("resubmit prefilled address on pending page", url, body)
    url, verifier = auth_url()
    url, body = go(b2, url)
    url, body = go(b2, form_action(body), dict(email=new_email))
    show("resubmit again at once (cooldown?)", url, body)

    url, body = go(browser(), latest_link(new_email))
    show("open mail link (other browser)", url, body)
    user_state(new_email)
    claims("refresh after confirming", refresh(tok))

if mode == "google":
    b = browser()
    url, verifier = auth_url()
    url, body = go(b, url)
    broker = html.unescape(re.search(r'href="([^"]+/broker/google/login[^"]*)"', body).group(1))
    url, body = go(b, KC.rsplit("/realms", 1)[0] + broker if broker.startswith("/") else broker)
    show("stand-in Google login page", url, body)
    url, body = go(b, form_action(body), dict(username="gina@example.com", password="Passw0rd!x"))
    show("after Google login (first broker login)", url, body)
    if "code=" not in url:
        sys.exit("broker login did not reach the app")
    tok = tokens(url, verifier)
    claims("tokens", tok)
    print(f"\n   ... waiting {MAX_AUTH_AGE + 5}s so the login is older than max_auth_age")
    time.sleep(MAX_AUTH_AGE + 5)
    url, body = start_change(b, f"gina.{tag}@example.com")
    m = re.search(r'href="([^"]+/broker/google/login[^"]*)"', body)
    if m:
        href = html.unescape(m.group(1))
        url, body = go(b, KC.rsplit("/realms", 1)[0] + href if href.startswith("/") else href)
        show("clicked Google button (Google session still alive)", url, body)
        if 'name="email"' in body:
            url, body = go(b, form_action(body), dict(email=f"gina.{tag}@example.com"))
            show("after submitting new email", url, body)
    user_state("gina@example.com")
