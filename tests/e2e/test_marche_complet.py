#!/usr/bin/env python3
# /marche-complet : catalogue intégral, prix live (VRAIE API via relais), flux temps réel.
import re
import sys

from playwright.sync_api import sync_playwright

from _outils import BASE, ok, lancer, relais, demarrer_serveur, bilan


def main():
    srv = demarrer_serveur()
    with sync_playwright() as p:
        b = lancer(p)

        ctx = b.new_context(viewport={"width": 1280, "height": 900})
        relais(ctx)
        pg = ctx.new_page()
        errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)[:140]))
        pg.goto(BASE + "/marche-complet", wait_until="domcontentloaded")
        pg.wait_for_timeout(2500)

        # Le compteur formate en fr-FR (espace fine insécable U+202F) : on normalise en chiffres.
        count = pg.evaluate("() => document.getElementById('mcCount').textContent")
        n_cat = int(re.sub(r"\D", "", count.split("objet")[0]) or "0")
        ok("catalogue chargé (3 800+ objets)", n_cat >= 3800, f"{n_cat} — {count[:40]}")
        pills = pg.evaluate("() => [...document.querySelectorAll('.mc-pill')].map(x=>x.textContent)")
        for fam in ("Sets", "Systèmes", "Châssis", "Casques", "Schémas", "Armes", "Mods"):
            ok(f"famille {fam} présente", any(fam in x for x in pills))
        # Prix chargés au défilement via proxy, throttle 450 ms, 2 ouvriers : sous relais
        # (latence ajoutée) c'est plus lent qu'en réel. On laisse le temps et on prouve que
        # le mécanisme fonctionne (au moins quelques prix arrivent), sans exiger les 12.
        pg.wait_for_timeout(15000)
        prices = pg.evaluate("""() => [...document.querySelectorAll('.mc-row')].slice(0,12)
            .map(r => r.querySelector('.mc-price').textContent.trim())
            .filter(t => /PL/.test(t) || /aucune offre/.test(t)).length""")
        ok("prix LIVE chargés au défilement", prices >= 3, f"{prices}/12")
        feed = pg.evaluate("() => document.querySelectorAll('#mcFeed li').length")
        ok("flux temps réel rempli", feed >= 10, f"{feed} offres")
        link = pg.evaluate("() => {const a=document.querySelector('#mcFeed li .nm a'); return a?a.getAttribute('href'):null;}")
        ok("flux lié aux fiches /o/", bool(link) and link.startswith("/o/"), str(link))
        pg.fill("#mq", "mesa prime")
        pg.wait_for_timeout(500)
        n1 = pg.evaluate("() => document.querySelectorAll('.mc-row').length")
        ok("filtre texte", 0 < n1 <= 20, f"{n1} lignes")
        ok("zéro erreur JS", not errs, str(errs[:2]))
        ctx.close()

        # mobile : pas de rognage
        ctx = b.new_context(viewport={"width": 390, "height": 844}, is_mobile=True)
        relais(ctx)
        pg = ctx.new_page()
        pg.goto(BASE + "/marche-complet", wait_until="domcontentloaded")
        pg.wait_for_timeout(3000)
        sw = pg.evaluate("document.documentElement.scrollWidth")
        ok("mobile : pas de défilement horizontal", sw == 390, f"scrollWidth={sw}")
        ctx.close()
        b.close()
    if srv:
        srv.terminate()
    return bilan("marché complet (relais)")


if __name__ == "__main__":
    sys.exit(main())
