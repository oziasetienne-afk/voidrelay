#!/usr/bin/env python3
# Pack « navigation instantanée & orientation » (16/07/2026) :
# actions ⌘K (thème, langue), index de pages EN, préchargement warp.js
# (Speculation Rules / prefetch), barre de lecture des guides, état actif vrnav.
import sys

from playwright.sync_api import sync_playwright

from _outils import BASE, ok, lancer, bloquer_externe, demarrer_serveur, bilan


def main():
    srv = demarrer_serveur()
    with sync_playwright() as p:
        b = lancer(p)
        ctx = b.new_context(viewport={"width": 1280, "height": 900})
        bloquer_externe(ctx)
        pg = ctx.new_page()
        errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)[:120]))

        # 1) Action thème dans la recherche ⌘K (accueil)
        pg.goto(BASE + "/", wait_until="domcontentloaded", timeout=30000)
        pg.keyboard.press("Control+k")
        pg.keyboard.type("theme")
        pg.wait_for_timeout(500)
        first = pg.locator(".vr-search-results:not([hidden]) .vr-search-opt").first.text_content() or ""
        ok("⌘K 'theme' : action en tête", "action" in first and "thème" in first.lower(), first.strip()[:60])
        avant = pg.evaluate("() => document.documentElement.getAttribute('data-theme')")
        pg.keyboard.press("Enter")
        apres = pg.evaluate("() => document.documentElement.getAttribute('data-theme')")
        ok("⌘K 'theme' Entrée : le thème bascule", avant != apres, f"{avant}→{apres}")

        # 2) Action langue : depuis /ducats, 'english' mène à l'équivalent EN (hreflang)
        pg.goto(BASE + "/ducats", wait_until="domcontentloaded", timeout=30000)
        pg.keyboard.press("Control+k")
        pg.keyboard.type("english")
        pg.wait_for_timeout(500)
        pg.keyboard.press("Enter")
        pg.wait_for_timeout(400)
        ok("⌘K 'english' : page EN équivalente", pg.url.endswith("/en/ducats"), pg.url)

        # 3) Index de pages EN : libellés anglais sur les pages anglaises
        pg.goto(BASE + "/en/tools", wait_until="domcontentloaded", timeout=30000)
        pg.keyboard.press("Control+k")
        pg.keyboard.type("ducats")
        pg.wait_for_timeout(500)
        labels = " | ".join(pg.locator(".vr-search-results:not([hidden]) .vr-search-opt").all_text_contents())
        ok("recherche EN : libellés anglais (en_pages_index)", "Ducats converter" in labels, labels[:80])

        # 4) warp.js : le survol d'un lien interne précharge la cible
        pg.goto(BASE + "/o/arcane_energize", wait_until="domcontentloaded", timeout=30000)
        pg.wait_for_timeout(200)
        pg.hover(".vrnav a[href='/builds/']")
        pg.wait_for_timeout(400)
        n = pg.evaluate(
            "() => document.querySelectorAll('script[type=speculationrules]').length"
            " + document.querySelectorAll('link[rel=prefetch]').length")
        ok("warp : préchargement après survol", n >= 1, f"{n} injection(s)")

        # 5) État actif vrnav + bouton thème sur les pages objets
        cur = pg.locator(".vrnav a.cur").text_content() or ""
        ok("vrnav : « vous êtes ici » = Objets", cur.strip() == "Objets", cur)
        ok("vrnav : bouton thème présent", pg.locator("#themebtn").is_visible())

        # 6) Barre de lecture sur un guide (scroll-driven, CSS pur)
        pg.goto(BASE + "/guides/farmer-ducats", wait_until="domcontentloaded", timeout=30000)
        info = pg.evaluate(
            "() => { const st = getComputedStyle(document.body, '::before');"
            " return CSS.supports('animation-timeline: scroll()') ? st.position + st.height : 'nosupport'; }")
        ok("guide : barre de lecture (fixed 3px)", info in ("fixed3px", "nosupport"), info)

        ok("zéro erreur JS sur le parcours", not errs, str(errs[:2]))
        ctx.close()
        b.close()
    if srv:
        srv.terminate()
    return bilan("pack warp & orientation")


if __name__ == "__main__":
    sys.exit(main())
