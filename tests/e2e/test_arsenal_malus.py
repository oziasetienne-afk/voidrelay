#!/usr/bin/env python3
# v95 — les MALUS des mods corrompus. Avant : Blind Rage comptait +99 % de
# puissance sans son −55 % d'efficacité (idem Narrow Minded, Critical Delay…).
# Contrôles arithmétiques, avec les valeurs du jeu :
#   Blind Rage rang 10    : puissance 100 → 199 %, efficacité 100 → 45 %
#   Narrow Minded rang 10 : durée 100 → 199 %, portée 100 → 34 %
#   Critical Delay rang 5 sur une Soma Prime : cadence 15 × (1 − 0,2) = 12
import re
import sys

from playwright.sync_api import sync_playwright

from _outils import BASE, ok, lancer, bloquer_externe, demarrer_serveur, bilan

BLIND_RAGE = "/Lotus/Upgrades/Mods/Warframe/DualStat/CorruptedPowerEfficiencyWarframe"
NARROW = "/Lotus/Upgrades/Mods/Warframe/DualStat/CorruptedDurationRangeWarframe"
CRIT_DELAY = "/Lotus/Upgrades/Mods/Rifle/DualStat/CorruptedCritRateFireRateRifle"


def valeur(pg, etiquette):
    return pg.evaluate("""(et) => {
      const tr = [...document.querySelectorAll('#ars-stats tr')].find(r => (r.cells[0]||{}).textContent === et);
      if (!tr) return null;
      return parseFloat(tr.cells[1].childNodes[0].textContent.replace(/\\s/g, '').replace(',', '.'));
    }""", etiquette)


def choisir(pg, slot, recherche, nom_exact):
    pg.click(f'[data-slot="{slot}"]')
    pg.wait_for_timeout(500)
    if not pg.locator("#ars-pk-q").is_visible():
        pg.click(f'[data-slot="{slot}"]')
        pg.wait_for_timeout(500)
    pg.fill("#ars-pk-q", recherche)
    pg.wait_for_timeout(350)
    pg.locator(".ars-pk-it[data-un]", has_text=nom_exact).first.click()
    pg.wait_for_timeout(500)


def poser(pg, un):
    pg.locator(f'#ars-coll [data-equipe="{un}"]').first.click()
    pg.wait_for_timeout(500)


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

        choisir(pg, "frame", "rhino", "Rhino")
        poser(pg, BLIND_RAGE)
        ok("Colère Aveugle : puissance 199 %", valeur(pg, "Puissance") == 199, str(valeur(pg, "Puissance")))
        ok("Colère Aveugle : efficacité 45 % (son malus, ignoré avant v95)", valeur(pg, "Efficacité") == 45,
           str(valeur(pg, "Efficacité")))
        poser(pg, NARROW)
        ok("Étroit d'Esprit : durée 199 %", valeur(pg, "Durée") == 199, str(valeur(pg, "Durée")))
        ok("Étroit d'Esprit : portée 34 % (son malus)", valeur(pg, "Portée") == 34, str(valeur(pg, "Portée")))

        choisir(pg, "primaire", "soma prime", "Soma Prime")
        poser(pg, CRIT_DELAY)
        ok("Délai Critique : cadence 15 × 0,8 = 12", valeur(pg, "Cadence") == 12, str(valeur(pg, "Cadence")))

        ok("zéro erreur JS", errs == [], str(errs))
        b.close()
    if srv:
        srv.terminate()
    sys.exit(bilan("arsenal : malus des mods corrompus"))


if __name__ == "__main__":
    main()
