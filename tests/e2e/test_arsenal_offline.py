#!/usr/bin/env python3
# Arsenal HORS-LIGNE (17/07/2026) : après UNE visite de /arsenal, le service
# worker pré-cache pages FR+EN, moteur et données cuites — le simulateur doit
# fonctionner entièrement sans réseau, y compris la jumelle EN jamais visitée.
# (Réf. sw.js : precacheArsenal à la navigation ET à l'activation — la 1re
# visite n'est pas contrôlée par le SW.)
import sys

from playwright.sync_api import sync_playwright

from _outils import BASE, ok, lancer, bloquer_externe, demarrer_serveur, bilan


def main():
    srv = demarrer_serveur()
    with sync_playwright() as p:
        b = lancer(p)
        ctx = b.new_context(viewport={"width": 1360, "height": 900})
        bloquer_externe(ctx)  # pub/CDN coupés : le hors-ligne doit tenir sans eux
        pg = ctx.new_page()
        errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)[:120]))

        # 1) première visite EN LIGNE : le SW s'installe et pré-cache l'arsenal
        pg.goto(BASE + "/arsenal", wait_until="load", timeout=30000)
        pg.wait_for_selector(".ars-slot", timeout=15000)
        pg.wait_for_timeout(5000)
        n = pg.evaluate("""async () => {
          const noms = await caches.keys();
          const nom = noms.find(x => x.startsWith('wf-hub'));
          if (!nom) return 0;
          const c = await caches.open(nom);
          return (await c.keys()).filter(k => k.url.includes('arsenal')).length;
        }""")
        ok("pré-cache arsenal après la 1re visite (≥ 9 entrées)", n >= 9, str(n))

        # 2) HORS-LIGNE : recharge complète + équipement + maths exactes
        ctx.set_offline(True)
        pg.goto(BASE + "/arsenal", wait_until="domcontentloaded", timeout=30000)
        pg.wait_for_selector(".ars-slot", timeout=15000)
        pg.wait_for_timeout(1200)
        meta = pg.locator("#ars-meta").text_content() or ""
        ok("hors-ligne : données chargées (méta affichée)", "Warframes" in meta, meta[:60])
        pg.click('[data-slot="frame"]')
        pg.fill("#ars-pk-q", "chroma prime")
        pg.wait_for_timeout(300)
        pg.click('.ars-pk-it[data-un]:not([data-un=""])')
        pg.wait_for_timeout(500)
        stats = pg.locator("#ars-stats").text_content() or ""
        ok("hors-ligne : Chroma Prime équipée, stats exactes (370/450/300)",
           all(v in stats for v in ("370", "450", "300")), stats[:80])

        # 3) jumelle EN jamais visitée : doit sortir du pré-cache
        pg.goto(BASE + "/en/arsenal", wait_until="domcontentloaded", timeout=30000)
        pg.wait_for_timeout(1000)
        ok("hors-ligne : /en/arsenal jamais visitée se charge (pré-cachée)",
           pg.locator(".ars-slot").count() > 0)
        ok("zéro erreur JS", not errs, str(errs[:2]))
        ctx.close()
        b.close()
    if srv:
        srv.terminate()
    return bilan("arsenal hors-ligne")


if __name__ == "__main__":
    sys.exit(main())
