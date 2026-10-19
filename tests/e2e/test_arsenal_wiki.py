#!/usr/bin/env python3
# Ce que le JOUEUR voit des données wiki (05/09/2026).
#
# Le garde-fou scripts/verifier_arsenal_wiki.mjs lit les données du disque ; il
# ne dit rien de l'écran. Cette suite ouvre la page : elle prouve que le panneau
# « Passif » ne montre plus les marqueurs de gabarit ni les balises du jeu, et
# que les statistiques de rang 30 affichées sont celles du wiki — y compris pour
# les frames que la formule générale (+100/+100/×1,5) rate.
import sys

from playwright.sync_api import sync_playwright

from _outils import BASE, ok, lancer, bloquer_externe, demarrer_serveur, bilan


def equipe(pg, nom):
    """Choisit une Warframe par son nom — même geste que test_arsenal.py."""
    pg.click('[data-slot="frame"]')
    pg.fill("#ars-pk-q", nom)
    pg.wait_for_timeout(400)
    pg.click('.ars-pk-it[data-un]:not([data-un=""])')
    pg.wait_for_timeout(600)


def main():
    srv = demarrer_serveur()
    with sync_playwright() as p:
        b = lancer(p)
        ctx = b.new_context(viewport={"width": 1360, "height": 950})
        bloquer_externe(ctx)
        pg = ctx.new_page()
        errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)[:150]))
        pg.goto(BASE + "/arsenal", wait_until="networkidle", timeout=60000)
        pg.wait_for_selector(".ars-slot", timeout=30000)

        # 1) Aucun marqueur ni balise dans AUCUN passif : on interroge les
        #    données telles que la page les a chargées, pas le fichier du disque.
        reste = pg.evaluate("""()=>fetch('/data/arsenal/warframes.json').then(r=>r.json()).then(fr=>{
            const m=/\\|[A-Z_]{2,}\\|/, b=/<DT_|<[A-Z_]{3,}>/;
            return {marq: fr.filter(f=>m.test(f.passive||'')).map(f=>f.n),
                    bal:  fr.filter(f=>b.test(f.passive||'')).map(f=>f.n), n: fr.length};
        })""")
        ok("aucune balise du jeu ne survit dans les passifs",
           reste["bal"] == [], str(reste["bal"])[:90])
        # 4 = le résidu MESURÉ : Caliban et Caliban Prime (le wiki ne donne aucun
        # chiffre), Orion & Sirius et Sirius & Orion (trois valeurs au wiki pour
        # deux marqueurs en français). Le plafond suit le garde-fou : le laisser
        # à 6 autoriserait un retour en arrière sans que rien ne crie.
        ok("au plus 4 passifs à marqueur non résolu (résidu mesuré)",
           len(reste["marq"]) <= 4, f'{len(reste["marq"])} sur {reste["n"]} : {reste["marq"]}')

        # 2) Hildryn : +500 de bouclier au rang 30, pas +100. C'est l'exception
        #    que le découpage cassé perdait — elle affichait 1380.
        equipe(pg, "Hildryn")
        txt = pg.locator("#ars-stats").text_content() or ""
        ok("Hildryn : bouclier de rang 30 = 1780 (et plus 1380)",
           "1780" in txt and "1380" not in txt, txt.replace("\n", " ")[:120])

        # 3) Le passif affiché porte de vrais chiffres, pas |DAMAGE|.
        equipe(pg, "Ash")
        # il y a PLUSIEURS <details> sur la page (dont le diagnostic) : on vise
        # celui dont le résumé est « Passif », sinon on lit le mauvais panneau.
        bloc = pg.locator('.ars-det:has(summary:text-is("Passif"))').first
        bloc.locator("summary").click()
        pg.wait_for_timeout(300)
        passif = bloc.text_content() or ""
        ok("le passif d'Ash montre ses vrais chiffres (25 % / 50 %)",
           "25" in passif and "50" in passif, passif[:110])
        ok("le passif d'Ash ne montre ni marqueur ni balise",
           "|" not in passif and "DT_" not in passif, passif[:110])

        ok("zéro erreur JS", not errs, str(errs))
    return bilan("arsenal : stats et textes du wiki")


if __name__ == "__main__":
    sys.exit(main())
