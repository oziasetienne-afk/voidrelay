#!/usr/bin/env python3
# v97 — griffes des bêtes et Récupération du Chasseur.
# Contrôles ARITHMÉTIQUES (wiki : Beast_Claws, Module:Weapons/data/companion,
# Hunter_Recovery, Maul) sur une Smeeta Kavat :
#   Griffes de Smeeta : 80 Tranchant, crit 20 % × 2, 1 attaque/s
#     coup moyen = 80 × (1 + 0,2 × (2 − 1)) = 96 → 96 DPS
#   Récupération du Chasseur (rang max, 30 %) : 0,3 × 96 = 28,8 → 29 PV/s
#   + Mâchoire (+330 % de dégâts) : 96 × 4,3 = 412,8 DPS → 0,3 × 412,8 = 124 PV/s
#   Une bête ne peut porter QUE ses griffes ; un robot n'en porte jamais.
import sys

from playwright.sync_api import sync_playwright

from _outils import BASE, ok, lancer, bloquer_externe, demarrer_serveur, bilan

HUNTER_REC = "/Lotus/Upgrades/Mods/Sets/Hunter/CompanionHunterRecoveryMod"
MAUL = "/Lotus/Upgrades/Mods/Sentinel/Kubrow/KubrowMeleeDamageMod"
SERRATION = "/Lotus/Upgrades/Mods/Rifle/WeaponDamageAmountMod"


def valeur(pg, etiquette):
    return pg.evaluate("""(et) => {
      const tr = [...document.querySelectorAll('#ars-stats tr')].find(r => (r.cells[0]||{}).textContent === et);
      if (!tr) return null;
      return parseFloat(tr.cells[1].childNodes[0].textContent.replace(/\\s/g, '').replace(',', '.'));
    }""", etiquette)


def ouvrir_picker(pg, slot):
    pg.click(f'[data-slot="{slot}"]')
    pg.wait_for_timeout(500)
    if not pg.locator("#ars-pk-q").is_visible():
        pg.click(f'[data-slot="{slot}"]')
        pg.wait_for_timeout(500)


def choisir(pg, slot, recherche, nom_exact):
    ouvrir_picker(pg, slot)
    pg.fill("#ars-pk-q", recherche)
    pg.wait_for_timeout(350)
    pg.locator(".ars-pk-it[data-un]", has_text=nom_exact).first.click()
    pg.wait_for_timeout(500)


def noms_proposes(pg, slot):
    ouvrir_picker(pg, slot)
    pg.fill("#ars-pk-q", "")
    pg.wait_for_timeout(300)
    noms = pg.eval_on_selector_all('.ars-pk-it[data-un]:not([data-un=""]) b', "els => els.map(e => e.textContent)")
    pg.keyboard.press("Escape")
    pg.wait_for_timeout(300)
    return noms


def poser(pg, un):
    pg.fill("#ars-coll-q", "")
    pg.wait_for_timeout(200)
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

        choisir(pg, "compagnon", "smeeta", "Smeeta Kavat")
        poser(pg, HUNTER_REC)
        txt = pg.locator("#ars-stats").text_content() or ""
        ok("sans griffes : le soin n'est PAS inventé, on invite à les équiper",
           "équipe les griffes" in txt and valeur(pg, "Récupération du Chasseur") is None)

        noms = noms_proposes(pg, "armecomp")
        ok("une Smeeta ne peut porter que les Griffes de Smeeta", noms == ["Smeeta Claws"], str(noms))

        choisir(pg, "armecomp", "", "Smeeta Claws")
        ok("griffes nues : 80 × (1 + 0,2) = 96 DPS", valeur(pg, "Rafale") == 96, str(valeur(pg, "Rafale")))
        ok("les griffes refusent un mod de fusil (Serration absente de la collection)",
           pg.locator(f'#ars-coll [data-equipe="{SERRATION}"]').count() == 0)
        poser(pg, MAUL)
        ok("Mâchoire (+330 %) : 96 × 4,3 = 413 DPS", valeur(pg, "Rafale") == 413, str(valeur(pg, "Rafale")))

        pg.click('[data-slot="compagnon"]')   # emplacement équipé : 1 clic = l'afficher
        pg.wait_for_timeout(500)
        ok("Récupération du Chasseur : 0,3 × 412,8 = 124 PV/s", valeur(pg, "Récupération du Chasseur") == 124,
           str(valeur(pg, "Récupération du Chasseur")))

        choisir(pg, "compagnon", "carrier", "Carrier")
        noms = noms_proposes(pg, "armecomp")
        ok("un Carrier ne se voit proposer aucune griffe", noms and not any("Claws" in n for n in noms), str(noms[:5]))
        ok("zéro erreur JS", errs == [], str(errs))
        b.close()
    if srv:
        srv.terminate()
    sys.exit(bilan("arsenal : griffes et Récupération du Chasseur"))


if __name__ == "__main__":
    main()
