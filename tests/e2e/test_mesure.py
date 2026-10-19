"""Mesure de l'engagement (v91) : ce que js/warp.js envoie à /api/evt, et /stats.

Le script ne parle QUE depuis voidrelay.fr. Pour l'essayer pour de vrai sans
toucher à la production, le navigateur résout voidrelay.fr vers le serveur local
(--host-resolver-rules) et chaque envoi vers /api/evt est intercepté ici.
On vérifie trois choses :
  1. en local (localhost), RIEN n'est envoyé — les tests ne salissent pas les chiffres ;
  2. sur voidrelay.fr, chaque geste suivi produit bien son événement, avec la
     page d'origine et rien d'autre ;
  3. /stats affiche les chiffres, et le jeton part en en-tête, jamais dans l'URL.
"""
import sys, json
sys.path.insert(0, "tests/e2e")
from playwright.sync_api import sync_playwright
from _outils import BASE, PORT, ok, chromium_path, bloquer_externe, demarrer_serveur, bilan

PROD = "http://voidrelay.fr"
# Empêche toute navigation au clic : le geste est compté AVANT (écouteur en phase de
# capture), ce qui est précisément ce qu'on veut prouver.
SANS_NAV = "document.addEventListener('click', e => e.preventDefault())"


def main():
    srv = demarrer_serveur()
    with sync_playwright() as p:
        exe = chromium_path()
        # http://voidrelay.fr traité comme sécurisé : sinon navigator.clipboard n'existe
        # pas et le bouton « copier le nom » n'est même pas créé.
        args = [f"--host-resolver-rules=MAP voidrelay.fr 127.0.0.1:{PORT}",
                "--unsafely-treat-insecure-origin-as-secure=http://voidrelay.fr"]
        b = p.chromium.launch(executable_path=exe, args=args) if exe else p.chromium.launch(args=args)

        # --- 1. localhost : silence total ---
        ctx = b.new_context(viewport={"width": 1280, "height": 900}); bloquer_externe(ctx)
        envois_local = []
        ctx.route("**/api/evt*", lambda r: (envois_local.append(r.request.url), r.fulfill(status=204)))
        pg = ctx.new_page()
        pg.goto(BASE + "/o/arcane_energize", wait_until="load"); pg.wait_for_timeout(600)
        pg.evaluate(SANS_NAV)
        pg.click('[data-evt="favori"]'); pg.click('a[href^="https://warframe.market"]')
        pg.wait_for_timeout(400)
        ok("en local, aucun événement n'est envoyé", envois_local == [], str(envois_local))
        ctx.close()

        # --- 2. voidrelay.fr (résolu en local) : chaque geste est compté ---
        ctx = b.new_context(viewport={"width": 1280, "height": 900})
        recus = []

        def evt(r):
            if r.request.method == "POST":
                try: recus.append(json.loads(r.request.post_data or "{}"))
                except Exception: recus.append({"illisible": r.request.post_data})
            r.fulfill(status=204)
        ctx.route("**/*", lambda r: r.continue_() if ("voidrelay.fr" in r.request.url or "localhost" in r.request.url) else r.abort())
        ctx.route("**/api/evt*", evt)
        pg = ctx.new_page(); errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)[:160]))

        pg.goto(PROD + "/o/arcane_energize", wait_until="load"); pg.wait_for_timeout(700)
        pg.evaluate(SANS_NAV)
        pg.click('[data-evt="favori"]')
        pg.click('[data-evt="comparer"]')
        pg.click('[data-evt="copie"]')
        pg.click('[data-share] [data-net="reddit"]')
        pg.click('a[href^="https://warframe.market"]')
        pg.click(".langbtn")
        pg.wait_for_timeout(300)

        pg.goto(PROD + "/", wait_until="load"); pg.wait_for_timeout(500)
        pg.evaluate(SANS_NAV)
        pg.fill("#vr-search", "energize"); pg.wait_for_timeout(900)
        pg.click("#vr-search-results .vr-search-opt")
        pg.fill("#vr-search", "rhino"); pg.wait_for_timeout(900)
        pg.press("#vr-search", "Enter")
        pg.wait_for_timeout(500)

        vus = [(x.get("e"), x.get("d")) for x in recus]
        for attendu in [("favori", ""), ("comparer", ""), ("copie", ""), ("partage", "reddit"),
                        ("sortie", "warframe.market"), ("langue", ""), ("recherche", "")]:
            ok(f"geste compté : {attendu[0]}" + (f" ({attendu[1]})" if attendu[1] else ""), attendu in vus, str(vus))
        ok("la recherche à la touche Entrée compte aussi (2 recherches)", vus.count(("recherche", "")) == 2, str(vus))
        ok("chaque envoi porte la page d'origine, et seulement e/d/p",
           all(set(x) == {"e", "d", "p"} and str(x.get("p", "")).startswith("/") for x in recus), json.dumps(recus)[:200])
        ok("la page objet est bien l'origine du départ vers warframe.market",
           any(x.get("e") == "sortie" and x.get("p") == "/o/arcane_energize" for x in recus))
        ok("zéro erreur JS", errs == [], str(errs))
        ctx.close()

        # --- 3. /stats ---
        ctx = b.new_context(viewport={"width": 900, "height": 1000}); bloquer_externe(ctx)
        lectures = []
        DONNEES = {"ok": True, "jours": 30, "depuis": "2026-08-28",
                   "parJour": [{"jour": "2026-09-26", "e": "sortie", "n": 42}, {"jour": "2026-09-26", "e": "recherche", "n": 17}],
                   "parDetail": [{"e": "sortie", "d": "warframe.market", "n": 40}, {"e": "sortie", "d": "overframe.gg", "n": 2},
                                 {"e": "recherche", "d": "", "n": 17}],
                   "pages": [{"e": "sortie", "p": "/o/arcane_energize", "n": 12}]}

        def lire(r):
            h = r.request.headers.get("x-vr-admin")
            lectures.append((r.request.url, h))
            if h == "SECRET":
                r.fulfill(status=200, content_type="application/json", body=json.dumps(DONNEES))
            else:
                r.fulfill(status=401, content_type="application/json", body=json.dumps({"ok": False, "error": "réservé au Chef"}))
        ctx.route("**/api/evt*", lire)
        pg = ctx.new_page(); errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)[:160]))
        pg.goto(BASE + "/stats", wait_until="networkidle")
        ok("/stats n'est pas indexable", "noindex" in (pg.get_attribute('meta[name="robots"]', "content") or ""))
        ok("sans jeton, aucune lecture", lectures == [], str(lectures))
        pg.fill("#st-t", "MAUVAIS"); pg.click("#st-go"); pg.wait_for_timeout(400)
        ok("un mauvais jeton est annoncé clairement", "Refusé" in (pg.text_content("#st-etat") or ""))
        pg.fill("#st-t", "SECRET"); pg.click("#st-go"); pg.wait_for_timeout(500)
        tuile = pg.text_content(".st-tuile b") or ""
        ok("la première tuile = départs vers warframe.market (40)", tuile.strip() == "40", tuile)
        ok("le tableau des pages liste la page objet", "/o/arcane_energize" in (pg.text_content("#st-res") or ""))
        ok("le jeton part en en-tête, jamais dans l'URL",
           any(h == "SECRET" for _, h in lectures) and not any("SECRET" in u for u, _ in lectures))
        ok("zéro erreur JS sur /stats", errs == [], str(errs))
        b.close()
    if srv: srv.terminate()
    sys.exit(bilan("mesure de l'engagement"))


if __name__ == "__main__":
    main()
