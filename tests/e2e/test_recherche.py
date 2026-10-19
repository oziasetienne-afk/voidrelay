#!/usr/bin/env python3
# Suggestions prédictives (data-vr-suggest) + filtres locaux + recherche du header.
import json
import sys

from playwright.sync_api import sync_playwright

from _outils import BASE, ok, lancer, bloquer_externe, demarrer_serveur, bilan


def main():
    srv = demarrer_serveur()
    with sync_playwright() as p:
        b = lancer(p)

        # /builds/ : « ignis » -> suggestions + filtre local + navigation Entrée
        ctx = b.new_context(viewport={"width": 1280, "height": 900})
        bloquer_externe(ctx)
        pg = ctx.new_page()
        pg.goto(BASE + "/builds/", wait_until="domcontentloaded")
        pg.click("#bq")
        pg.type("#bq", "ignis", delay=40)
        pg.wait_for_timeout(700)
        vis = pg.evaluate("""() => {
          const i=document.getElementById('bq');
          const d=document.getElementById(i.getAttribute('aria-controls'));
          if (!d || d.hidden) return null;
          return [...d.querySelectorAll('a')].slice(0,5).map(a=>a.textContent.trim().toLowerCase());
        }""")
        ok("builds : suggestions « ignis »", bool(vis) and any("ignis" in t for t in vis), json.dumps(vis))
        shown = pg.evaluate("() => [...document.querySelectorAll('.bx')].filter(e => e.style.display !== 'none').length")
        ok("builds : filtre local toujours actif", 0 < shown <= 10, f"{shown} fiches")
        pg.press("#bq", "ArrowDown")
        pg.wait_for_timeout(120)
        pg.press("#bq", "Enter")
        pg.wait_for_timeout(800)
        ok("builds : Entrée navigue vers une fiche", "/builds/" in pg.url and not pg.url.rstrip("/").endswith("/builds"), pg.url)
        ctx.close()

        # /o/ : « adap » -> Adaptation
        ctx = b.new_context(viewport={"width": 1280, "height": 900})
        bloquer_externe(ctx)
        pg = ctx.new_page()
        pg.goto(BASE + "/o/", wait_until="domcontentloaded")
        pg.click("#oq")
        pg.type("#oq", "adap", delay=40)
        pg.wait_for_timeout(700)
        vis = pg.evaluate("""() => {
          const i=document.getElementById('oq');
          const d=document.getElementById(i.getAttribute('aria-controls'));
          if (!d || d.hidden) return null;
          const r=d.getBoundingClientRect(), ir=i.getBoundingClientRect();
          return {texts:[...d.querySelectorAll('a')].map(a=>a.textContent.toLowerCase()), gap:Math.round(r.top-ir.bottom)};
        }""")
        ok("o : suggère Adaptation", bool(vis) and any("adapt" in t for t in vis["texts"]))
        ok("o : menu ancré sous le champ (pas en bas de page)", bool(vis) and 0 <= vis["gap"] <= 40, str(vis and vis["gap"]))
        ctx.close()

        # /warframes/ : « vol » -> noms courts d'abord ; focus/1 caractère : pas de menu
        ctx = b.new_context(viewport={"width": 1280, "height": 900})
        bloquer_externe(ctx)
        pg = ctx.new_page()
        pg.goto(BASE + "/warframes/", wait_until="domcontentloaded")
        pg.click("#q")
        pg.wait_for_timeout(300)
        hidden = pg.evaluate("""() => {
          const i=document.getElementById('q');
          const d=document.getElementById(i.getAttribute('aria-controls'));
          return !d || d.hidden;
        }""")
        ok("warframes : focus seul n'ouvre pas de menu", hidden)
        pg.type("#q", "vol", delay=40)
        pg.wait_for_timeout(700)
        vis = pg.evaluate("""() => {
          const i=document.getElementById('q');
          const d=document.getElementById(i.getAttribute('aria-controls'));
          if (!d || d.hidden) return null;
          return [...d.querySelectorAll('a')].slice(0,5).map(a=>a.textContent.trim().toLowerCase());
        }""")
        ok("warframes : « vol » propose un Volt", bool(vis) and any("volt" in t for t in vis), json.dumps(vis))

        # recherche du header (non-régression)
        hdr = pg.locator(".vr-search-input").first
        hdr.click()
        hdr.type("mesa", delay=40)
        pg.wait_for_timeout(700)
        n = pg.evaluate("""() => {
          const d=document.querySelector('.vr-search-results:not([hidden])');
          return d ? d.querySelectorAll('a').length : 0;
        }""")
        ok("header : la recherche globale répond", n > 0, f"{n} résultats")

        # Les PAGES du site, pas seulement les objets : data/pages_index.json est un
        # artefact généré, et il avait silencieusement pris du retard sur son
        # générateur — /marche-profils y était déclaré depuis des heures sans jamais
        # avoir été écrit sur le disque. Une page qu'aucune recherche ne trouve
        # n'existe pas pour le visiteur, quel que soit son contenu.
        for terme, attendu in [("profils", "/marche-profils"), ("modder", "/guides/bien-modder")]:
            hdr.fill("")
            hdr.type(terme, delay=40)
            pg.wait_for_timeout(700)
            liens = pg.evaluate("""() => {
              const d=document.querySelector('.vr-search-results:not([hidden])');
              return d ? [...d.querySelectorAll('a')].map(a=>a.getAttribute('href')) : [];
            }""")
            ok(f"header : « {terme} » trouve la page {attendu}",
               attendu in liens, ", ".join(liens[:6]) or "aucun résultat")
        ctx.close()
        b.close()
    if srv:
        srv.terminate()
    return bilan("recherche & suggestions")


if __name__ == "__main__":
    sys.exit(main())
