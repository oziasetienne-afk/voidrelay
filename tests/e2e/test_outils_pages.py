#!/usr/bin/env python3
# Pages outils : items.json paresseux, vignettes locales (thumbs.js), parcours réels.
import json
import sys

from playwright.sync_api import sync_playwright

from _outils import BASE, ok, lancer, bloquer_externe, demarrer_serveur, bilan


def main():
    srv = demarrer_serveur()
    with sync_playwright() as p:
        b = lancer(p)

        # items.json paresseux + suggestions à la première frappe, sur les 4 pages
        for url, field in [("/courses", "caddq"), ("/favoris", "faddq"), ("/trade", "tradd"), ("/estimateur", "eq")]:
            ctx = b.new_context(viewport={"width": 1280, "height": 900})
            bloquer_externe(ctx)
            pg = ctx.new_page()
            loaded = []
            pg.on("response", lambda r: loaded.append(1) if "items.json" in r.url else None)
            errs = []
            pg.on("pageerror", lambda e: errs.append(str(e)[:120]))
            pg.goto(BASE + url, wait_until="networkidle", timeout=30000)
            ok(f"{url} : items.json PAS chargé au chargement", not loaded)
            pg.click("#" + field)
            pg.type("#" + field, "mesa prime", delay=45)
            pg.wait_for_timeout(1200)
            n = pg.evaluate("() => document.querySelectorAll('.ac-item').length")
            ok(f"{url} : suggestions à la première frappe", n > 0, f"{n}")
            ok(f"{url} : zéro erreur JS", not errs, str(errs[:2]))
            ctx.close()

        # estimateur ?q= : pré-remplissage résolu malgré le chargement paresseux
        ctx = b.new_context(viewport={"width": 1280, "height": 900})
        bloquer_externe(ctx)
        pg = ctx.new_page()
        errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)[:120]))
        pg.goto(BASE + "/estimateur?q=Mesa%20Prime%20Set", wait_until="domcontentloaded")
        pg.wait_for_timeout(2500)
        val = pg.evaluate("() => document.getElementById('eq').value")
        ok("estimateur ?q= : champ pré-rempli", val == "Mesa Prime Set" and not errs, f"val={val}")
        ctx.close()

        # v67 : sur un objet à RANGS, un seul prix est un mensonge. Les
        # statistiques sont remplacées par un relevé RÉEL du 04/09/2026
        # (Arcane Energize : 136,6 p au rang 5, 8,1 p au rang 0 — un facteur
        # dix-sept) pour que la vérification soit reproductible hors ligne.
        PAQUET = """{"payload":{"statistics_closed":{
            "48hours":[{"median":8.1,"volume":280,"mod_rank":0},
                       {"median":136.6,"volume":196,"mod_rank":5}],
            "90days":[]}}}"""
        for url, attendus in [
            ("/estimateur", ["se négocie par rang", "rang 5", "137 PL", "8 PL", "280 échangés"]),
            ("/en/price-check", ["trades by rank", "rank 5", "137 PL", "8 PL", "280 traded"]),
        ]:
            ctx = b.new_context(viewport={"width": 1280, "height": 900})
            bloquer_externe(ctx)
            pg = ctx.new_page()
            errs = []
            pg.on("pageerror", lambda e: errs.append(str(e)[:120]))
            pg.goto(BASE + url, wait_until="domcontentloaded")
            pg.wait_for_timeout(2000)
            # On remplace la source de statistiques, pas le rendu : c'est bien
            # le vrai chemin d'affichage qui est vérifié.
            pg.evaluate("p => { API.marketStats = () => Promise.resolve(JSON.parse(p)); }", PAQUET)
            pg.fill("#eq", "Arcane Energize")
            pg.wait_for_timeout(700)
            pg.locator(".ac-item").first.click()
            pg.wait_for_timeout(1500)
            txt = " ".join((pg.locator("#eres").text_content() or "").split())
            manquants = [a for a in attendus if a not in txt]
            ok(f"{url} : le détail par rang est affiché, pas un prix unique",
               not manquants, "manque " + str(manquants) if manquants else txt[:150])
            ok(f"{url} : zéro erreur JS", not errs, str(errs[:2]))
            ctx.close()

        # ... et un objet SANS rang ne doit PAS gagner cette phrase : un set n'a
        # pas de rang, l'afficher serait du bruit inventé.
        ctx = b.new_context(viewport={"width": 1280, "height": 900})
        bloquer_externe(ctx)
        pg = ctx.new_page()
        pg.goto(BASE + "/estimateur", wait_until="domcontentloaded")
        pg.wait_for_timeout(2000)
        pg.evaluate("""() => { API.marketStats = () => Promise.resolve(
            {payload:{statistics_closed:{"48hours":[{median:78,volume:40},{median:80,volume:35}],"90days":[]}}}); }""")
        pg.fill("#eq", "Mesa Prime Set")
        pg.wait_for_timeout(700)
        pg.locator(".ac-item").first.click()
        pg.wait_for_timeout(1500)
        txt = " ".join((pg.locator("#eres").text_content() or "").split())
        ok("estimateur : un objet sans rang n'affiche AUCUNE phrase de rang",
           "se négocie par rang" not in txt and "80 PL" in txt, txt[:140])
        ctx.close()

        # vignettes locales : marché (listes), courses (ajout), favoris (carte)
        ctx = b.new_context(viewport={"width": 1280, "height": 900})
        bloquer_externe(ctx)
        pg = ctx.new_page()
        wm = []
        pg.on("request", lambda r: wm.append(1) if "wm_thumbs" in r.url else None)
        pg.goto(BASE + "/marche", wait_until="domcontentloaded")
        pg.wait_for_timeout(2500)
        vig = pg.evaluate("""() => {
          const im=[...document.querySelectorAll('.mk-vig')];
          return {n:im.length, ok:im.filter(i=>i.naturalWidth>0).length, src:(im[0]||{}).src||''};
        }""")
        ok("marche : vignettes locales affichées", vig["n"] > 10 and vig["ok"] > 10 and "/assets/objets/" in vig["src"], json.dumps(vig)[:100])
        ok("marche : wm_thumbs jamais demandé (fichier supprimé)", not wm)
        ctx.close()

        ctx = b.new_context(viewport={"width": 1280, "height": 900})
        bloquer_externe(ctx)
        pg = ctx.new_page()
        pg.goto(BASE + "/courses", wait_until="domcontentloaded")
        pg.click("#caddq")
        pg.type("#caddq", "mesa prime set", delay=35)
        pg.wait_for_timeout(1100)
        pg.locator(".ac-item").first.click()
        pg.wait_for_timeout(700)
        vig = pg.evaluate("() => {const i=document.querySelector('.cr-vig'); return i?{ok:i.naturalWidth>0,src:i.src}:null;}")
        ok("courses : objet ajouté avec vignette webp locale", bool(vig) and vig["ok"] and "webp" in vig["src"])
        ctx.close()

        # ---- SYNCHRONISATION PAR CODE (03/09/2026) ------------------------
        # L'API a besoin d'une liaison D1 que seul le tableau de bord Cloudflare
        # peut créer. Ce qui se vérifie ici : la LISTE BLANCHE (le point le plus
        # important — « wmuser » ne doit jamais partir), le chiffrement local,
        # et le fait que l'absence d'API soit ANNONCÉE et non subie.
        # La logique pure a son propre garde-fou : node scripts/verifier_sync.mjs
        ctx = b.new_context(viewport={"width": 1280, "height": 900})
        bloquer_externe(ctx)
        pg = ctx.new_page()
        pg.goto(BASE + "/hub", wait_until="domcontentloaded")
        pg.wait_for_timeout(1500)
        ok("sync : le panneau est sur le tableau de bord", pg.locator("#syncPanel").count() == 1)
        pg.evaluate("() => { localStorage.setItem('tasks','{\"a\":1}');"
                    " localStorage.setItem('wmuser','{\"secret\":1}'); }")
        envoye = pg.evaluate("() => Object.keys(window.VRSync.litLocal())")
        ok("sync : « wmuser » ne part JAMAIS (liste blanche)",
           "wmuser" not in envoye and "tasks" in envoye, ", ".join(envoye))
        chiffre = pg.evaluate("async () => await window.VRSync.chiffre("
                              "window.VRSync.genereCode(), {tasks: 'SECRET_EN_CLAIR'})")
        ok("sync : le paquet envoyé ne contient pas le contenu en clair",
           "SECRET_EN_CLAIR" not in chiffre and "." in chiffre, chiffre[:30])
        pg.click("#syncNew")
        pg.wait_for_timeout(1500)
        code = pg.input_value("#syncCode")
        ok("sync : un code lisible est produit (4 groupes, sans I/L/O/0/1)",
           len(code) == 23 and not any(c in code for c in "ILO01"), code)
        etat_txt = pg.locator("#syncEtat").text_content() or ""
        ok("sync : l'absence d'API est ANNONCÉE, pas subie",
           "pas encore branchée" in etat_txt and "restent dans ce navigateur" in etat_txt,
           etat_txt[:130])
        ctx.close()
        b.close()
    if srv:
        srv.terminate()
    return bilan("pages outils")


if __name__ == "__main__":
    sys.exit(main())
