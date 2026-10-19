# Aides partagées du banc d'essai e2e (serveur, chromium, relais API, rapport).
import glob
import json
import os
import ssl
import subprocess
import sys
import time
import urllib.parse
import urllib.request

RACINE = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
PORT = int(os.environ.get("VR_PORT", "8899"))
BASE = f"http://localhost:{PORT}"

FAILS = []


def ok(label, cond, extra=""):
    print(("  ✓ " if cond else "  ✗ ") + label + (" — " + extra if extra else ""))
    if not cond:
        FAILS.append(label)
    return cond


def chromium_path():
    """Chromium : VR_CHROMIUM, sinon /opt/pw-browsers, sinon None (Playwright par défaut)."""
    p = os.environ.get("VR_CHROMIUM")
    if p and os.path.isfile(p):
        return p
    for c in sorted(glob.glob("/opt/pw-browsers/*/chrome-linux/chrome")):
        return c
    return None


def lancer(pw):
    exe = chromium_path()
    return pw.chromium.launch(executable_path=exe) if exe else pw.chromium.launch()


def bloquer_externe(ctx):
    """Toute requête hors localhost est coupée (tests hors-ligne, déterministes)."""
    ctx.route("**/*", lambda r: r.continue_() if "localhost" in r.request.url else r.abort())


def _ssl_ctx():
    ca = os.environ.get("VR_CA_BUNDLE") or "/root/.ccr/ca-bundle.crt"
    if os.path.isfile(ca):
        return ssl.create_default_context(cafile=ca)
    return ssl.create_default_context()


def relais(ctx, tuer_v1=False):
    """Pont-relais : les appels du navigateur vers les API (directs ou via les proxys
    CORS du site) sont satisfaits par Python (utile derrière un proxy d'egress qui
    bloque le navigateur). tuer_v1=True simule la disparition de v1/statistics."""
    sctx = _ssl_ctx()

    def fetch_real(url):
        req = urllib.request.Request(url, headers={"User-Agent": "voidrelay-e2e/1.0", "Accept": "application/json"})
        with urllib.request.urlopen(req, timeout=45, context=sctx) as r:
            return r.read()

    def handler(route):
        url = route.request.url
        if "localhost" in url:
            return route.continue_()
        target = None
        if "voidrelay-prix" in url or "warframe-proxy" in url or "allorigins" in url or "codetabs" in url:
            q = urllib.parse.parse_qs(urllib.parse.urlparse(url).query)
            target = (q.get("url") or q.get("quest") or [None])[0]
        elif url.startswith("https://api.warframe.market") or url.startswith("https://api.warframestat.us"):
            target = url
        if target:
            if tuer_v1 and "/v1/items/" in target and "/statistics" in target:
                return route.fulfill(status=404, content_type="application/json", body='{"error":"Not found."}')
            try:
                return route.fulfill(status=200, content_type="application/json", body=fetch_real(target))
            except Exception as e:
                return route.fulfill(status=502, body=str(e))
        return route.abort()

    ctx.route("**/*", handler)


def demarrer_serveur():
    """Démarre le serveur local à URL propres ; renvoie le process (ou None si déjà up)."""
    try:
        urllib.request.urlopen(BASE + "/", timeout=2)
        return None
    except Exception:
        pass
    proc = subprocess.Popen([sys.executable, os.path.join(os.path.dirname(__file__), "serveur_local.py")],
                            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    for _ in range(30):
        time.sleep(0.3)
        try:
            urllib.request.urlopen(BASE + "/", timeout=2)
            return proc
        except Exception:
            continue
    raise RuntimeError("serveur local injoignable sur " + BASE)


def bilan(nom):
    print()
    if FAILS:
        print(f"❌ {nom} : {len(FAILS)} échec(s)")
        for f in FAILS:
            print("   -", f)
        return 1
    print(f"✅ {nom} : tout passe")
    return 0
