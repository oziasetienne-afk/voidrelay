#!/usr/bin/env python3
# v94 — précision, munitions par ramassage, Incarnon et famille d'armes.
#
# Chaque contrôle est ARITHMÉTIQUE : on recalcule ici, avec les règles du wiki,
# la valeur que la page doit afficher. « Le chiffre a bougé » passerait au vert
# avec une formule fausse.
#   Précision = 100 / [ (min + max) / 2 × (1 + % de dispersion) + dispersion plate ]
#   Soma Prime (2°–5°) = 28,6 ; + Heavy Caliber rang 10 (+2,97° plats) = 15,5
#   Boar Prime (10°–30°) = 5 ; + Tainted Shell (+77 % = −77 % de dispersion) = 21,7
#   Ramassage Soma Prime 80 ; + Rifle Scavenger (+150 %) = 200
#   Mutation Prime (92 %) sur un Lex (40 par ramassage) = 37
#   Jauge Incarnon Soma Prime : 200 charges ÷ 10 par coup = 20 coups au point faible
import re
import sys

from playwright.sync_api import sync_playwright

from _outils import BASE, ok, lancer, bloquer_externe, demarrer_serveur, bilan

HEAVY_CALIBER = "/Lotus/Upgrades/Mods/Rifle/DualStat/CorruptedDamageRecoilRifle"
TAINTED_SHELL = "/Lotus/Upgrades/Mods/Shotgun/DualStat/CorruptedAccuracyFireRateShotgun"
RIFLE_SCAV = "/Lotus/Upgrades/Mods/Aura/PlayerRifleAmmoAuraMod"
MUTATION_PISTOLET = "/Lotus/Upgrades/Mods/Pistol/Expert/WeaponPistolConvertAmmoModExpert"


def valeur(pg, etiquette):
    """Valeur MODDÉE affichée en face d'une étiquette du tableau des performances."""
    return pg.evaluate("""(et) => {
      const tr = [...document.querySelectorAll('#ars-stats tr')].find(r => (r.cells[0]||{}).textContent === et);
      if (!tr) return null;
      const t = tr.cells[1].childNodes[0].textContent.replace(/\\s/g, '').replace(',', '.');
      return parseFloat(t);
    }""", etiquette)


def choisir(pg, slot, recherche, nom_exact=None):
    pg.click(f'[data-slot="{slot}"]')
    pg.wait_for_timeout(500)
    if not pg.locator("#ars-pk-q").is_visible():   # emplacement déjà équipé : 1er clic = sélection
        pg.click(f'[data-slot="{slot}"]')
        pg.wait_for_timeout(500)
    pg.fill("#ars-pk-q", recherche)
    pg.wait_for_timeout(350)
    if nom_exact:
        pg.locator(".ars-pk-it[data-un]", has_text=nom_exact).first.click()
    else:
        pg.click('.ars-pk-it[data-un]:not([data-un=""])')
    pg.wait_for_timeout(500)


def poser(pg, un):
    pg.fill("#ars-coll-q", "")
    pg.wait_for_timeout(150)
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

        # Soma Prime nue : bases du wiki
        choisir(pg, "primaire", "soma prime", "Soma Prime")
        ok("précision de base Soma Prime = 100 / 3,5 = 28,6", valeur(pg, "Précision") == 28.6, str(valeur(pg, "Précision")))
        ok("munitions par ramassage = 80", valeur(pg, "Munitions par ramassage") == 80, str(valeur(pg, "Munitions par ramassage")))
        txt = pg.locator("#ars-stats").text_content() or ""
        ok("jauge Incarnon : 200 ÷ 10 = 20 coups au point faible", "20 coups au point faible" in txt,
           (re.search(r"jauge pleine en[^.]*", txt) or [""])[0])
        ok("la famille propose la Soma (non-Prime)", pg.locator('[data-fam-un]', has_text="Soma").count() >= 1)

        # Heavy Caliber : dispersion PLATE, pas le « −55 % » affiché
        poser(pg, HEAVY_CALIBER)
        ok("Heavy Caliber rang 10 : 100 / (3,5 + 2,97) = 15,5", valeur(pg, "Précision") == 15.5, str(valeur(pg, "Précision")))

        # Famille : on passe à la Soma en GARDANT le build
        pg.locator('[data-fam-un]', has_text="Soma").first.click()
        pg.wait_for_timeout(500)
        ok("passé sur la Soma", "Soma" in (pg.locator("#ars-stats h2, #ars-stats h3").first.text_content() or "") or
           "Soma" in (pg.locator('[data-slot="primaire"]').text_content() or ""))
        ok("le Heavy Caliber est toujours équipé après le changement de variante",
           pg.evaluate("() => JSON.stringify(JSON.parse(localStorage.getItem('vr-arsenal-v1')||'{}').equip.primaire||{})").find("CorruptedDamageRecoilRifle") >= 0)

        # Rifle Scavenger (aura sur la frame) : +150 % par ramassage, pour toute principale
        choisir(pg, "frame", "rhino")
        pg.click('.ars-vide[data-i="aura"]')          # l'aura se pose depuis SA case
        pg.wait_for_timeout(600)
        pg.fill("#ars-coll-q", "fusil")
        pg.wait_for_timeout(500)
        pg.click(f'#ars-coll [data-equipe="{RIFLE_SCAV}"]')
        pg.wait_for_timeout(600)
        choisir(pg, "primaire", "soma prime", "Soma Prime")
        ok("Rifle Scavenger : 80 × 2,5 = 200 par ramassage", valeur(pg, "Munitions par ramassage") == 200,
           str(valeur(pg, "Munitions par ramassage")))

        # Tainted Shell sur un fusil à pompe : −77 % de dispersion
        choisir(pg, "primaire", "boar prime", "Boar Prime")
        base = valeur(pg, "Précision")
        poser(pg, TAINTED_SHELL)
        ok("Boar Prime : 100 / 20 = 5, puis Tainted Shell 100 / (20 × 0,23) = 21,7",
           base == 5 and valeur(pg, "Précision") == 21.7, f"{base} → {valeur(pg, 'Précision')}")

        # Mutation sur un pistolet : 92 % du ramassage (40) = 37
        choisir(pg, "secondaire", "lex", "Lex")
        poser(pg, MUTATION_PISTOLET)
        txt = pg.locator("#ars-stats").text_content() or ""
        ok("mutation Prime : 40 × 0,92 = 37 munitions converties", "te rend 37 munitions" in txt,
           (re.search(r"Mutation[^.]*", txt) or [""])[0][:120])

        ok("zéro erreur JS", errs == [], str(errs))
        b.close()
    if srv:
        srv.terminate()
    sys.exit(bilan("arsenal : précision, ramassage, Incarnon, famille"))


if __name__ == "__main__":
    main()
