#!/usr/bin/env python3
# v96 — durée de combo en %, chance de combo supplémentaire, finisher, Melee Guidance.
# Contrôles ARITHMÉTIQUES (règles du wiki : Melee_Combo, Corrupt_Charge,
# True_Punishment, Finishing_Touch, Melee_Guidance) sur une Nikana Prime (base 5 s) :
#   Charge Corrompue (−50 % de la BASE)          : 5 × 0,5          = 2,5 s
#   + Décompte des Morts (+12 s)                  : 2,5 + 12         = 14,5 s
#   + Véritable Punition (−50 % de la base)       : 5 × 0 + 12       = 12 s
#   Véritable Punition (+100 % de combo) + Guiding Light (7,3 pts/s) : 220 / 14,6 = 15 s
#   Coup de Grâce (+60 %)                         : finishers à 160 %
#   (v100 : « Coup de Grâce Prime » +165 % était un mod fantôme, retiré)
#   Bobine Réflexe (+60 %) + Concentration d'Énergie (+40 %) = 100 % → plafond 90 % (wiki,
#   qui cite exactement ce duo) → 10 % de combo consommé
#   Assistance en Mêlée (aura, −6 s)              : 5 − 6 → plancher 0,1 s
import sys

from playwright.sync_api import sync_playwright

from _outils import BASE, ok, lancer, bloquer_externe, demarrer_serveur, bilan

CORRUPT = "/Lotus/Upgrades/Mods/Melee/DualStat/CorruptedHeavyDamageChargeSpeedMod"
TRUE_PUN = "/Lotus/Upgrades/Mods/Melee/Channel/ChannelCritsMod"
BODY_COUNT = "/Lotus/Upgrades/Mods/Melee/Event/ComboDurationMod"
FINISH = "/Lotus/Upgrades/Mods/Melee/WeaponMeleeFinisherDamageMod"
REFLEX = "/Lotus/Upgrades/Mods/Melee/WeaponMeleeChargeRateMod"
FOCUS_EN = "/Lotus/Upgrades/Mods/Melee/DualStat/FocusEnergyMod"
GUIDANCE = "/Lotus/Upgrades/Mods/Aura/WarframeAuraBladedRestraintMod"


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
    pg.fill("#ars-coll-q", "")
    pg.wait_for_timeout(200)
    pg.locator(f'#ars-coll [data-equipe="{un}"]').first.click()
    pg.wait_for_timeout(500)


def page(b):
    ctx = b.new_context(viewport={"width": 1360, "height": 950})
    bloquer_externe(ctx)
    pg = ctx.new_page()
    errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)[:150]))
    pg.goto(BASE + "/arsenal", wait_until="networkidle", timeout=60000)
    pg.wait_for_selector(".ars-slot", timeout=30000)
    return ctx, pg, errs


def main():
    srv = demarrer_serveur()
    with sync_playwright() as p:
        b = lancer(p)
        ctx, pg, errs = page(b)
        choisir(pg, "melee", "nikana prime", "Nikana Prime")
        ok("Nikana Prime : durée du combo de base 5 s", valeur(pg, "Durée du combo") == 5, str(valeur(pg, "Durée du combo")))
        poser(pg, CORRUPT)
        ok("Charge Corrompue : 5 × 0,5 = 2,5 s (le % porte sur la base)", valeur(pg, "Durée du combo") == 2.5,
           str(valeur(pg, "Durée du combo")))
        poser(pg, BODY_COUNT)
        ok("+ Décompte des Morts : 2,5 + 12 = 14,5 s", valeur(pg, "Durée du combo") == 14.5, str(valeur(pg, "Durée du combo")))
        poser(pg, TRUE_PUN)
        ok("+ Véritable Punition : 5 × (1 − 0,5 − 0,5) + 12 = 12 s", valeur(pg, "Durée du combo") == 12,
           str(valeur(pg, "Durée du combo")))
        ok("chance de combo supplémentaire affichée : 100 %", valeur(pg, "Chance de combo supplémentaire") == 100,
           str(valeur(pg, "Chance de combo supplémentaire")))
        # « justice » tombe sur Guiding Light (7,3 pts/s) : avec +100 %, 14,6 pts/s → 220 coups en 15 s (30 s sans)
        pg.click('.ars-vide[data-i="st"]')
        pg.wait_for_timeout(700)
        pg.fill("#ars-coll-q", "justice")
        pg.wait_for_timeout(500)
        pg.locator("#ars-coll [data-equipe]").first.click()
        pg.wait_for_timeout(800)
        montee = pg.locator(".ars-post-montee").text_content() or ""
        ok("montée du combo : 14,6 pts/s → ×12 en 15 s (dont +100 %)",
           "14.6 pts/s" in montee and "15 s" in montee and "+100 %" in montee, montee[:160])
        poser(pg, FINISH)
        ok("Coup de Grâce : finishers à 160 %", valeur(pg, "Dégâts de finisher") == 160,
           str(valeur(pg, "Dégâts de finisher")))
        poser(pg, REFLEX)
        poser(pg, FOCUS_EN)
        ok("Bobine Réflexe + Concentration d'Énergie : 100 % → plafond 90 % (wiki), 10 % consommé",
           valeur(pg, "Combo consommé") == 10, str(valeur(pg, "Combo consommé")))
        ok("zéro erreur JS", errs == [], str(errs))
        ctx.close()

        # Assistance en Mêlée : aura posée sur la frame, −6 s sur TA mêlée → plancher 0,1 s
        ctx, pg, errs = page(b)
        choisir(pg, "frame", "rhino", "Rhino")
        pg.click('.ars-vide[data-i="aura"]')
        pg.wait_for_timeout(600)
        pg.fill("#ars-coll-q", "")
        pg.wait_for_timeout(300)
        pg.locator(f'#ars-coll [data-equipe="{GUIDANCE}"]').first.click()
        pg.wait_for_timeout(600)
        choisir(pg, "melee", "nikana prime", "Nikana Prime")
        ok("Assistance en Mêlée : 5 − 6 s → plancher 0,1 s (wiki)", valeur(pg, "Durée du combo") == 0.1,
           str(valeur(pg, "Durée du combo")))
        ok("zéro erreur JS (aura)", errs == [], str(errs))
        b.close()
    if srv:
        srv.terminate()
    sys.exit(bilan("arsenal : combo, finisher, Melee Guidance"))


if __name__ == "__main__":
    main()
