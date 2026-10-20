"""PROTOTYPE: drive Keycloak registration like a browser and print every page."""
import base64, hashlib, html, http.cookiejar, json, re, secrets, sys, time
import urllib.parse, urllib.request

KC = "http://localhost:8080/realms/da-bubble"
MAIL = "http://localhost:8025/api/v1"
EMAIL = f"proto{secrets.token_hex(3)}@example.com"
REDIRECT = "http://localhost:4200/"


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        # follow Keycloak's own redirects, stop at the app
        return None if newurl.startswith(REDIRECT) else super().redirect_request(req, fp, code, msg, headers, newurl)


def browser():
    # browsers treat localhost as secure, so they send Keycloak's Secure cookies over http
    policy = http.cookiejar.DefaultCookiePolicy()
    policy.return_ok_secure = lambda cookie, request: True
    jar = http.cookiejar.CookieJar(policy)
    return urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar), NoRedirect())


def go(op, url, data=None):
    try:
        r = op.open(url, urllib.parse.urlencode(data).encode() if data else None)
        return r.geturl(), r.read().decode()
    except urllib.error.HTTPError as e:
        if e.code in (301, 302, 303) and e.headers["Location"].startswith(REDIRECT):
            return e.headers["Location"], ""
        raise


def show(step, url, body):
    title = re.search(r'id="kc-page-title"[^>]*>(.*?)</h1>', body, re.S)
    info = re.findall(r'class="(?:instruction|kc-feedback-text|pf-v5-c-alert__title[^"]*)"[^>]*>(.*?)<', body, re.S)
    links = re.findall(r'<a[^>]+href="([^"]+)"[^>]*>(.*?)</a>', body, re.S)
    print(f"\n== {step}\n   url:   {url[:140]}")
    if title:
        print("   title:", " ".join(html.unescape(re.sub("<.*?>", "", title.group(1))).split()))
    for i in info:
        t = " ".join(html.unescape(re.sub("<.*?>", "", i)).split())
        if t:
            print("   text: ", t)
    for href, text in links:
        t = " ".join(html.unescape(re.sub("<.*?>", "", text)).split())
        if "login-actions" in href or "redirect" in href.lower() or REDIRECT in href:
            print(f"   link:  {t!r} -> {html.unescape(href)[:110]}")
    inputs = re.findall(r'<input[^>]+name="([^"]+)"', body)
    if inputs:
        print("   inputs:", inputs)


def form_action(body):
    return html.unescape(re.search(r'<form[^>]+action="([^"]+)"', body).group(1))


def auth_url(path="auth"):
    verifier = secrets.token_urlsafe(48)
    challenge = base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).rstrip(b"=").decode()
    q = dict(client_id="da-bubble-app", redirect_uri=REDIRECT, response_type="code", scope="openid",
             code_challenge=challenge, code_challenge_method="S256", state="s", nonce="n")
    return f"{KC}/protocol/openid-connect/{path}?" + urllib.parse.urlencode(q)


def latest_link():
    for _ in range(20):
        msgs = json.load(urllib.request.urlopen(f"{MAIL}/search?query=to:{EMAIL}"))["messages"]
        if msgs:
            m = json.load(urllib.request.urlopen(f"{MAIL}/message/{msgs[0]['ID']}"))
            print(f"\n== mail: {m['Subject']!r}")
            return html.unescape(re.search(r'href="([^"]+action-token[^"]+)"', m["HTML"]).group(1))
        time.sleep(1)
    sys.exit("no mail")


mode = sys.argv[1] if len(sys.argv) > 1 else "same"
b = browser()
url, body = go(b, auth_url("registrations"))
show("1 register form", url, body)
url, body = go(b, form_action(body), dict(firstName="Proto", lastName="Typ", email=EMAIL))
show("2 after register", url, body)
url, body = go(b, form_action(body), {"password-new": "Passw0rd!x", "password-confirm": "Passw0rd!x"})
show("3 after set password", url, body)
if mode == "resend":
    resend = re.search(r'href="([^"]+)"[^>]*>[^<]*(?:Click here|Klicken Sie hier)', body)
    print("\n   resend link:", resend and html.unescape(resend.group(1))[:110])
link = latest_link()
if mode == "other":
    b = browser()
url, body = go(b, link)
show("4 open mail link" + (" (different browser)" if mode == "other" else ""), url, body)
if mode == "other" and body:
    nxt = re.search(r'href="([^"]+)"[^>]*>\s*(?:&raquo;|»)?\s*(?:Click here|Klicken)', body)
    if nxt:
        url, body = go(b, html.unescape(nxt.group(1)))
        show("5 after confirm link", url, body)
