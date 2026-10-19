#!/usr/bin/env python3
# Mods de LIEN du compagnon (05/09/2026) : Lien-Vitalité, Lien-Redirection et
# Lien-Fibre donnent au compagnon un bonus PLAT égal à 125 % de la statistique
# MODDÉE de la Warframe équipée.
#
# Les trois figurent dans les builds de compagnon que le site recommande à tous
# les niveaux ; le simulateur les affichait « effet non simulé ».
#
# Le contrôle qui compte est ARITHMÉTIQUE : on lit les PV de la frame affichés
# par la page, puis les PV du compagnon, et on vérifie l'égalité
#     compagnon_après = compagnon_avant + 1,25 × PV_frame
# Sans ce calcul, le test dirait seulement « le chiffre a bougé », ce qui
# passerait au vert avec une formule fausse.
import math
import re
import sys

from playwright.sync_api import sync_playwright

from _outils import BASE, ok, lancer, bloquer_externe, demarrer_serveur, bilan

LIEN_HP = "/Lotus/Upgrades/Mods/Sentinel/Kubrow/KubrowLinkHealthMaxMod"


def jsround(x):
    """Math.round de JavaScript : la moitié va vers le HAUT. round() de Python
    arrondit au pair le plus proche (1402,5 → 1402), ce qui faisait échouer le
    test sur un code juste — mesuré."""
    return math.floor(x + 0.5)


def nombre(txt, etiquette):
    """Valeur affichée en face d'une étiquette du tableau de statistiques."""
    m = re.search(etiquette + r"\D*?(\d[\d\s ]*)", txt)
    return int(re.sub(r"\D", "", m.group(1))) if m else None


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

        # 1) une Warframe aux PV connus
        pg.click('[data-slot="frame"]')
        pg.fill("#ars-pk-q", "rhino prime")
        pg.wait_for_timeout(350)
        pg.click('.ars-pk-it[data-un]:not([data-un=""])')
        pg.wait_for_timeout(500)
        pv_frame = nombre(pg.locator("#ars-stats").text_content() or "", "Sant")
        ok("PV de la Warframe lus", pv_frame and pv_frame > 0, str(pv_frame))

        # 2) un compagnon, PV AVANT le mod de lien
        pg.click('[data-slot="compagnon"]')
        pg.fill("#ars-pk-q", "kubrow")
        pg.wait_for_timeout(350)
        pg.click('.ars-pk-it[data-un]:not([data-un=""])')
        pg.wait_for_timeout(600)
        avant_txt = pg.locator("#ars-stats").text_content() or ""
        pv_avant = nombre(avant_txt, "Sant")
        ok("PV du compagnon lus avant le lien", pv_avant and pv_avant > 0, str(pv_avant))
        ok("aucune mention de lien tant que le mod n'est pas posé",
           "mods de lien" not in avant_txt.lower(), avant_txt[:90])

        # 3) on pose Lien-Vitalité. Le libellé se lit AVANT la pose : une fois
        #    équipé, le mod quitte la collection (mesuré — le test cherchait un
        #    élément disparu et expirait).
        pg.fill("#ars-coll-q", "lien")
        pg.wait_for_timeout(400)
        etiquette = pg.locator(f'#ars-coll [data-equipe="{LIEN_HP}"]').text_content() or ""
        ok("le mod n'est plus annoncé « effet non simulé »",
           "non simul" not in etiquette.lower(), etiquette[:90])
        pg.click(f'#ars-coll [data-equipe="{LIEN_HP}"]')
        pg.wait_for_timeout(600)
        apres_txt = pg.locator("#ars-stats").text_content() or ""
        pv_apres = nombre(apres_txt, "Sant")
        attendu = jsround(pv_avant + 1.25 * pv_frame)
        ok(f"PV du compagnon = {pv_avant} + 1,25 × {pv_frame} = {attendu}",
           pv_apres == attendu, f"affiché {pv_apres}")
        ok("le calcul est expliqué sous le tableau",
           "mods de lien" in apres_txt.lower(), apres_txt[-160:])
        # 4) le lien suit les mods de la FRAME : Vitalité sur la frame doit
        #    augmenter le compagnon. C'est ce qui distingue « stats moddées »
        #    de « stats de base » — une formule sur la base passerait ici.
        pg.click('[data-slot="frame"]')
        pg.wait_for_timeout(400)
        pg.fill("#ars-coll-q", "vitalit")
        pg.wait_for_timeout(400)
        pg.click('#ars-coll [data-equipe$="Warframe/AvatarHealthMaxMod"]')
        pg.wait_for_timeout(500)
        pv_frame2 = nombre(pg.locator("#ars-stats").text_content() or "", "Sant")
        ok("Vitalité augmente bien les PV de la frame", pv_frame2 > pv_frame,
           f"{pv_frame} → {pv_frame2}")
        pg.click('[data-slot="compagnon"]')
        pg.wait_for_timeout(600)
        pv_apres2 = nombre(pg.locator("#ars-stats").text_content() or "", "Sant")
        ok(f"le compagnon suit : {pv_avant} + 1,25 × {pv_frame2} = {jsround(pv_avant + 1.25 * pv_frame2)}",
           pv_apres2 == jsround(pv_avant + 1.25 * pv_frame2), f"affiché {pv_apres2}")

        ok("zéro erreur JS", not errs, str(errs))
    return bilan("mods de lien du compagnon")


if __name__ == "__main__":
    sys.exit(main())
