#!/usr/bin/env python3
# Core Web Vitals : LCP < 2 500 ms et CLS < 0,1 en mobile émulé (4G lent, CPU x4).
import sys

from playwright.sync_api import sync_playwright

from _outils import BASE, ok, lancer, bloquer_externe, demarrer_serveur, bilan

PAGES = ["/", "/hub", "/builds/", "/builds/mesa", "/o/", "/o/mesa_prime_set",
         "/guides/", "/guides/farmer-platine-gratuit", "/marche", "/marche-complet",
         "/outils", "/voie-du-platine/", "/warframes/", "/faq",
         "/arsenal", "/en/arsenal"]

OBSERVER = """
window.__cwv = {lcp: 0, cls: 0};
new PerformanceObserver(l => { for (const e of l.getEntries()) window.__cwv.lcp = e.startTime; })
  .observe({type: 'largest-contentful-paint', buffered: true});
new PerformanceObserver(l => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cwv.cls += e.value; })
  .observe({type: 'layout-shift', buffered: true});
"""


def main():
    srv = demarrer_serveur()
    with sync_playwright() as p:
        b = lancer(p)
        for u in PAGES:
            ctx = b.new_context(viewport={"width": 390, "height": 844}, is_mobile=True)
            bloquer_externe(ctx)
            pg = ctx.new_page()
            cdp = ctx.new_cdp_session(pg)
            cdp.send("Network.enable")
            cdp.send("Network.emulateNetworkConditions", {
                "offline": False, "latency": 120,
                "downloadThroughput": int(1.6 * 1024 * 1024 / 8), "uploadThroughput": int(750 * 1024 / 8)})
            cdp.send("Emulation.setCPUThrottlingRate", {"rate": 4})
            pg.add_init_script(OBSERVER)
            pg.goto(BASE + u, wait_until="load", timeout=60000)
            pg.wait_for_timeout(4000)
            r = pg.evaluate("window.__cwv")
            ok(f"{u} : LCP < 2500 ms", r["lcp"] < 2500, f"{r['lcp']:.0f} ms")
            ok(f"{u} : CLS < 0,1", r["cls"] < 0.1, f"{r['cls']:.3f}")
            ctx.close()
        b.close()
    if srv:
        srv.terminate()
    return bilan("Core Web Vitals")


if __name__ == "__main__":
    sys.exit(main())
