import sys, json
sys.path.insert(0, "tests/e2e")
from playwright.sync_api import sync_playwright
from _outils import BASE, ok, lancer, bloquer_externe, demarrer_serveur, bilan

FILE = {"ok": True, "builds": [{
    "id": 7, "arme": "/Lotus/Weapons/Soma", "titre": "Build masqué <b>test</b>",
    "auteur": "Tenno", "notes": "Notes du build", "cree": "2026-09-05 06:00:00",
    "lien": "https://voidrelay.fr/arsenal#z=ABC"}]}

def main():
    srv = demarrer_serveur()
    with sync_playwright() as p:
        b = lancer(p); ctx = b.new_context(viewport={"width": 900, "height": 1000}); bloquer_externe(ctx)
        vus = []
        def route(r):
            u = r.request.url; vus.append((r.request.method, u, r.request.headers.get("x-vr-admin")))
            if r.request.method == "POST":
                r.fulfill(status=200, content_type="application/json", body=json.dumps({"ok": True, "id": 7, "statut": "ok"}))
            elif "statut=attente" in u:
                if r.request.headers.get("x-vr-admin") != "SECRET":
                    r.fulfill(status=401, content_type="application/json",
                              body=json.dumps({"ok": False, "error": "réservé à la modération"}))
                else:
                    r.fulfill(status=200, content_type="application/json", body=json.dumps(FILE))
            else:
                r.fulfill(status=200, content_type="application/json", body=json.dumps({"ok": True, "builds": []}))
        ctx.route("**/api/builds*", route)
        pg = ctx.new_page(); errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)[:160]))
        pg.goto(BASE + "/moderation", wait_until="networkidle", timeout=30000)

        ok("la page n'est pas indexable",
           "noindex" in (pg.get_attribute('meta[name="robots"]', "content") or ""))
        ok("sans jeton, aucune requête à l'API", len(vus) == 0, str(vus))

        pg.fill("#md-t", "MAUVAIS"); pg.click("#md-go"); pg.wait_for_timeout(500)
        ok("un mauvais jeton est annoncé clairement",
           "réservé" in (pg.text_content("#md-etat") or ""), (pg.text_content("#md-etat") or "")[:80])
        ok("et la file reste vide", (pg.inner_html("#md-liste") or "").strip() == "")

        pg.fill("#md-t", "SECRET"); pg.click("#md-go"); pg.wait_for_timeout(600)
        ok("le jeton part dans l'en-tête X-VR-Admin, jamais dans l'URL",
           any(h == "SECRET" for _, _, h in vus) and not any("SECRET" in u for _, u, _ in vus))
        ok("le build masqué est listé", pg.evaluate("()=>document.querySelectorAll('.md-b').length") == 1)
        ok("le titre est ÉCHAPPÉ, pas interprété",
           pg.evaluate("()=>document.querySelector('.md-b h2').innerHTML").find("&lt;b&gt;") >= 0,
           pg.evaluate("()=>document.querySelector('.md-b h2').innerHTML"))
        ok("le champ du jeton est vidé après usage", pg.input_value("#md-t") == "")
        ok("le lien vers l'arsenal est cliquable",
           "arsenal#z=" in (pg.get_attribute(".md-lien a", "href") or ""))

        pg.click("[data-ok]"); pg.wait_for_timeout(500)
        ok("republier envoie bien {id, ok:true}",
           any(m == "POST" for m, _, _ in vus) and "republié" in (pg.text_content("#md-etat") or ""),
           (pg.text_content("#md-etat") or "")[:60])

        pg.click("#md-out"); pg.wait_for_timeout(200)
        ok("« oublier le jeton » l'efface vraiment",
           pg.evaluate("()=>localStorage.getItem('vr_admin')") is None)
        ok("zéro erreur JS", not errs, str(errs))
    return bilan("page de modération")

if __name__ == "__main__":
    sys.exit(main())
