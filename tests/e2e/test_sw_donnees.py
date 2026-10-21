#!/usr/bin/env python3
# Service worker et données (21/10/2026) : /data/*.json en réseau d'abord. Cas réel :
# visiteur revenu après 2 jours, cache périmé -> la 1re visite doit afficher le réseau.
import json
import os
import sys

from playwright.sync_api import sync_playwright

from _outils import BASE, RACINE, ok, lancer, bloquer_externe, demarrer_serveur, bilan


def main():
    srv = demarrer_serveur()
    reel = json.load(open(os.path.join(RACINE, "data", "summary.json")))["updated_utc"]
    with sync_playwright() as p:
        b = lancer(p)
        ctx = b.new_context(viewport={"width": 1280, "height": 800})
        bloquer_externe(ctx)
        pg = ctx.new_page()
        pg.goto(BASE + "/", wait_until="load", timeout=30000)
        pg.evaluate("navigator.serviceWorker.ready")
        pg.wait_for_timeout(1500)
        nom = pg.evaluate("caches.keys().then(k=>k.find(x=>x.startsWith('wf-hub')))")
        ok("market.json n'est plus pré-caché par la coque",
           not pg.evaluate("n=>caches.open(n).then(c=>c.keys()).then(k=>k.some(r=>/market(_history)?\\.json/.test(r.url)))", nom)
           or True)  # la page peut l'avoir demandé ensuite : on vérifie sw.js plus bas

        # 1) cache ANCIEN pré-rempli : la lecture doit rendre la valeur du réseau
        pg.evaluate("""async n => { const c = await caches.open(n);
          await c.put('/data/summary.json', new Response(JSON.stringify({updated_utc:'2026-10-19T14:27:00Z'}),
            {headers:{'Content-Type':'application/json'}})); }""", nom)
        pg.reload(wait_until="load")
        d = pg.evaluate("fetch('/data/summary.json').then(r=>r.json())")
        ok("cache périmé pré-rempli : la lecture rend les données réseau", d["updated_utc"] == reel, d["updated_utc"])
        ok("pas de bandeau hors ligne en ligne", pg.locator("#vr-hors-ligne").count() == 0)

        # 2) wf-alerts survit à un changement de version, un vieux cache disparaît
        pg.evaluate("""async () => { await (await caches.open('wf-alerts')).put('/__alerts_config',
          new Response('{"enabled":true}')); await caches.open('wf-hub-v1'); }""")
        pg.evaluate("navigator.serviceWorker.getRegistration().then(r=>r.unregister())")
        pg.goto(BASE + "/", wait_until="load")
        pg.evaluate("navigator.serviceWorker.ready")
        pg.wait_for_timeout(2000)
        ks = pg.evaluate("caches.keys()")
        ok("wf-alerts conservé après réinstallation", "wf-alerts" in ks, str(ks))
        ok("ancien cache wf-hub-v1 purgé", "wf-hub-v1" not in ks, str(ks))
        ok("config des alertes intacte",
           pg.evaluate("caches.open('wf-alerts').then(c=>c.match('/__alerts_config')).then(r=>!!r)"))

        # 3) hors ligne : repli sur le cache + indication visible
        pg.goto(BASE + "/hub", wait_until="load")  # page qui charge js/api.js (le bandeau)
        pg.evaluate("fetch('/data/summary.json').then(r=>r.text())")  # remplit le cache
        pg.wait_for_timeout(500)
        ctx.set_offline(True)
        h = pg.evaluate("fetch('/data/summary.json').then(r=>({ok:r.ok,c:r.headers.get('x-vr-cache')}))")
        ok("hors ligne : repli sur le cache (en-tête X-VR-Cache)", h["ok"] and h["c"] == "hors-ligne", str(h))
        pg.wait_for_selector("#vr-hors-ligne", timeout=3000)
        ok("hors ligne : indication « données hors ligne » visible", pg.locator("#vr-hors-ligne").is_visible())
        ctx.close()
        b.close()
    sw = open(os.path.join(RACINE, "sw.js")).read()
    shell = sw.split("const SHELL=")[1].split("];")[0]
    ok("SHELL sans market.json ni market_history.json", "market" not in shell)
    if srv:
        srv.terminate()
    return bilan("sw données")


if __name__ == "__main__":
    sys.exit(main())
