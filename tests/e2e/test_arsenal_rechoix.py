#!/usr/bin/env python3
# v98 — rechoisir l'objet DÉJÀ équipé ne doit pas effacer son build.
# Défaut trouvé en v97 : le sélecteur remplaçait toujours la case par { un },
# donc cliquer « Nikana Prime » alors que la Nikana Prime est équipée vidait
# ses mods, sans avertissement. Un autre objet, lui, repart bien de zéro
# (comme en jeu : chaque arme a sa propre configuration).
import json
import sys

from playwright.sync_api import sync_playwright

from _outils import BASE, ok, lancer, bloquer_externe, demarrer_serveur, bilan

POINT_PRESSION = "/Lotus/Upgrades/Mods/Melee/WeaponMeleeDamageMod"


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


def mods_de(pg, slot):
    etat = json.loads(pg.evaluate("() => localStorage.getItem('vr-arsenal-v1') || '{}'"))
    e = (etat.get("equip") or {}).get(slot) or {}
    return [m for m in ((e.get("mods") or {}).get("slots") or []) if m]


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

        choisir(pg, "melee", "nikana prime", "Nikana Prime")
        pg.fill("#ars-coll-q", "")
        pg.wait_for_timeout(200)
        pg.locator(f'#ars-coll [data-equipe="{POINT_PRESSION}"]').first.click()
        pg.wait_for_timeout(500)
        ok("un mod posé sur la Nikana Prime", len(mods_de(pg, "melee")) == 1, str(mods_de(pg, "melee")))

        choisir(pg, "melee", "nikana prime", "Nikana Prime")
        ok("rechoisir la Nikana Prime GARDE son mod", len(mods_de(pg, "melee")) == 1, str(mods_de(pg, "melee")))

        choisir(pg, "melee", "orthos prime", "Orthos Prime")
        ok("une autre arme repart d'un build vide", mods_de(pg, "melee") == [], str(mods_de(pg, "melee")))
        ok("zéro erreur JS", errs == [], str(errs))
        b.close()
    if srv:
        srv.terminate()
    sys.exit(bilan("arsenal : rechoisir l'objet équipé garde son build"))


if __name__ == "__main__":
    main()
