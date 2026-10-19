#!/usr/bin/env python3
# Capture d'écran de travail du simulateur (non destructif, hors suite) :
# python3 capture_arsenal.py [url_suffixe] [sortie.png] [largeur] [clip_top] [clip_h]
import sys

from playwright.sync_api import sync_playwright

from _outils import BASE, lancer, bloquer_externe, demarrer_serveur

suffixe = sys.argv[1] if len(sys.argv) > 1 else "/arsenal?sim=saryn-prime&tier=exp"
sortie = sys.argv[2] if len(sys.argv) > 2 else "/tmp/arsenal.png"
larg = int(sys.argv[3]) if len(sys.argv) > 3 else 1440
relais_cdn = "--cdn" in sys.argv

srv = demarrer_serveur()
with sync_playwright() as p:
    b = lancer(p)
    ctx = b.new_context(viewport={"width": larg, "height": 940})
    if relais_cdn:
        # laisse passer le CDN d'images (vraies vignettes) — le reste est bloqué
        ctx.route("**/*", lambda r: r.continue_()
                  if ("localhost" in r.request.url or "cdn.warframestat.us" in r.request.url)
                  else r.abort())
    else:
        bloquer_externe(ctx)
    pg = ctx.new_page()
    pg.goto(BASE + suffixe, wait_until="domcontentloaded", timeout=30000)
    pg.wait_for_selector(".ars-slot", timeout=15000)
    pg.wait_for_timeout(2500)
    el = pg.locator("#arsenal")
    el.screenshot(path=sortie)
    print("capture :", sortie)
    ctx.close()
    b.close()
if srv:
    srv.terminate()
