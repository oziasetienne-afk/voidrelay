#!/usr/bin/env python3
# Captures d'états de travail du simulateur (non destructif, hors suite).
import sys

from playwright.sync_api import sync_playwright

from _outils import BASE, lancer, demarrer_serveur

srv = demarrer_serveur()
with sync_playwright() as p:
    b = lancer(p)

    def ctx_page(larg):
        ctx = b.new_context(viewport={"width": larg, "height": 980})
        ctx.route("**/*", lambda r: r.continue_()
                  if ("localhost" in r.request.url or "cdn.warframestat.us" in r.request.url)
                  else r.abort())
        return ctx, ctx.new_page()

    # 1) CONFIG B (emplacements vides) + 2) collection ouverte
    ctx, pg = ctx_page(1440)
    pg.goto(BASE + "/arsenal?sim=saryn-prime&tier=exp", wait_until="domcontentloaded")
    pg.wait_for_selector(".ars-cfg", timeout=15000)
    pg.wait_for_timeout(2000)
    pg.click('[data-cfg="1"]')
    pg.wait_for_timeout(1200)
    pg.locator("#ars-mods").screenshot(path="/tmp/ars_vides.png")
    pg.click('.ars-vide[data-i="0"]')
    pg.wait_for_timeout(1500)
    pg.locator("#ars-coll").screenshot(path="/tmp/ars_coll.png")
    ctx.close()

    # 3) EN
    ctx, pg = ctx_page(1440)
    pg.goto(BASE + "/en/arsenal?sim=mesa-prime&tier=exp", wait_until="domcontentloaded")
    pg.wait_for_selector(".ars-cfg", timeout=15000)
    pg.wait_for_timeout(2200)
    pg.locator("#arsenal").screenshot(path="/tmp/ars_en.png")
    ctx.close()

    # 4) mobile 390
    ctx = b.new_context(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True)
    ctx.route("**/*", lambda r: r.continue_()
              if ("localhost" in r.request.url or "cdn.warframestat.us" in r.request.url)
              else r.abort())
    pg = ctx.new_page()
    pg.goto(BASE + "/arsenal?sim=saryn-prime&tier=exp", wait_until="domcontentloaded")
    pg.wait_for_selector(".ars-cfg", timeout=15000)
    pg.wait_for_timeout(2200)
    pg.locator("#ars-mods").screenshot(path="/tmp/ars_mobile.png")
    ctx.close()
    b.close()
print("captures : /tmp/ars_vides.png /tmp/ars_coll.png /tmp/ars_en.png /tmp/ars_mobile.png")
if srv:
    srv.terminate()
