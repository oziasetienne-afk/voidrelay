#!/usr/bin/env python3
# Simulateur d'Arsenal — version ANGLAISE (17/07/2026) : mêmes maths que le test FR,
# mais on vérifie que /en/arsenal sert l'interface en anglais (libellés, noms de mods
# via le champ `en`, recherche par nom anglais) sans aucune régression du moteur.
import sys

from playwright.sync_api import sync_playwright

from _outils import BASE, ok, lancer, bloquer_externe, demarrer_serveur, bilan


def main():
    srv = demarrer_serveur()
    with sync_playwright() as p:
        b = lancer(p)
        ctx = b.new_context(viewport={"width": 1360, "height": 950})
        bloquer_externe(ctx)
        pg = ctx.new_page()
        errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)[:120]))

        pg.goto(BASE + "/en/arsenal", wait_until="domcontentloaded", timeout=30000)
        pg.wait_for_selector(".ars-slot", timeout=15000)
        ok("lang=en sur la page", pg.locator("html").get_attribute("lang") == "en")
        meta = pg.locator("#ars-meta").text_content() or ""
        ok("méta en anglais (weapons/data from)", "weapons" in meta and "data from" in meta, meta[:80])
        intro = pg.locator("#ars-mods").text_content() or ""
        ok("intro « How it works »", "How it works" in intro)

        # Chroma Prime : rang 30 = 370 PV / 450 armure / 300 énergie (mêmes maths qu'en FR)
        pg.click('[data-slot="frame"]')
        pg.fill("#ars-pk-q", "chroma prime")
        pg.wait_for_timeout(300)
        pg.click('.ars-pk-it[data-un]:not([data-un=""])')
        pg.wait_for_timeout(400)
        stats = pg.locator("#ars-stats").text_content() or ""
        ok("stats rang 30 identiques (370/450/300)",
           all(v in stats for v in ("370", "450", "300")), stats[:120])
        ok("libellés de stats en anglais", "Health" in stats and "Stats (rank 30)" in stats)
        mods = pg.locator("#ars-mods").text_content() or ""
        ok("écran de mods en anglais (Upgrades/Capacity)", "Upgrades" in mods and "Capacity" in mods)

        # Intensify (nom ANGLAIS d'Intensité) trouvé par la recherche de la collection,
        # drain discordant 11 + 25 % arrondi = 14 — comme en FR.
        pg.click('.ars-vide[data-i="0"]')
        pg.fill("#ars-coll-q", "Intensify")
        pg.wait_for_timeout(300)
        pg.click('#ars-coll [data-equipe$="Warframe/AvatarAbilityStrengthMod"]')
        pg.wait_for_timeout(400)
        stats = pg.locator("#ars-stats").text_content() or ""
        ok("+ Intensify → Strength 130 %", "130 %" in stats)
        carte = pg.locator('#ars-mods .ars-case[data-i="0"]').text_content() or ""
        ok("carte du mod au nom anglais (Intensify)", "Intensify" in carte, carte[:60])
        cap = pg.locator(".ars-cap-txt").text_content() or ""
        ok("drain 14 (11 + 25 % arrondi)", "14" in cap.split("·")[0] + cap, cap[:80])

        # Soma Prime + Serration (nom EN de Dentelure) : 12 → 31.8
        pg.click('[data-slot="primaire"]')
        pg.fill("#ars-pk-q", "soma prime")
        pg.wait_for_timeout(300)
        pg.click('.ars-pk-it[data-un]:not([data-un=""])')
        pg.wait_for_timeout(400)
        pg.click('.ars-vide[data-i="0"]')
        pg.fill("#ars-coll-q", "serration")
        pg.wait_for_timeout(300)
        pg.click('#ars-coll [data-equipe$="Rifle/WeaponDamageAmountMod"]')
        pg.wait_for_timeout(400)
        stats = pg.locator("#ars-stats").text_content() or ""
        ok("Soma Prime + Serration : 12 → 31.8 dégâts", "31.8" in stats, stats[:150])
        ok("table d'arme en anglais (Damage per shot)", "Damage per shot" in stats)

        # Arcane d'arme (v18) côté EN : mêmes maths (31.8 → 146.2 aux stacks max).
        mods = pg.locator("#ars-mods").text_content() or ""
        ok("rangée « Weapon arcane » présente", "Weapon arcane" in mods)
        pg.click("[data-arcarme]")
        pg.fill("#ars-pk-q", "merciless")
        pg.wait_for_timeout(300)
        pg.click('.ars-pk-it[data-un]:not([data-un=""])')
        pg.wait_for_timeout(400)
        stats = pg.locator("#ars-stats").text_content() or ""
        ok("arcane non additionnée par défaut (EN)", "NOT added" in stats and "31.8" in stats)
        pg.click("#ars-arcmax")
        pg.wait_for_timeout(400)
        stats = pg.locator("#ars-stats").text_content() or ""
        ok("stacks max EN : 146.2", "146.2" in stats, stats[:180])

        # Configs A/B/C (v21) : onglets présents et permutables côté EN aussi.
        ok("onglets CONFIG A/B/C affichés", pg.locator(".ars-cfg").count() == 3)
        pg.click('[data-cfg="1"]')
        pg.wait_for_timeout(400)
        ok("bascule en CONFIG B", "CONFIG B" in (pg.locator(".ars-cfg.on").text_content() or ""))
        pg.click('[data-cfg="0"]')
        pg.wait_for_timeout(400)

        # Build auto côté EN : panneau en anglais, résultat légal en capacité.
        pg.click("#ars-auto")
        pg.wait_for_selector('input[name="ars-obj"]', timeout=8000)
        panneau = pg.locator(".ars-pk-box").text_content() or ""
        ok("panneau Auto-build en anglais", "Auto-build" in panneau and "Scope" in panneau)
        pg.check('input[name="ars-perim"][value="tous"]')
        pg.click("#ars-auto-go")
        pg.wait_for_timeout(700)
        note = pg.locator(".ars-auto-note").text_content() or ""
        ok("auto-build EN : bannière avec Ctrl+Z", "Auto-build" in note and "undo" in note, note[:140])

        # v48 : postures côté EN — filtrage par classe et panneau traduits.
        pg.click('[data-slot="melee"]')
        pg.wait_for_timeout(500)
        pg.fill("#ars-pk-q", "nikana prime")
        pg.wait_for_timeout(500)
        pg.locator('#ars-picker .ars-pk-it[data-un]:not([data-un=""])').first.click()
        pg.wait_for_timeout(900)
        pg.click('.ars-vide[data-i="st"]')
        pg.wait_for_timeout(800)
        tt = pg.locator(".ars-coll-tt").text_content() or ""
        ok("v48 EN : Stance collection filtrée sur la classe Nikana",
           "Stance" in tt and "Nikana" in tt and pg.locator("#ars-coll [data-equipe]").count() == 3, tt[:90])
        pg.fill("#ars-coll-q", "justice")
        pg.wait_for_timeout(500)
        pg.locator("#ars-coll [data-equipe]").first.click()
        pg.wait_for_timeout(900)
        panneau_st = pg.evaluate(
            "(()=>{const r=document.querySelector('#ars-stats .ars-post-r');"
            "return r?r.textContent.replace(/\\s+/g,' ').trim():'';})()")
        ok("v48 EN : combos en anglais (hits / Neutral)",
           "hits" in panneau_st and "Neutral" in panneau_st, panneau_st[:120])

        ok("zéro erreur JS", not errs, str(errs[:2]))
        ctx.close()
        b.close()
    if srv:
        srv.terminate()
    return bilan("simulateur d'arsenal (anglais)")


if __name__ == "__main__":
    sys.exit(main())
