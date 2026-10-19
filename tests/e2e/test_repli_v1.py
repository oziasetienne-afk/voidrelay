#!/usr/bin/env python3
# Repli v2 de marketStats : v1 vivante (non-régression) PUIS v1 morte (404 simulé).
import sys

from playwright.sync_api import sync_playwright

from _outils import BASE, ok, lancer, relais, demarrer_serveur, bilan


def scenario(b, tuer_v1, tag):
    ctx = b.new_context(viewport={"width": 1280, "height": 900})
    relais(ctx, tuer_v1=tuer_v1)
    pg = ctx.new_page()
    errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)[:140]))
    pg.goto(BASE + "/estimateur", wait_until="domcontentloaded")
    pg.wait_for_timeout(1200)
    pg.click("#eq")
    pg.type("#eq", "Mesa Prime Set", delay=25)
    pg.wait_for_timeout(900)
    try:
        pg.locator(".ac-item").first.click(timeout=3000)
    except Exception:
        pg.press("#eq", "Enter")
    pg.wait_for_timeout(7000)
    has_price = pg.evaluate("() => /\\d+\\s*PL/i.test(document.body.textContent)")
    ok(f"estimateur ({tag}) : prix affiché", has_price)
    ok(f"estimateur ({tag}) : zéro erreur JS", not errs, str(errs[:2]))
    ctx.close()

    ctx = b.new_context(viewport={"width": 1280, "height": 900})
    relais(ctx, tuer_v1=tuer_v1)
    pg = ctx.new_page()
    errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)[:140]))
    pg.goto(BASE + "/o/mesa_prime_set", wait_until="domcontentloaded")
    pg.wait_for_timeout(9000)
    has_price = pg.evaluate("() => /\\d+\\s*(PL|platine)/i.test(document.body.textContent)")
    ok(f"fiche objet ({tag}) : prix live affiché", has_price)
    ok(f"fiche objet ({tag}) : zéro erreur JS", not errs, str(errs[:2]))
    ctx.close()


def main():
    srv = demarrer_serveur()
    with sync_playwright() as p:
        b = lancer(p)
        print("== v1 VIVANTE (non-régression) ==")
        scenario(b, False, "v1 vivante")
        print("== v1 MORTE (404 simulé) ==")
        scenario(b, True, "v1 morte")
        b.close()
    if srv:
        srv.terminate()
    return bilan("repli v1->v2 (relais)")


if __name__ == "__main__":
    sys.exit(main())
