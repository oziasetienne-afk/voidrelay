#!/usr/bin/env python3
# Système de langue (17/07/2026) : bouton EN/FR injecté par warp.js sur toutes les
# pages + redirection automatique À L'ENTRÉE selon la préférence (vr-lang) ou la
# langue du navigateur. Les gardes anti-robot (webdriver/headless) sont neutralisées
# ici pour tester le comportement « humain ».
import sys

from playwright.sync_api import sync_playwright

from _outils import BASE, ok, lancer, bloquer_externe, demarrer_serveur, bilan

UA_HUMAIN = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
             "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36")
CACHE_WEBDRIVER = "Object.defineProperty(navigator,'webdriver',{get:()=>false});"


def contexte(b, locale, init=None):
    ctx = b.new_context(user_agent=UA_HUMAIN, locale=locale)
    bloquer_externe(ctx)
    ctx.add_init_script(CACHE_WEBDRIVER + (init or ""))
    return ctx


def main():
    srv = demarrer_serveur()
    with sync_playwright() as p:
        b = lancer(p)

        # 1) Navigateur anglophone, première visite sur l'accueil FR → bascule /en/
        ctx = contexte(b, "en-US")
        pg = ctx.new_page()
        pg.goto(BASE + "/", wait_until="domcontentloaded", timeout=30000)
        pg.wait_for_timeout(900)
        ok("navigateur EN : l'accueil FR redirige vers /en/", pg.url.rstrip("/").endswith("/en"), pg.url)
        pref = pg.evaluate("() => localStorage.getItem('vr-lang')")
        ok("préférence mémorisée : en", pref == "en", str(pref))
        ctx.close()

        # 2) Navigateur français : aucune redirection, bouton EN injecté dans l'en-tête
        ctx = contexte(b, "fr-FR")
        pg = ctx.new_page()
        pg.goto(BASE + "/", wait_until="domcontentloaded", timeout=30000)
        pg.wait_for_timeout(900)
        ok("navigateur FR : l'accueil FR reste en FR", "/en" not in pg.url, pg.url)
        btn = pg.locator(".langbtn")
        ok("bouton de langue injecté (EN, vers /en/)",
           btn.count() == 1 and (btn.get_attribute("href") or "").endswith("/en/")
           and (btn.text_content() or "").strip() == "EN")
        # clic = choix explicite → préférence en, arrivée sur /en/
        btn.click()
        pg.wait_for_timeout(900)
        ok("clic bouton : arrivée sur /en/ et préférence en",
           pg.url.rstrip("/").endswith("/en")
           and pg.evaluate("() => localStorage.getItem('vr-lang')") == "en", pg.url)
        # sur la page EN, le bouton propose FR
        ok("côté EN : bouton FR proposé",
           (pg.locator(".langbtn").text_content() or "").strip() == "FR")
        ctx.close()

        # 3) Préférence FR mémorisée : une page EN à jumelle FR (entrée directe) rebascule
        ctx = contexte(b, "en-US", "try{localStorage.setItem('vr-lang','fr')}catch(e){}")
        pg = ctx.new_page()
        pg.goto(BASE + "/en/guides/incarnon-rotation", wait_until="domcontentloaded", timeout=30000)
        pg.wait_for_timeout(900)
        ok("préférence fr : /en/guides/incarnon-rotation → /guides/rotation-incarnon",
           pg.url.endswith("/guides/rotation-incarnon"), pg.url)
        ctx.close()

        # 4) Page SANS jumelle : jamais de renvoi arbitraire (on reste sur place)
        ctx = contexte(b, "en-US")
        pg = ctx.new_page()
        pg.goto(BASE + "/guides/chasse-eidolons", wait_until="domcontentloaded", timeout=30000)
        pg.wait_for_timeout(900)
        ok("page FR sans hreflang de jumelle directe : pas de redirection sauvage",
           "chasse-eidolons" in pg.url or "eidolon-hunting" in pg.url, pg.url)
        ctx.close()

        # 5) Accueils : les 3 piliers mis en avant (Voie/outils platine, marché, arsenal).
        #    Chaque accueil est visité avec la locale correspondante (sinon la
        #    redirection d'entrée — voulue — renverrait vers l'autre langue).
        ctx = contexte(b, "fr-FR")
        pg = ctx.new_page()
        pg.goto(BASE + "/", wait_until="domcontentloaded", timeout=30000)
        t = pg.locator("#piliers").text_content() or ""
        ok("accueil FR : piliers Voie du Platine + marché + simulateur",
           all(x in t for x in ("Voie du Platine", "Marché", "Simulateur d'Arsenal")), t[:120])
        ctx.close()
        ctx = contexte(b, "en-US")
        pg = ctx.new_page()
        pg.goto(BASE + "/en/", wait_until="domcontentloaded", timeout=30000)
        t = pg.locator("#pillars").text_content() or ""
        # 17/07/2026 : le pilier nº1 EN devient « The Platinum Path » (parité avec
        # le pilier FR « La Voie du Platine », page /en/platinum-path/ créée).
        ok("accueil EN : piliers Platinum Path + marché + simulateur",
           all(x in t for x in ("Platinum Path", "market", "Arsenal simulator")), t[:120])
        ctx.close()
        b.close()
    if srv:
        srv.terminate()
    return bilan("système de langue")


if __name__ == "__main__":
    sys.exit(main())
