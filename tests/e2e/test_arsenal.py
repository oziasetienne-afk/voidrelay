#!/usr/bin/env python3
# Simulateur d'Arsenal (16/07/2026) : maths vérifiées contre les valeurs du jeu —
# stats rang 30 (rework 2022), drain/polarité (wiki), dégâts ×(1+Σ mods dégâts).
import base64
import re
import json
import sys

from playwright.sync_api import sync_playwright

from _outils import BASE, ok, lancer, bloquer_externe, demarrer_serveur, bilan


def _decroissant(vals):
    return all(vals[i] >= vals[i + 1] for i in range(len(vals) - 1))


def main():
    srv = demarrer_serveur()
    with sync_playwright() as p:
        b = lancer(p)
        ctx = b.new_context(viewport={"width": 1360, "height": 950})
        bloquer_externe(ctx)
        pg = ctx.new_page()
        errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)[:120]))

        pg.goto(BASE + "/arsenal", wait_until="domcontentloaded", timeout=30000)
        pg.wait_for_selector(".ars-slot", timeout=15000)
        meta = pg.locator("#ars-meta").text_content() or ""
        ok("données chargées (méta affichée)", "Warframes" in meta and "mods" in meta, meta[:80])

        # Chroma Prime : rang 30 = 370 PV / 370 bouclier / 450 armure / 300 énergie
        pg.click('[data-slot="frame"]')
        pg.fill("#ars-pk-q", "chroma prime")
        pg.wait_for_timeout(300)
        pg.click('.ars-pk-it[data-un]:not([data-un=""])')
        pg.wait_for_timeout(400)
        stats = pg.locator("#ars-stats").text_content() or ""
        ok("Chroma Prime rang 30 (370/370/450/300)",
           all(v in stats for v in ("370", "450", "300")), stats[:120])

        # + Intensité (emplacement naramon, mod madurai) → Puissance 130 %,
        # drain 11 + 25 % arrondi = 14 (exactement comme dans le jeu)
        pg.click('.ars-vide[data-i="0"]')
        pg.fill("#ars-coll-q", "Intensité")
        pg.wait_for_timeout(300)
        pg.click('#ars-coll [data-equipe$="Warframe/AvatarAbilityStrengthMod"]')
        pg.wait_for_timeout(400)
        stats = pg.locator("#ars-stats").text_content() or ""
        ok("+ Intensité → Puissance 130 %", "130 %" in stats)
        cap = pg.locator(".ars-cap-txt").text_content() or ""
        ok("drain polarité discordante : 14 (11 + 25 % arrondi)", "14" in cap.split("·")[0] + cap, cap[:80])

        # Forma explicite (v23) : bouton « Forma » sous l'emplacement — pose
        # madurai (polarité d'Intensité) → drain 14 → 6 (ceil(11/2)), puis
        # enlève le forma → 14 de nouveau. Ajout/retrait libres, comme demandé.
        pg.click('.ars-case[data-i="0"] .ars-forma')
        pg.wait_for_timeout(300)
        pg.click('.ars-pk-it[data-un="madurai"]')
        pg.wait_for_timeout(400)
        cap = pg.locator(".ars-cap-txt").text_content() or ""
        ok("forma madurai posé : drain 6 (concordant, ceil(11/2))", "Capacité 6" in cap.replace("\xa0", " "), cap[:60])
        ok("bouton Forma marqué ✓", "Forma ✓" in (pg.locator('.ars-case[data-i="0"] .ars-forma').text_content() or ""))
        pg.click('.ars-case[data-i="0"] .ars-forma')
        pg.wait_for_timeout(300)
        pg.click('.ars-pk-it[data-un=""]')
        pg.wait_for_timeout(400)
        cap = pg.locator(".ars-cap-txt").text_content() or ""
        ok("forma enlevé : drain 14 de retour", "Capacité 14" in cap.replace("\xa0", " "), cap[:60])

        # Soma Prime + Dentelure (+165 % dégâts) : 12 → 31.8
        pg.click('[data-slot="primaire"]')
        pg.fill("#ars-pk-q", "soma prime")
        pg.wait_for_timeout(300)
        pg.click('.ars-pk-it[data-un]:not([data-un=""])')
        pg.wait_for_timeout(600)
        # v29 : la collection des mods COMPATIBLES apparaît dès la sélection,
        # sans cliquer d'emplacement (comme dans le jeu) ; cliquer une STAT
        # filtre sur les mods qui la touchent, la pastille retire le filtre.
        ok("collection visible dès la sélection (mode équipement)",
           pg.locator("#ars-coll:not([hidden])").count() == 1
           and "compatibles" in (pg.locator(".ars-coll-tt").text_content() or ""))
        n_tous = pg.locator("#ars-coll [data-equipe]").count()
        pg.click('#ars-stats tr.ars-stat-clic:has-text("Chance critique")')
        pg.wait_for_timeout(500)
        n_crit = pg.locator("#ars-coll [data-equipe]").count()
        ok("clic sur « Chance critique » : la collection se filtre",
           0 < n_crit < n_tous, f"{n_crit}/{n_tous}")
        pg.click("#ars-coll-fx-x")
        pg.wait_for_timeout(400)
        ok("pastille × : le filtre de stat se retire",
           pg.locator("#ars-coll [data-equipe]").count() == n_tous)
        pg.click('.ars-vide[data-i="0"]')
        pg.fill("#ars-coll-q", "dentelure")
        pg.wait_for_timeout(300)
        pg.click('#ars-coll [data-equipe$="Rifle/WeaponDamageAmountMod"]')
        pg.wait_for_timeout(400)
        stats = pg.locator("#ars-stats").text_content() or ""
        ok("Soma Prime + Dentelure : 12 → 31.8 dégâts", "31.8" in stats, stats[:150])

        # Arcane d'arme (v18) : Primary Merciless — équipée = affichée SANS toucher
        # aux chiffres ; « stacks max » coché = ×4,6 multiplicatif avec les mods
        # (12 stacks × 30 %) : 31.8 → 146.2, recharge 3 s → 2.31 s (+30 % additif).
        pg.click("[data-arcarme]")
        pg.fill("#ars-pk-q", "merciless")
        pg.wait_for_timeout(300)
        pg.click('.ars-pk-it[data-un]:not([data-un=""])')
        pg.wait_for_timeout(400)
        stats = pg.locator("#ars-stats").text_content() or ""
        ok("arcane équipée : honnêteté (non additionnée par défaut, 31.8 inchangé)",
           "NON additionnée" in stats and "31.8" in stats, stats[-200:])
        pg.click("#ars-arcmax")
        pg.wait_for_timeout(400)
        stats = pg.locator("#ars-stats").text_content() or ""
        ok("stacks max : 31.8 → 146.2 (×4,6) et recharge 2.31 s",
           "146.2" in stats and "2.31" in stats, stats[:220])
        pg.click("#ars-arcmax")  # retour à l'état honnête par défaut
        pg.wait_for_timeout(300)

        # Configs A/B/C (v21) : mods indépendants par config, formas COMMUNES.
        # Ici : l'Intensité posée plus haut vit en config A ; B naît vide ;
        # retour en A → l'Intensité est toujours là. (On est sur la primaire
        # après le scénario arcane → on revient d'abord sur la frame.)
        pg.click('[data-slot="frame"]')
        pg.wait_for_timeout(400)
        ok("config A active par défaut", "CONFIG A" in (pg.locator(".ars-cfg.on").text_content() or ""))
        avant = pg.locator(".ars-cap-txt").text_content() or ""
        pg.click('[data-cfg="1"]')
        pg.wait_for_timeout(400)
        apres = pg.locator(".ars-cap-txt").text_content() or ""
        ok("config B : repart vide (capacité 0 utilisée)", "Capacité 0" in apres.replace("\xa0", " "), apres[:60])
        ok("indicateur • sur la config A occupée", "CONFIG A •" in (pg.locator('[data-cfg="0"]').text_content() or ""))
        pg.click('[data-cfg="0"]')
        pg.wait_for_timeout(400)
        retour = pg.locator(".ars-cap-txt").text_content() or ""
        ok("retour en A : les mods sont intacts (14 de drain)", "14" in retour and retour.split("·")[0] == avant.split("·")[0], retour[:60])
        # on rend la sélection à la primaire (recliquer un slot déjà actif ouvre
        # son sélecteur d'équipement, comme dans le jeu — voulu, mais pas ici)
        pg.click('[data-slot="primaire"]')
        pg.wait_for_timeout(300)

        # Build auto INTELLIGENT (17/07/2026) : source par défaut = MÉTA DU SITE
        # (arsenal_builds.json, palier expert) — Chroma Prime doit recevoir SON
        # build du site, pas un assemblage statistique.
        pg.click("#ars-auto")
        pg.wait_for_selector('input[name="ars-src"]', timeout=8000)
        ok("build auto : la méta du site est la source par défaut",
           pg.evaluate("() => document.querySelector('input[name=\"ars-src\"][value=\"site\"]').checked"))
        pg.check('input[name="ars-perim"][value="tous"]')
        pg.click("#ars-auto-go")
        pg.wait_for_timeout(1500)
        note_site = pg.locator(".ars-auto-note").text_content() or ""
        ok("build auto méta : bannière « méta du site »", "méta du site" in note_site, note_site[:80])
        meta_frame = pg.evaluate("""async () => {
          const e = JSON.parse(localStorage['vr-arsenal-v1']);
          const mods = await fetch('/data/arsenal/mods.json').then(r => r.json());
          const par = {}; mods.forEach(m => par[m.un] = m);
          return (e.equip.frame.mods.slots||[]).filter(Boolean).map(r => par[r.un] && par[r.un].en);
        }""")
        ok("build auto méta : Chroma Prime reçoit le build du site (Umbral Intensify)",
           "Umbral Intensify" in meta_frame, str(meta_frame[:3]))

        # Build auto SCORING (mode statistique conservé) : objectif survie sur
        # tout le loadout — le résultat doit être LÉGAL (formas auto, 5 max).
        pg.click("#ars-auto")
        pg.wait_for_selector('input[name="ars-obj"]', timeout=8000)
        pg.check('input[name="ars-src"][value="stats"]')
        pg.check('input[name="ars-obj"][value="survie"]')
        pg.check('input[name="ars-perim"][value="tous"]')
        pg.click("#ars-auto-go")
        pg.wait_for_timeout(700)
        note = pg.locator(".ars-auto-note").text_content() or ""
        ok("build auto : bannière de résultat (frame + arme)",
           "Build auto" in note and "Chroma Prime" in note and "Soma Prime" in note, note[:160])
        # Arcanes posées par le build auto (17/07/2026) — frame : 2 (objectif
        # survie → Gardien/Grâce), arme : 1 ; et le BUG « un absent » des
        # arcanes de frame est réparé (elles étaient inéquipables).
        arcs = pg.evaluate("""() => {
          const e = JSON.parse(localStorage['vr-arsenal-v1']);
          return { frame: (e.equip.frame.arcanes || []).filter(Boolean).length,
                   prim: (e.equip.primaire.arcanes || []).filter(Boolean).length };
        }""")
        ok("build auto : 2 arcanes de frame + 1 d'arme posées",
           arcs["frame"] == 2 and arcs["prim"] == 1, str(arcs))
        legal = pg.evaluate("""() => {
          const e = JSON.parse(localStorage['vr-arsenal-v1']);
          const nb = (e.equip.frame.mods.slots || []).filter(Boolean).length;
          return { nb, formas: Object.keys(e.equip.frame.formas || {}).length };
        }""")
        ok("build auto : ≥ 6 mods posés sur la frame, ≤ 5 formas",
           legal["nb"] >= 6 and legal["formas"] <= 5, str(legal))
        pg.click('[data-slot="frame"]')
        pg.wait_for_timeout(400)
        ok("build auto : capacité de la frame respectée (aucun ⚠)",
           pg.locator("#ars-mods .ars-over").count() == 0)
        # objectif survie → au moins un mod de santé (fx.hp) doit être posé
        aSante = pg.evaluate("""async () => {
          const e = JSON.parse(localStorage['vr-arsenal-v1']);
          const mods = await fetch('/data/arsenal/mods.json').then(r => r.json());
          const parUn = {}; mods.forEach(m => parUn[m.un] = m);
          return (e.equip.frame.mods.slots || []).filter(Boolean)
            .some(r => (parUn[r.un] && parUn[r.un].fx && parUn[r.un].fx.hp || 0) > 0);
        }""")
        ok("build auto survie : un mod de santé (fx.hp) est posé", bool(aSante))

        # Glisser-déposer (17/07/2026) : échange d'emplacements à la souris —
        # drag pointer maison (le DnD HTML5 natif n'était pas fiable). Les
        # cartes doivent être DANS le viewport (elementFromPoint).
        def glisse(sel_a, sel_b):
            # source ET cible doivent être dans le viewport (elementFromPoint)
            pg.locator(sel_b).scroll_into_view_if_needed()
            pg.wait_for_timeout(250)
            pg.locator(sel_a).scroll_into_view_if_needed()
            pg.wait_for_timeout(250)
            a = pg.locator(sel_a).bounding_box()
            c = pg.locator(sel_b).bounding_box()
            x0, y0 = a["x"] + a["width"] / 2, a["y"] + a["height"] / 2
            x1, y1 = c["x"] + c["width"] / 2, c["y"] + c["height"] / 2
            pg.mouse.move(x0, y0)
            pg.mouse.down()
            for k in range(1, 7):
                pg.mouse.move(x0 + (x1 - x0) * k / 6, y0 + (y1 - y0) * k / 6)
                pg.wait_for_timeout(25)
            pg.mouse.up()
            pg.wait_for_timeout(500)

        def slots_frame():
            return pg.evaluate("() => JSON.parse(localStorage['vr-arsenal-v1']).equip.frame.mods.slots.map(r => r && r.un)")

        # (la frame est DÉJÀ sélectionnée — re-cliquer ouvrirait son sélecteur)
        avant_dnd = slots_frame()
        glisse('.ars-case[data-i="0"] .ars-mod.v24', '.ars-case[data-i="1"] .ars-mod.v24')
        apres_dnd = slots_frame()
        ok("glisser-déposer : échange des emplacements 0 ↔ 1",
           apres_dnd[0] == avant_dnd[1] and apres_dnd[1] == avant_dnd[0], str(apres_dnd[:2]))
        # retrait : glisser la carte de la rangée BASSE (proche de la collection,
        # les deux tiennent ensemble dans le viewport) dans la collection ouverte
        pg.click('.ars-case[data-i="2"] .ars-mod-corps')
        pg.wait_for_timeout(800)
        glisse('.ars-case[data-i="5"] .ars-mod.v24', '#ars-coll .ars-coll-grid')
        ok("glisser-déposer : relâcher dans la collection retire le mod",
           slots_frame()[5] is None)
        # équiper : glisser une carte de la collection vers l'emplacement vidé
        pg.click('.ars-case[data-i="5"] .ars-vide')
        pg.wait_for_timeout(800)
        glisse('#ars-coll [data-equipe] >> nth=0', '.ars-case[data-i="5"]')
        ok("glisser-déposer : équiper depuis la collection", slots_frame()[5] is not None)

        # « Retirer les mods » (REMOVE ALL du jeu) + bouton ↩ Annuler visible
        # (17/07/2026) : vide la config active de l'équipement AFFICHÉ seulement,
        # formas conservés (règle du jeu) ; l'annulation au bouton restaure tout.
        cap_avant = (pg.locator(".ars-cap-txt").text_content() or "").split("·")[0]
        formas_avant = pg.evaluate("() => Object.keys(JSON.parse(localStorage['vr-arsenal-v1']).equip.frame.formas||{}).length")
        pg.click("#ars-removeall")
        pg.wait_for_timeout(500)
        cap_vide = (pg.locator(".ars-cap-txt").text_content() or "").replace("\xa0", " ")
        formas_apres = pg.evaluate("() => Object.keys(JSON.parse(localStorage['vr-arsenal-v1']).equip.frame.formas||{}).length")
        ok("« Retirer les mods » : écran courant vidé (capacité 0 utilisée)", "Capacité 0" in cap_vide, cap_vide[:40])
        ok("« Retirer les mods » : les formas restent (règle du jeu)", formas_apres == formas_avant, f"{formas_apres}/{formas_avant}")
        ok("bouton ↩ Annuler visible après une action", pg.locator("#ars-undo:not([hidden])").count() == 1)
        pg.click("#ars-undo")
        pg.wait_for_timeout(500)
        cap_retour = (pg.locator(".ars-cap-txt").text_content() or "").split("·")[0]
        ok("↩ Annuler au bouton : les mods reviennent", cap_retour == cap_avant, cap_retour[:30])

        # v47 : la simulation d'ennemi (préréglage / armure / santé / niveau /
        # temps pour tuer) est REMPLACÉE par le tableau « Efficacité par
        # faction » — changement d'intention, pas un test assoupli.
        pg.click('[data-slot="primaire"]')
        pg.wait_for_timeout(400)
        cible_txt = pg.locator("#ars-stats").text_content() or ""
        ok("v47 : plus aucun réglage d'ennemi (armure / niveau / preset)",
           pg.locator("#ars-cb-preset, #ars-cb-ar, #ars-cb-lv, #ars-cb-hp, #ars-cb-fac").count() == 0)
        ok("v47 : tableau « Efficacité par faction » présent",
           "Efficacité par faction" in cible_txt)
        ok("v47 : une ligne par faction (6)", pg.locator("#ars-stats tr.ars-fac-r").count() == 6)

        # v36 : icônes des types de dégâts et barres de répartition
        ok("v36 : icônes de types de dégâts", pg.locator("#ars-stats .ars-dmg-ic").count() >= 3)
        ok("v36 : barres de répartition des dégâts", pg.locator("#ars-stats .ars-dmg-part").count() >= 2)
        # v37 : procs de statut par seconde (cadence × multishot × chance)
        ok("v37 : ligne procs de statut / s", "Procs de statut / s" in cible_txt)

        # Recherche des sélecteurs insensible aux accents (v27) : « emeraude »
        # sans accent doit trouver le fragment Émeraude.
        pg.click('[data-slot="frame"]')
        pg.wait_for_timeout(400)
        pg.click('[data-frag="0"]')
        pg.wait_for_timeout(400)
        pg.fill("#ars-pk-q", "emeraude")
        pg.wait_for_timeout(300)
        n_frag = pg.locator('.ars-pk-it[data-un]:not([data-un=""])').count()
        ok("recherche sans accent : « emeraude » trouve Émeraude", n_frag >= 1, str(n_frag))
        pg.keyboard.press("Escape")
        pg.wait_for_timeout(300)

        # v30 : STATS DES POUVOIRS (wiki, rang max) × Puissance/Durée/Portée du
        # build — vérifie la ligne « Scorn max armor bonus » de Vex Armor.
        # (la frame est DÉJÀ sélectionnée — re-cliquer ouvrirait son sélecteur)
        pg.click(".ars-abcard >> nth=2 >> summary")
        pg.wait_for_timeout(500)
        verif = pg.evaluate("""() => {
          const P = Number(document.querySelector('#ars-stats').textContent.match(/Puissance\\s*(\\d+)/)?.[1]);
          const carte = document.querySelectorAll('.ars-abcard')[2];
          const tr = [...carte.querySelectorAll('.ars-ab-st tr')].find(r => r.textContent.includes('Scorn max armor bonus'));
          if (!tr) return { err: 'ligne absente' };
          const val = parseFloat(tr.querySelector('.ars-val').textContent);
          const base = parseFloat(tr.querySelector('.ars-val small')?.textContent.replace(/[()]/g, '') || '350');
          return { P, val, base, attendu: Math.round(base * P) / 100 };
        }""")
        ok("stats des pouvoirs : Vex Armor moddée = base × Puissance",
           "err" not in verif and abs(verif["val"] - verif["attendu"]) < 0.6, str(verif))

        # v31 : sélecteurs navigables au CLAVIER — ↓ surligne, Entrée choisit.
        pg.click('[data-slot="secondaire"]')
        pg.wait_for_timeout(400)
        pg.fill("#ars-pk-q", "lex prime")
        pg.wait_for_timeout(350)
        pg.keyboard.press("ArrowDown")
        ok("sélecteur : ↓ surligne une entrée", pg.locator(".ars-pk-it.kb").count() == 1)
        pg.keyboard.press("Enter")
        pg.wait_for_timeout(500)
        ok("sélecteur : Entrée équipe l'entrée surlignée",
           pg.evaluate("() => !!JSON.parse(localStorage['vr-arsenal-v1']).equip.secondaire"))

        # v33 : RIVEN PERSONNALISÉ — création (+100 % dégâts, drain 12), carte
        # violette, maths appliquées, puis suppression propre.
        pg.click('[data-slot="primaire"]')
        pg.wait_for_timeout(400)
        pg.click("[data-riven]")
        pg.wait_for_timeout(500)
        pg.locator(".ars-rv-stat").nth(0).select_option("dmg")
        pg.locator(".ars-rv-val").nth(0).fill("100")
        pg.fill("#ars-rv-d", "12")
        pg.click("#ars-rv-ok")
        pg.wait_for_timeout(700)
        ok("riven : carte violette posée", pg.locator(".ars-mod.v24.r-riv").count() == 1)
        st_rv = pg.locator("#ars-stats").text_content() or ""
        ok("riven : +100 % dégâts appliqués aux stats", "(+" in st_rv and "Total" in st_rv)
        pg.click("[data-riven]")
        pg.wait_for_timeout(500)
        pg.click("#ars-rv-del")
        pg.wait_for_timeout(600)
        ok("riven : suppression retire la carte et la référence",
           pg.locator(".ars-mod.v24.r-riv").count() == 0)

        # partage par lien (hash) + zéro erreur JS — v34 : lien COMPRESSÉ #z=
        # (lz-string, ~40 % plus court), anciens #b= toujours lus.
        pg.click("#ars-share")
        pg.wait_for_timeout(200)
        ok("partage : hash compressé #z= dans l'URL", "#z=" in pg.url)
        pg.click("#ars-qr")
        pg.wait_for_timeout(500)
        ok("QR : le code du build s'affiche", pg.locator("#ars-picker img").count() == 1)
        pg.keyboard.press("Escape")
        pg.wait_for_timeout(300)

        # v38 : spécificités des frames. JADE a DEUX emplacements d'aura (wiki :
        # un universel + un Vazarin) — les deux ajoutent de la capacité.
        pg.click('[data-slot="frame"]')
        pg.wait_for_timeout(600)
        if not pg.locator("#ars-pk-q").is_visible():
            pg.click('[data-slot="frame"]')
            pg.wait_for_timeout(600)
        pg.fill("#ars-pk-q", "jade")
        pg.wait_for_timeout(500)
        pg.locator('#ars-picker .ars-pk-it[data-un]:not([data-un=""])').first.click()
        pg.wait_for_timeout(900)
        ok("Jade : deux cases d'aura affichées",
           pg.locator('.ars-case[data-i="aura"]').count() == 1 and pg.locator('.ars-case[data-i="aura2"]').count() == 1)
        cap_j0 = pg.locator(".ars-capl b").text_content()
        pg.click('.ars-case[data-i="aura"] .ars-vide')
        pg.wait_for_timeout(700)
        pg.fill("#ars-coll-q", "charge")
        pg.wait_for_timeout(600)
        pg.locator("#ars-coll [data-equipe]").first.click()
        pg.wait_for_timeout(700)
        pg.click('.ars-case[data-i="aura2"] .ars-vide')
        pg.wait_for_timeout(700)
        pg.fill("#ars-coll-q", "siphon")
        pg.wait_for_timeout(600)
        pg.locator("#ars-coll [data-equipe]").first.click()
        pg.wait_for_timeout(700)
        cap_j2 = pg.locator(".ars-capl b").text_content()
        ok("Jade : les DEUX auras ajoutent de la capacité",
           int(cap_j2.split("/")[1]) > int(cap_j0.split("/")[1]) + 5, cap_j0 + " → " + cap_j2)

        # v38 : duo Sirius & Orion — bandeau, bascule, build conservé par moitié.
        pg.click('[data-slot="frame"]')
        pg.wait_for_timeout(600)
        if not pg.locator("#ars-pk-q").is_visible():
            pg.click('[data-slot="frame"]')
            pg.wait_for_timeout(600)
        pg.fill("#ars-pk-q", "sirius")
        pg.wait_for_timeout(500)
        pg.locator('#ars-picker .ars-pk-it[data-un]:not([data-un=""])').first.click()
        pg.wait_for_timeout(900)
        ok("duo : bandeau + bouton de bascule", "Duo" in (pg.locator("#ars-stats").text_content() or "")
           and pg.locator("[data-liee]").count() == 1)
        pg.click('.ars-case[data-i="0"] .ars-vide')
        pg.wait_for_timeout(700)
        pg.fill("#ars-coll-q", "intensite")
        pg.wait_for_timeout(600)
        pg.locator("#ars-coll [data-equipe]").first.click()
        pg.wait_for_timeout(700)
        lit_frame = "(()=>{const e=JSON.parse(localStorage.getItem('vr-arsenal-v1')||'{}');return [(e.equip&&e.equip.frame&&e.equip.frame.un||''),(e.equip&&e.equip.frame&&e.equip.frame.mods&&e.equip.frame.mods.slots[0]&&e.equip.frame.mods.slots[0].un||'')]})()"
        avant = pg.evaluate(lit_frame)
        pg.click("[data-liee]")
        pg.wait_for_timeout(900)
        milieu = pg.evaluate(lit_frame)
        pg.click("[data-liee]")
        pg.wait_for_timeout(900)
        retour = pg.evaluate(lit_frame)
        ok("duo : la bascule change de moitié (build vierge de l'autre côté)",
           milieu[0] != avant[0] and milieu[1] == "")
        ok("duo : le build de chaque moitié est CONSERVÉ à l'aller-retour",
           retour[0] == avant[0] and retour[1] == avant[1] and avant[1] != "")

        # v39 : coûts spéciaux — Lavos recharge ⏱ (efficacité sans effet),
        # Hildryn coûts en boucliers 🛡 (wiki, règle du jeu).
        pg.click('[data-slot="frame"]')
        pg.wait_for_timeout(600)
        if not pg.locator("#ars-pk-q").is_visible():
            pg.click('[data-slot="frame"]')
            pg.wait_for_timeout(600)
        pg.fill("#ars-pk-q", "lavos")
        pg.wait_for_timeout(500)
        pg.locator('#ars-picker .ars-pk-it[data-un]:not([data-un=""])').first.click()
        pg.wait_for_timeout(900)
        st_lv = pg.locator("#ars-stats").text_content() or ""
        ok("Lavos : recharges ⏱ sans coût d'énergie", "⏱" in st_lv and "⚡" not in st_lv)
        pg.click('[data-slot="frame"]')
        pg.wait_for_timeout(600)
        if not pg.locator("#ars-pk-q").is_visible():
            pg.click('[data-slot="frame"]')
            pg.wait_for_timeout(600)
        pg.fill("#ars-pk-q", "hildryn")
        pg.wait_for_timeout(500)
        pg.locator('#ars-picker .ars-pk-it[data-un]:not([data-un=""])').first.click()
        pg.wait_for_timeout(900)
        st_hy = pg.locator("#ars-stats").text_content() or ""
        ok("Hildryn : coûts en boucliers 🛡", "🛡" in st_hy and "⚡" not in st_hy)

        # v41 : épingle — figer les stats puis voir les deltas en direct
        pg.click('[data-slot="primaire"]')
        pg.wait_for_timeout(500)
        pg.click("#ars-removeall")  # slots vides garantis pour les prochains équipements
        pg.wait_for_timeout(500)
        pg.click("#ars-pin")
        pg.wait_for_timeout(400)
        ok("épingle : bouton passe à Épinglé ✓", "Épinglé ✓" in (pg.text_content("#ars-pin") or ""))
        pg.click('.ars-case[data-i="1"] .ars-vide')
        pg.wait_for_timeout(600)
        pg.fill("#ars-coll-q", "chambre divisée")
        pg.wait_for_timeout(500)
        it_c = pg.query_selector("#ars-coll [data-equipe]")
        if it_c:
            it_c.click()
            pg.wait_for_timeout(700)
            ok("épingle : deltas ▲ affichés après un mod", pg.locator("#ars-stats .ars-pin-d").count() >= 1)
        pg.click("#ars-pin")
        pg.wait_for_timeout(400)
        ok("épingle : retrait efface les deltas", pg.locator("#ars-stats .ars-pin-d").count() == 0)

        # v42 : mods Galvanisés aux stacks max (opt-in) — équiper Chambre
        # Galvanisée fait apparaître la case ; la cocher augmente le multishot.
        pg.click('.ars-case[data-i="2"] .ars-vide')
        pg.wait_for_timeout(600)
        pg.fill("#ars-coll-q", "chambre galvanisée")
        pg.wait_for_timeout(500)
        it_g = pg.query_selector("#ars-coll [data-equipe]")
        if it_g:
            it_g.click()
            pg.wait_for_timeout(700)
            ok("galvanisés : la case stacks max apparaît", pg.locator("#ars-galvmax").count() == 1)
            ms_avant = pg.evaluate("document.querySelector('#ars-stats')?.textContent.match(/Multishot([0-9.]+)/)?.[1]")
            pg.click("#ars-galvmax")
            pg.wait_for_timeout(600)
            ms_apres = pg.evaluate("document.querySelector('#ars-stats')?.textContent.match(/Multishot([0-9.]+)/)?.[1]")
            ok("galvanisés : stacks max augmentent le multishot",
               ms_avant and ms_apres and float(ms_apres) > float(ms_avant), str(ms_avant) + " → " + str(ms_apres))
            pg.click("#ars-galvmax")
            pg.wait_for_timeout(400)

        # v43 : diagnostic de build — présent, et l'arme nue déclenche des alertes
        pg.click("#ars-removeall")
        pg.wait_for_timeout(500)
        diag = pg.locator("#ars-stats .ars-diag")
        ok("diagnostic : bloc présent", diag.count() == 1)
        diag.locator("summary").click()
        pg.wait_for_timeout(300)
        ok("diagnostic : arme nue → au moins 2 alertes ⚠",
           pg.locator("#ars-stats .ars-diag-warn").count() >= 2)

        # v44 : arme exaltée moddable sur son propre emplacement (Excalibur)
        pg.click('[data-slot="frame"]')
        pg.wait_for_timeout(500)
        if not pg.locator("#ars-pk-q").is_visible():
            pg.click('[data-slot="frame"]')
            pg.wait_for_timeout(500)
        pg.fill("#ars-pk-q", "excalibur")
        pg.wait_for_timeout(500)
        pg.locator('#ars-picker .ars-pk-it[data-un]:not([data-un=""])').first.click()
        pg.wait_for_timeout(800)
        ok("exaltée : bouton pour la modder sur la frame", pg.locator("#ars-stats [data-goexalte]").count() >= 1)
        pg.click("#ars-stats [data-goexalte]")
        pg.wait_for_timeout(700)
        ok("exaltée : son emplacement a 8 cases + aura/posture", pg.locator("#ars-mods .ars-case").count() >= 8)
        pg.click('.ars-case[data-i="0"] .ars-vide')
        pg.wait_for_timeout(600)
        pg.fill("#ars-coll-q", "pression")
        pg.wait_for_timeout(500)
        it_ex = pg.query_selector("#ars-coll [data-equipe]")
        if it_ex:
            it_ex.click()
            pg.wait_for_timeout(700)
            pg.click('[data-slot="frame"]')
            pg.wait_for_timeout(600)
            dmg_row = pg.evaluate("(()=>{const r=[...document.querySelectorAll('#ars-stats tr')].find(t=>/Dégâts . coup/.test(t.textContent));return r?r.textContent:''})()")
            ok("exaltée : le résumé sur la frame reflète ses mods (delta)", "(+" in dmg_row)

        # v45 : diagnostic Warframe + règles mêlée dédiées
        pg.click('[data-slot="frame"]')
        pg.wait_for_timeout(500)
        if not pg.locator("#ars-pk-q").is_visible():
            pg.click('[data-slot="frame"]')
            pg.wait_for_timeout(500)
        pg.fill("#ars-pk-q", "volt prime")
        pg.wait_for_timeout(500)
        pg.locator('#ars-picker .ars-pk-it[data-un]:not([data-un=""])').first.click()
        pg.wait_for_timeout(600)
        pg.click("#ars-removeall")
        pg.wait_for_timeout(400)
        fr_diag = pg.evaluate("(()=>{const d=[...document.querySelectorAll('#ars-stats .ars-diag summary')].find(s=>/Warframe/.test(s.textContent));return d?d.parentElement.textContent:''})()")
        ok("diagnostic Warframe : survie signalée sur frame nue", "survie" in fr_diag)
        pg.click('[data-slot="melee"]')
        pg.wait_for_timeout(500)
        pg.fill("#ars-pk-q", "nikana prime")
        pg.wait_for_timeout(500)
        it_m = pg.query_selector('#ars-picker .ars-pk-it[data-un]:not([data-un=""])')
        if it_m:
            it_m.click()
            pg.wait_for_timeout(700)
            st_m = pg.evaluate("document.querySelector('#ars-stats')?.textContent || ''")
            ok("diagnostic mêlée : Atteinte conseillée", "Atteinte" in st_m)
        # ---- v46 : deux familles de mods enfin LUES par le moteur ----------
        # 1) « +220% Critical Chance (x2 for Heavy Attacks) » : ce libellé (Acier
        #    Véritable / Véritable Prime / Sacrificiel / Galvanisé Prime) n'était
        #    pas reconnu à la cuisson → la chance critique de TOUS les builds
        #    mêlée restait à sa valeur de base. Nikana Prime : 28 % → 89.6 %.
        def choisir_slot(sid):
            """Sélectionne un emplacement sans rouvrir le sélecteur d'objet
            (cliquer l'emplacement DÉJÀ sélectionné ouvre la liste, comme en jeu)."""
            pg.keyboard.press("Escape")
            pg.wait_for_timeout(250)
            if pg.locator('[data-slot="%s"].sel' % sid).count() == 0:
                pg.click('[data-slot="%s"]' % sid)
                pg.wait_for_timeout(600)
            pg.keyboard.press("Escape")
            pg.wait_for_timeout(250)

        choisir_slot("melee")
        pg.click("#ars-removeall")
        pg.wait_for_timeout(400)
        st_m = pg.locator("#ars-stats").text_content() or ""
        ok("mêlée nue : chance critique 28 %", "28 %" in st_m, st_m[:120])
        pg.click('.ars-vide[data-i="0"]')
        pg.wait_for_timeout(500)
        pg.fill("#ars-coll-q", "acier veritable")
        pg.wait_for_timeout(500)
        pg.click('#ars-coll [data-equipe$="Melee/WeaponCritChanceMod"]')
        pg.wait_for_timeout(600)
        st_m = pg.locator("#ars-stats").text_content() or ""
        # v100 : « Acier Véritable Prime » (+220 %) était un mod fantôme des fichiers du
        # jeu, écarté du cuiseur. Le vrai Acier Véritable plafonne à +120 %.
        ok("v46 : Acier Véritable lu → crit 28 % × 2,2 → 61.6 %", "61.6 %" in st_m, st_m[:160])

        # 2) v47 : tableau « Efficacité par faction ». Les 43 mods de faction
        #    (Fléau/Châtie-/Expulse-/Purifie-) y rencontrent la vulnérabilité de
        #    type. Le jeu range les deux dans des boîtes SÉPARÉES → elles se
        #    MULTIPLIENT. Soma Prime nu contre Grineer : impact vulnérable
        #    (1.2 sur 12 de dégâts) → ×1.05 ; + Fléau des Grineers Accru Prime
        #    (×1.55) → ×1.63 au total (et non ×1.60, qui serait l'addition).
        choisir_slot("primaire")
        pg.click("#ars-removeall")
        pg.wait_for_timeout(500)

        def table_factions():
            # chiffres lus dans les attributs data- : la recette ne dépend pas de
            # la mise en page (le tableau a déjà changé de forme une fois).
            return pg.evaluate(
                "(()=>{const o={};document.querySelectorAll('#ars-stats tr.ars-fac-r')"
                ".forEach(r=>{o[r.dataset.fac]={vuln:+r.dataset.vuln,bane:+r.dataset.bane,"
                "tot:+r.dataset.tot,dmg:+r.dataset.dmg,"
                "best:r.classList.contains('best'),ref:r.classList.contains('ref')};});return o;})()")

        t0 = table_factions()
        ok("v47 : les 6 factions sont chiffrées", len(t0) == 6, str(sorted(t0)))
        ok("v47 : Soma Prime nu — Grineer ×1.05 (impact vulnérable, pondéré)",
           t0["grineer"]["vuln"] == 1.05 and t0["grineer"]["bane"] == 1
           and t0["grineer"]["tot"] == 1.05, str(t0["grineer"]))
        ok("v47 : Murmure ×1 (aucun type touché par ce build)",
           t0["murmure"]["tot"] == 1, str(t0["murmure"]))

        pg.click('.ars-vide[data-i="0"]')
        pg.wait_for_timeout(500)
        pg.fill("#ars-coll-q", "fleau des grineers")
        pg.wait_for_timeout(500)
        pg.click('#ars-coll [data-equipe$="Rifle/Expert/PrimedWeaponFactionDamageGrineer"]')
        pg.wait_for_timeout(700)
        t1 = table_factions()
        ok("v47 : le Fléau apparaît en colonne Mods (×1.55)",
           t1["grineer"]["bane"] == 1.55, str(t1["grineer"]))
        ok("v47 : vulnérabilité × mods (×1.05 × ×1.55 = ×1.63, PAS ×1.60)",
           t1["grineer"]["tot"] == 1.63, str(t1["grineer"]))
        ok("v47 : Grineer devient la meilleure faction du build",
           t1["grineer"]["best"] is True, str({k: v["tot"] for k, v in t1.items()}))
        ok("v47 : le Fléau des Grineers ne touche AUCUNE autre faction",
           all(v["bane"] == 1 for k, v in t1.items() if k != "grineer")
           and t1["corpus"]["tot"] == t0["corpus"]["tot"],
           str({k: v["bane"] for k, v in t1.items()}))
        # dégâts par coup vs faction = total de l'arme × multiplicateur de la ligne
        tot_arme = pg.evaluate(
            "(()=>{const r=[...document.querySelectorAll('#ars-stats tr')]"
            ".find(t=>/^Total/.test(t.textContent));const c=r.querySelectorAll('td');"
            "return parseFloat((c[1].textContent||'').split('(')[0].replace(/[^\\d.]/g,''));})()")
        attendu = round(tot_arme * 1.05 * 1.55, 1)
        ok("v47 : colonne dégâts / coup = total × multiplicateur de la faction",
           abs(t1["grineer"]["dmg"] - attendu) < 0.15,
           f"{t1['grineer']['dmg']} vs {attendu} (total arme {tot_arme})")
        # cliquer une ligne en fait la faction de référence du build auto
        pg.click('#ars-stats tr.ars-fac-r[data-fac="corpus"]')
        pg.wait_for_timeout(600)
        t2 = table_factions()
        ok("v47 : cliquer une ligne la marque comme faction de référence",
           t2["corpus"]["ref"] is True and t2["grineer"]["ref"] is False,
           str({k: v["ref"] for k, v in t2.items()}))

        # ---- v48 : POSTURES DE MÊLÉE -------------------------------------
        # Avant : le sélecteur proposait les 57 postures du jeu quelle que soit
        # l'arme (la classe de mêlée n'existe dans aucune source WFCD) et une
        # posture n'affichait rien. Maintenant : classe lue dans le module de
        # données du wiki, filtrage comme en jeu, et les COMBOS chiffrés.
        choisir_slot("melee")
        pg.click("#ars-removeall")
        pg.wait_for_timeout(500)
        st_txt = pg.locator("#ars-stats").text_content() or ""
        ok("v48 : sans posture, le diagnostic la réclame", "Aucune posture" in st_txt, st_txt[-260:])

        pg.click('.ars-vide[data-i="st"]')
        pg.wait_for_timeout(800)
        titre_coll = pg.locator(".ars-coll-tt").text_content() or ""
        n_post = pg.locator("#ars-coll [data-equipe]").count()
        ok("v48 : la classe de l'arme est affichée (Nikana)", "Nikana" in titre_coll, titre_coll[:90])
        ok("v48 : seules les 3 postures de Nikana sont proposées (57 avant)",
           n_post == 3, f"{n_post} postures")
        cartes = pg.evaluate(
            "[...document.querySelectorAll('#ars-coll [data-equipe]')]"
            ".map(e=>e.textContent.replace(/\\s+/g,' ').trim())")
        ok("v48 : chaque posture annonce son meilleur combo et son DPS",
           all("DPS" in c for c in cartes) and len(cartes) == 3, str(cartes))

        pg.fill("#ars-coll-q", "justice")
        pg.wait_for_timeout(500)
        pg.locator("#ars-coll [data-equipe]").first.click()
        pg.wait_for_timeout(900)
        combos = pg.evaluate(
            "(()=>[...document.querySelectorAll('#ars-stats .ars-post-r')].map(r=>{"
            "const c=r.querySelectorAll('td');return {"
            "t:c[0].textContent.replace(/\\s+/g,' ').trim(),"
            "d:c[1].textContent.replace(/\\s+/g,' ').trim(),"
            "best:r.classList.contains('best')};}))()")
        ok("v48 : le panneau liste les 6 combos de Justice Aveugle",
           len(combos) == 6, str(len(combos)))
        neutre = next((c for c in combos if c["t"].startswith("Neutre")), None)
        ok("v48 : combo Neutre = Guiding Light, 8 coups, 1900 %",
           neutre is not None and "Guiding Light" in neutre["t"]
           and "8 coups" in neutre["t"] and "1900 %" in neutre["t"],
           str(neutre))
        ok("v48 : procs FORCÉS du combo listés (Knockback / Bleed / Knockdown)",
           neutre is not None and "Knockback" in neutre["t"] and "Bleed" in neutre["t"],
           str(neutre))
        # DPS = dégâts totaux du combo / durée. Nikana Prime nue : 198 dégâts,
        # crit 28 % ×2,4 → coup moyen 275,6 ; 1900 % → 5237 ; / 2,6 s → 2014.
        ok("v48 : DPS du combo calculé sur les stats moddées (2014 = 5237 / 2,6 s)",
           neutre is not None and "2014" in neutre["d"] and "5237" in neutre["d"],
           str(neutre))
        ok("v48 : le meilleur combo est mis en avant",
           neutre is not None and neutre["best"] is True
           and sum(1 for c in combos if c["best"]) == 1, str([c["best"] for c in combos]))
        mur = next((c for c in combos if c["t"].startswith("Mur")), None)
        ok("v48 : un combo sans durée publiée n'invente pas de DPS",
           mur is not None and "durée non publiée" in mur["d"], str(mur))

        # une arme d'une AUTRE classe propose d'autres postures (aucun recouvrement)
        choisir_slot("melee")
        pg.click('[data-slot="melee"]')
        pg.wait_for_timeout(600)
        pg.fill("#ars-pk-q", "orthos prime")
        pg.wait_for_timeout(500)
        pg.locator('#ars-picker .ars-pk-it[data-un]:not([data-un=""])').first.click()
        pg.wait_for_timeout(900)
        pg.click('.ars-vide[data-i="st"]')
        pg.wait_for_timeout(800)
        titre2 = pg.locator(".ars-coll-tt").text_content() or ""
        noms2 = pg.evaluate(
            "[...document.querySelectorAll('#ars-coll [data-equipe] .ars-mod-n')]"
            ".map(e=>e.textContent.split(' ').slice(0,2).join(' '))")
        ok("v48 : Orthos Prime = classe Polearm, ses propres postures",
           "Polearm" in titre2 and len(noms2) == 3 and not any("Justice" in n for n in noms2),
           titre2[:80] + " → " + str(noms2))

        # ---- v49 : les AURAS --------------------------------------------
        # Les 36 auras du jeu valaient ZÉRO : leur texte est rédigé côté
        # escouade (« Squad receives +60% Melee Damage ») et aucun motif du
        # parseur ne le lisait. Ce sont des bonus PERMANENTS, pas conditionnels.
        pg.click('[data-slot="frame"]')
        pg.wait_for_timeout(600)
        if not pg.locator("#ars-pk-q").is_visible():
            pg.click('[data-slot="frame"]')
            pg.wait_for_timeout(600)
        pg.fill("#ars-pk-q", "chroma prime")
        pg.wait_for_timeout(500)
        pg.locator('#ars-picker .ars-pk-it[data-un]:not([data-un=""])').first.click()
        pg.wait_for_timeout(800)
        pg.click("#ars-removeall")
        pg.wait_for_timeout(500)
        st_f = pg.locator("#ars-stats").text_content() or ""
        ok("v49 : Chroma Prime nue — 370 PV", "370" in st_f, st_f[:110])
        pg.click('.ars-vide[data-i="aura"]')
        pg.wait_for_timeout(700)
        pg.fill("#ars-coll-q", "physique")
        pg.wait_for_timeout(500)
        pg.click('#ars-coll [data-equipe$="Aura/PlayerHealthAuraMod"]')
        pg.wait_for_timeout(700)
        st_f = pg.locator("#ars-stats").text_content() or ""
        ok("v49 : Physique (+20 % santé) enfin lue — 370 → 444 PV",
           "444" in st_f, st_f[:200])

        # Charge d'Acier : l'aura est sur la FRAME, son +60 % s'applique à
        # l'ARME de mêlée, additif avec les mods de dégâts de base.
        pg.click('.ars-case[data-i="aura"] .ars-mod-corps, .ars-vide[data-i="aura"]')
        pg.wait_for_timeout(700)
        pg.fill("#ars-coll-q", "charge d'acier")
        pg.wait_for_timeout(500)
        pg.click('#ars-coll [data-equipe$="Aura/PlayerMeleeAuraMod"]')
        pg.wait_for_timeout(700)

        pg.click('[data-slot="melee"]')
        pg.wait_for_timeout(600)
        if not pg.locator("#ars-pk-q").is_visible():
            pg.click('[data-slot="melee"]')
            pg.wait_for_timeout(600)
        pg.fill("#ars-pk-q", "nikana prime")
        pg.wait_for_timeout(500)
        pg.locator('#ars-picker .ars-pk-it[data-un]:not([data-un=""])').first.click()
        pg.wait_for_timeout(800)
        pg.click("#ars-removeall")
        pg.wait_for_timeout(600)
        st_m = pg.locator("#ars-stats").text_content() or ""
        ok("v49 : Charge d'Acier (+60 %) portée par la frame — 198 → 316.7",
           "316.7" in st_m, st_m[:220])
        ok("v49 : la provenance du bonus est annoncée (aura de la frame)",
           pg.locator(".ars-aura-note").count() == 1
           and "Charge d'Acier" in (pg.locator(".ars-aura-note").text_content() or ""),
           (pg.locator(".ars-aura-note").text_content() or "")[:120])

        # ... et une aura d'une AUTRE catégorie ne touche pas la mêlée
        pg.click('[data-slot="frame"]')
        pg.wait_for_timeout(600)
        pg.click('.ars-case[data-i="aura"] .ars-mod-corps, .ars-vide[data-i="aura"]')
        pg.wait_for_timeout(700)
        pg.fill("#ars-coll-q", "fusil amplifie")
        pg.wait_for_timeout(500)
        pg.click('#ars-coll [data-equipe$="Aura/PlayerRifleDamageAuraMod"]')
        pg.wait_for_timeout(700)
        pg.click('[data-slot="melee"]')
        pg.wait_for_timeout(700)
        st_m = pg.locator("#ars-stats").text_content() or ""
        ok("v49 : Fusil Amplifié ne touche PAS la mêlée (198 de nouveau)",
           "198" in st_m and "316.7" not in st_m, st_m[:200])

        # ---- v55 : COACTION DRIFT et ACIER PRÉPARÉ -----------------------
        # Deux trous de la même famille que v49 : la valeur était dans le
        # texte, c'est le libellé qui n'était lu par personne.
        #
        # Coaction Drift porte DEUX moitiés qui ne disent pas la même chose
        # (wiki) : « Aura Strength » augmente l'effet de TON aura sur tout le
        # monde, « Aura Effectiveness » l'effet des auras des AUTRES sur toi.
        # Pour le porteur elles se MULTIPLIENT — (1 + 15 %)² = ×1,3225, pas
        # ×1,30. C'est le piège que cette vérification garde fermé.
        choisir_slot("frame")
        pg.click("#ars-removeall")
        pg.wait_for_timeout(600)
        pg.click('.ars-vide[data-i="aura"]')
        pg.wait_for_timeout(700)
        pg.fill("#ars-coll-q", "charge d'acier")
        pg.wait_for_timeout(500)
        pg.click('#ars-coll [data-equipe$="Aura/PlayerMeleeAuraMod"]')
        pg.wait_for_timeout(700)
        pg.click('[data-slot="melee"]')
        pg.wait_for_timeout(700)
        st_m = pg.locator("#ars-stats").text_content() or ""
        ok("v55 : repère — Charge d'Acier seule, toujours 316.7",
           "316.7" in st_m, st_m[:200])

        choisir_slot("frame")
        pg.click('.ars-vide[data-i="0"]')
        pg.wait_for_timeout(600)
        pg.fill("#ars-coll-q", "coaction")
        pg.wait_for_timeout(500)
        pg.click('#ars-coll [data-equipe$="OrokinChallenge/OrokinChallengeModCollaboration"]')
        pg.wait_for_timeout(700)
        pg.click('[data-slot="melee"]')
        pg.wait_for_timeout(700)
        st_m = pg.locator("#ars-stats").text_content() or ""
        # 198 × (1 + 0,6 × 1,3225) = 355.2 (somme des types arrondis).
        # L'addition (×1,30) donnerait 0,78 et un total de 352.4 : c'est cette
        # valeur-là que la vérification suivante interdit.
        ok("v55 : Coaction Drift met l'aura à l'échelle — 316.7 → 355.2",
           "355.2" in st_m, st_m[:220])
        ok("v55 : ×1,3225 et non ×1,30 (les deux moitiés se multiplient)",
           "352.4" not in st_m, st_m[:220])
        note = pg.locator(".ars-aura-note").text_content() or ""
        ok("v55 : la note annonce la mise à l'échelle et le mod responsable",
           "1.3225" in note and "Coaction" in note, note[:200])
        ok("v55 : la note affiche le bonus RÉELLEMENT appliqué (79.3 %, pas 60)",
           "79.3" in note and "+60" not in note, note[:200])

        # Acier Préparé : une AURA qui donne du combo initial. La valeur vit
        # sur la frame et doit franchir le même pont que Charge d'Acier —
        # sans lui le mod serait lu mais resterait sans effet.
        choisir_slot("frame")
        pg.click("#ars-removeall")
        pg.wait_for_timeout(600)
        pg.click('[data-slot="melee"]')
        pg.wait_for_timeout(700)
        st_m = pg.locator("#ars-stats").text_content() or ""
        ok("v55 : sans aura, aucun combo initial annoncé",
           pg.locator(".ars-aura-combo").count() == 0, st_m[:140])

        choisir_slot("frame")
        pg.click('.ars-vide[data-i="aura"]')
        pg.wait_for_timeout(700)
        pg.fill("#ars-coll-q", "acier prepare")
        pg.wait_for_timeout(500)
        pg.click('#ars-coll [data-equipe$="Aura/PlayerMeleeStartingComboAuraMod"]')
        pg.wait_for_timeout(700)
        pg.click('[data-slot="melee"]')
        pg.wait_for_timeout(700)
        st_m = pg.locator("#ars-stats").text_content() or ""
        ok("v55 : Acier Préparé — +24 de combo initial atteint bien l'arme",
           "24" in st_m and pg.locator(".ars-aura-combo").count() == 1, st_m[:220])
        ok("v55 : la provenance du combo initial est annoncée",
           "aura de la frame" in (pg.locator(".ars-aura-combo").text_content() or ""),
           (pg.locator(".ars-aura-combo").text_content() or "")[:140])
        choisir_slot("frame")
        pg.click("#ars-removeall")
        pg.wait_for_timeout(600)

        # ---- v56 : les auras, troisième passe ----------------------------
        # Deux auras dont les clefs existaient DÉJÀ (v51 durée de combo, v52
        # temps de charge, v54 stats du compagnon) : seul le pont manquait.
        # Leurs textes portent DEUX valeurs dans la même phrase, d'où le
        # support des clefs multiples ajouté au parseur.
        #
        # Piège de nommage : « Élan Rapide » désigne AUSSI une mêlée
        # (Quickening). Les deux mods sont distincts — sélection par uniqueName.
        choisir_slot("frame")
        pg.click("#ars-removeall")
        pg.wait_for_timeout(600)
        pg.click('[data-slot="melee"]')
        pg.wait_for_timeout(700)
        st_m = pg.locator("#ars-stats").text_content() or ""
        # « 5 » tout court se trouve partout dans le panneau : le repère utile
        # est l'ABSENCE des valeurs d'après, pas la présence d'un chiffre.
        ok("v56 : repère — Nikana Prime nue, ni 0.38 s de charge ni 11 s de combo",
           "0.5" in st_m and "0.38" not in st_m, st_m[:200])

        choisir_slot("frame")
        pg.click('.ars-vide[data-i="aura"]')
        pg.wait_for_timeout(700)
        pg.fill("#ars-coll-q", "elan rapide")
        pg.wait_for_timeout(500)
        pg.click('#ars-coll [data-equipe$="Aura/WarframeAuraWickedStrikesMod"]')
        pg.wait_for_timeout(700)
        pg.click('[data-slot="melee"]')
        pg.wait_for_timeout(700)
        st_m = pg.locator("#ars-stats").text_content() or ""
        # 0,5 / (1 + 0,30) = 0.38 s — la vitesse de charge DIVISE le temps
        ok("v56 : Élan Rapide (aura) — charge 0.5 → 0.38 s",
           "0.38" in st_m, st_m[:260])
        # 5 + 6 = 11 s — la durée de combo est une valeur PLATE, en secondes
        ok("v56 : Élan Rapide (aura) — durée de combo 5 → 11 s",
           "11" in st_m, st_m[:260])

        # Dresseur : PV et armure PLATS au compagnon, ajoutés APRÈS le
        # pourcentage des mods du compagnon, jamais multipliés par lui.
        choisir_slot("frame")
        pg.click("#ars-removeall")
        pg.wait_for_timeout(600)
        pg.click('[data-slot="compagnon"]')
        pg.wait_for_timeout(600)
        if not pg.locator("#ars-pk-q").is_visible():
            pg.click('[data-slot="compagnon"]')
            pg.wait_for_timeout(600)
        pg.fill("#ars-pk-q", "chesa")
        pg.wait_for_timeout(500)
        pg.locator('#ars-picker .ars-pk-it[data-un]:not([data-un=""])').first.click()
        pg.wait_for_timeout(800)
        pg.click("#ars-removeall")
        pg.wait_for_timeout(600)
        st_c = pg.locator("#ars-stats").text_content() or ""
        ok("v56 : repère — Chesa Kubrow nu, 940 PV et 300 d'armure",
           "940" in st_c and "300" in st_c, st_c[:200])
        ok("v56 : sans aura, aucune provenance annoncée côté compagnon",
           pg.locator(".ars-aura-pet").count() == 0)

        choisir_slot("frame")
        pg.click('.ars-vide[data-i="aura"]')
        pg.wait_for_timeout(700)
        pg.fill("#ars-coll-q", "dresseur")
        pg.wait_for_timeout(500)
        pg.click('#ars-coll [data-equipe$="Aura/WarframeAuraLoyalHerdMod"]')
        pg.wait_for_timeout(700)
        pg.click('[data-slot="compagnon"]')
        pg.wait_for_timeout(700)
        st_c = pg.locator("#ars-stats").text_content() or ""
        ok("v56 : Dresseur — 940 + 300 = 1240 PV",
           "1240" in st_c, st_c[:220])
        ok("v56 : Dresseur — 300 + 180 = 480 d'armure",
           "480" in st_c, st_c[:220])
        ok("v56 : la provenance est annoncée, et les valeurs dites PLATES",
           pg.locator(".ars-aura-pet").count() == 1
           and "plates" in (pg.locator(".ars-aura-pet").text_content() or ""),
           (pg.locator(".ars-aura-pet").text_content() or "")[:160])
        choisir_slot("frame")
        pg.click("#ars-removeall")
        pg.wait_for_timeout(600)

        # ---- v57 : RÉSISTANCES par type de dégât --------------------------
        # Wiki (Flame Repellent) : « Damage resistance bonus is MULTIPLICATIVE
        # with other sources of damage resistance such as Adaptation. » Elles
        # ne s'additionnent donc NI entre elles NI avec Adaptation — c'est
        # exactement ce que les vérifications ci-dessous interdisent.
        choisir_slot("frame")
        pg.click("#ars-removeall")
        pg.wait_for_timeout(600)
        st_r = pg.locator("#ars-stats").text_content() or ""
        ok("v57 : sans mod de résistance, aucun tableau de résistances",
           pg.locator(".ars-res").count() == 0 and "925" in st_r, st_r[:140])

        pg.click('.ars-vide[data-i="0"]')
        pg.wait_for_timeout(600)
        pg.fill("#ars-coll-q", "antitoxine")
        pg.wait_for_timeout(500)
        pg.click('#ars-coll [data-equipe$="Warframe/AvatarDamageResistancePoison"]')
        pg.wait_for_timeout(700)
        st_r = pg.locator(".ars-res").text_content() or ""
        # 925 / (1 − 0,45) = 1682
        ok("v57 : Antitoxine 45 % — 925 → 1682 PV effectifs contre la toxine",
           "45 %" in st_r and "1682" in st_r, st_r[:200])

        # Une SECONDE source de toxine : l'aura. 1 − 0,55 × 0,85 = 53,25 %,
        # donc 925 / 0,4675 = 1979. L'addition (60 %) donnerait 2313.
        pg.click('.ars-vide[data-i="aura"]')
        pg.wait_for_timeout(700)
        pg.fill("#ars-coll-q", "resistance aux toxines")
        pg.wait_for_timeout(500)
        pg.click('#ars-coll [data-equipe$="Aura/PlayerPoisonImmunityAuraMod"]')
        pg.wait_for_timeout(700)
        st_r = pg.locator(".ars-res").text_content() or ""
        ok("v57 : deux sources — 45 % et 15 % donnent 53 %, pas 60 %",
           "53 %" in st_r and "60 %" not in st_r, st_r[:200])
        ok("v57 : 925 / (1 − 0,5325) = 1979 (l'addition donnerait 2313)",
           "1979" in st_r and "2313" not in st_r, st_r[:200])
        ok("v57 : la règle multiplicative est écrite sous le tableau",
           "MULTIPLIENT" in (pg.locator(".ars-res-note").text_content() or ""),
           (pg.locator(".ars-res-note").text_content() or "")[:150])

        # 100 % de résistance existe vraiment (Ignifugé Prime) : le simulateur
        # doit le dire avec un mot, pas avec un très grand nombre.
        choisir_slot("frame")
        pg.click("#ars-removeall")
        pg.wait_for_timeout(600)
        pg.click('.ars-vide[data-i="0"]')
        pg.wait_for_timeout(600)
        pg.fill("#ars-coll-q", "ignifuge")
        pg.wait_for_timeout(500)
        # v100 : « Ignifugé Prime » (100 %) était un mod fantôme, écarté. Aucun vrai mod
        # n'atteint 100 % de résistance : on vérifie l'Ignifugé réel (+60 %).
        pg.click('#ars-coll [data-equipe$="Warframe/AvatarDamageResistanceFire"]')
        pg.wait_for_timeout(700)
        st_r = pg.locator(".ars-res").text_content() or ""
        ok("v57 : Ignifugé 60 % — affiché tel quel, pas « immunisé »",
           "60 %" in st_r and "immunis" not in st_r, st_r[:200])
        choisir_slot("frame")
        pg.click("#ars-removeall")
        pg.wait_for_timeout(600)

        # ---- v58 : MUNITIONS DU CHASSEUR et le saignement -----------------
        # Wiki (Damage/Slash_Damage) :
        #   tick = 0,35 × dégâts de base MODDÉS × ... × mult. critique
        #   dégâts de base moddés = base × (1 + mods de DÉGÂTS)
        # Le piège est là : « their damage only depends on the weapons modded
        # base Damage and is therefore NOT affected by elemental and physical
        # damage mods ». Les deux dernières vérifications gardent ce piège
        # fermé — un mod élémentaire ne doit RIEN changer au saignement.
        pg.click('[data-slot="primaire"]')
        pg.wait_for_timeout(600)
        if not pg.locator("#ars-pk-q").is_visible():
            pg.click('[data-slot="primaire"]')
            pg.wait_for_timeout(600)
        pg.fill("#ars-pk-q", "soma prime")
        pg.wait_for_timeout(500)
        pg.locator('#ars-picker .ars-pk-it[data-un]:not([data-un=""])').first.click()
        pg.wait_for_timeout(800)
        pg.click("#ars-removeall")
        pg.wait_for_timeout(600)
        st_h = pg.locator("#ars-stats").text_content() or ""
        ok("v58 : sans le mod, aucune ligne de saignement",
           pg.locator(".ars-saign").count() == 0 and "Saignement" not in st_h, st_h[:140])

        pg.click('.ars-vide[data-i="0"]')
        pg.wait_for_timeout(600)
        pg.fill("#ars-coll-q", "munitions du chasseur")
        pg.wait_for_timeout(500)
        pg.click('#ars-coll [data-equipe$="Sets/Hunter/PrimaryHunterMunitionsMod"]')
        pg.wait_for_timeout(800)
        st_h = pg.locator("#ars-stats").text_content() or ""
        note = pg.locator(".ars-saign").text_content() or ""
        # tick = 0,35 × 12 × ×3 = 12.6 ; procs/s = 200/(200/15+3) × 0,30 × 0,30
        #      = 1.1 ; DPS = 1.1 × 12.6 × 6 ticks = 83
        ok("v58 : tick = 0,35 × 12 de base × ×3 critique = 12.6",
           "12.6 par tick" in note, note[:160])
        ok("v58 : 1.1 proc/s (cadence réelle × 30 % crit × 30 % du mod)",
           "1.1 proc/s" in note, note[:160])
        def ligne_saign():
            """La ligne du tableau, et non tout le panneau : « 220 » se trouve
            ailleurs dans la page et rendrait la vérification creuse."""
            for r in pg.locator("#ars-stats table tr").all_text_contents():
                if "Saignement" in r:
                    return " ".join(r.split())
            return ""
        ok("v58 : DPS de saignement 83 = 1.1 × 12.6 × 6 ticks",
           ligne_saign().endswith("83"), ligne_saign())
        ok("v58 : la règle qui fait tout l'intérêt du mod est dite (hors armure)",
           "IGNORENT L'ARMURE" in note and "hors armure" in ligne_saign(), note[:200])

        # Un mod de DÉGÂTS DE BASE compte : Dentelure +165 % → 12 × 2,65 = 31,8
        # → tick 0,35 × 31,8 × 3 = 33.4, et le DPS suit (1.1 × 33.4 × 6 = 220).
        pg.click('.ars-vide[data-i="1"]')
        pg.wait_for_timeout(600)
        pg.fill("#ars-coll-q", "dentelure")
        pg.wait_for_timeout(500)
        pg.click('#ars-coll [data-equipe$="Rifle/WeaponDamageAmountMod"]')
        pg.wait_for_timeout(800)
        note = pg.locator(".ars-saign").text_content() or ""
        ok("v58 : Dentelure (dégâts de base) compte — tick 12.6 → 33.4",
           "33.4 par tick" in note, note[:160])
        # 1,10204 proc/s × 33,39 × 6 ticks = 220,8 -> 221
        ok("v58 : le DPS de saignement suit — 83 → 221",
           ligne_saign().endswith("221"), ligne_saign())

        # ... et un mod ÉLÉMENTAIRE ne doit RIEN y changer. C'est le piège.
        pg.click('.ars-vide[data-i="2"]')
        pg.wait_for_timeout(600)
        pg.fill("#ars-coll-q", "feu des enfers")
        pg.wait_for_timeout(500)
        pg.click('#ars-coll [data-equipe$="Rifle/WeaponFireDamageMod"]')
        pg.wait_for_timeout(800)
        note2 = pg.locator(".ars-saign").text_content() or ""
        st_h2 = pg.locator("#ars-stats").text_content() or ""
        ok("v58 : Feu des Enfers augmente bien les dégâts par coup",
           "Chaleur" in st_h2 or "Heat" in st_h2, st_h2[:200])
        ok("v58 : mais le saignement est INCHANGÉ — tick toujours 33.4",
           "33.4 par tick" in note2, note2[:160])
        ok("v58 : et son DPS aussi — toujours 221",
           ligne_saign().endswith("221"), ligne_saign())
        pg.click("#ars-removeall")
        pg.wait_for_timeout(600)

        # ---- v59 : FICHE DU BUILD (titre, auteur, notes) ------------------
        # Elle voyage dans le lien, sans compte ni serveur. Deux pièges, et les
        # deux ont mordu en l'écrivant :
        #   • rendFiche() était câblé AVANT restaure() (appelée tout en bas) :
        #     une fiche arrivée par un lien n'apparaissait jamais ;
        #   • l'assainissement était placé DANS restaure(), qui sort par un
        #     `return` dès qu'un lien est reconnu — donc il sautait sur le seul
        #     chemin qui en a besoin.
        choisir_slot("frame")
        ok("v59 : sans fiche, le bloc de lecture est masqué",
           pg.locator("#ars-fiche-vue").is_hidden())
        pg.click("#ars-fiche-btn")
        pg.wait_for_timeout(400)
        pg.fill("#ars-fiche-t", "Soma Prime — saignement")
        pg.fill("#ars-fiche-a", "Tenno")
        pg.fill("#ars-fiche-d", "Munitions du Chasseur contre les Grineer.")
        pg.wait_for_timeout(500)
        vue = pg.locator("#ars-fiche-vue").text_content() or ""
        ok("v59 : la fiche s'affiche (titre, auteur, notes)",
           "Soma Prime — saignement" in vue and "Tenno" in vue and "Grineer" in vue, vue[:120])

        lien = pg.url
        ok("v59 : la fiche part dans le lien de partage",
           "#z=" in lien or "#b=" in lien, lien[:80])
        # Sortir du document : changer seulement le hash ne recharge PAS la page.
        pg.goto("about:blank")
        pg.goto(lien)
        pg.wait_for_timeout(2200)
        vue = pg.locator("#ars-fiche-vue").text_content() or ""
        ok("v59 : elle revient à l'ouverture du lien",
           "Soma Prime — saignement" in vue and "Tenno" in vue, vue[:120])

        # LIEN FABRIQUÉ : ces trois champs viennent d'une URL que n'importe qui
        # peut écrire. Rien ne doit s'exécuter, et les longueurs sont bornées.
        alertes = []

        def note_alerte(d):
            alertes.append(d.message)
            d.dismiss()

        pg.on("dialog", note_alerte)
        chargeUtile = json.dumps({
            "reacteur": True, "sel": "frame", "equip": {},
            "fiche": {"t": "<img src=x onerror=alert(1)>TITRE",
                      "a": "<script>alert(2)</script>AUTEUR",
                      "d": "y" * 900 + "FIN"},
        })
        b64 = base64.b64encode(chargeUtile.encode("utf-8")).decode()
        pg.goto("about:blank")
        pg.goto(f"{BASE}/arsenal.html#b={b64}")
        pg.wait_for_timeout(2500)
        vue_loc = pg.locator("#ars-fiche-vue")
        ok("v59 : lien fabriqué — AUCUNE balise n'est créée dans la vue",
           vue_loc.locator("img, script, b, iframe").count() == 0)
        ok("v59 : lien fabriqué — le balisage est rendu comme du TEXTE",
           "<img src=x onerror=alert(1)>TITRE" in (vue_loc.text_content() or ""),
           (vue_loc.text_content() or "")[:90])
        ok("v59 : lien fabriqué — les notes sont bornées à 600 caractères",
           len(pg.locator(".ars-fiche-d").text_content() or "") == 600,
           str(len(pg.locator(".ars-fiche-d").text_content() or "")))
        ok("v59 : lien fabriqué — aucune alerte déclenchée", not alertes, str(alertes))
        # À retirer, sinon il annule AUSSI les invites des blocs suivants
        # (l'enregistrement d'un build en demande une) — deux gestionnaires
        # écoutent le même événement et le premier qui agit gagne.
        pg.remove_listener("dialog", note_alerte)

        # ---- v60 : COMPARATEUR À N COLONNES -------------------------------
        # L'ancien mettait l'actuel face à UN build enregistré, sur neuf
        # chiffres — il ignorait critique, statut, attaque lourde, saignement.
        # Et comparer deux à deux quand on a cinq builds ne répond pas à la
        # question qu'on se pose : « lequel ? ».
        # Le bloc v59 laisse VOLONTAIREMENT la page sur un lien hostile (état
        # vide, hash fabriqué). On repart d'une page propre, sinon le sélecteur
        # ne s'ouvre pas et l'échec ne dit rien du comparateur.
        pg.goto("about:blank")
        pg.goto(BASE + "/arsenal", wait_until="domcontentloaded", timeout=30000)
        pg.wait_for_timeout(2500)
        noms_enregistres = []

        def repond(d):
            noms_enregistres.append(f"cmp{len(noms_enregistres)}")
            d.accept(noms_enregistres[-1])

        pg.on("dialog", repond)

        def equipe_primaire(nom):
            """choisir_slot() FERME le sélecteur (il sert à changer d'onglet).
            Pour l'ouvrir il faut cliquer l'emplacement DÉJÀ sélectionné —
            même motif que les autres blocs."""
            pg.click('[data-slot="primaire"]')
            pg.wait_for_timeout(600)
            if not pg.locator("#ars-pk-q").is_visible():
                pg.click('[data-slot="primaire"]')
                pg.wait_for_timeout(600)
            pg.fill("#ars-pk-q", nom)
            pg.wait_for_timeout(500)
            pg.locator('#ars-picker .ars-pk-it[data-un]:not([data-un=""])').first.click()
            pg.wait_for_timeout(800)

        equipe_primaire("soma prime")
        pg.click("#ars-save")
        pg.wait_for_timeout(800)
        equipe_primaire("ignis wraith")
        pg.click("#ars-save")
        pg.wait_for_timeout(800)

        pg.click("#ars-compare")
        pg.wait_for_timeout(1200)
        tbl = pg.locator(".ars-cmp")
        # 4 en-têtes = la colonne des libellés + Actuel + les deux enregistrés.
        ok("v60 : le comparateur affiche l'actuel ET les builds enregistrés",
           tbl.count() == 1 and tbl.locator("tr").first.locator("th").count() == 4,
           str(tbl.locator("tr").first.locator("th").count()))
        lignes = [" ".join(r.split()) for r in tbl.locator("tr").all_text_contents()]
        joint = " | ".join(lignes)
        ok("v60 : les stats ajoutées depuis v53 y sont (critique, statut)",
           "Chance critique" in joint and "Multi. critique" in joint and "Chance de statut" in joint,
           joint[:160])
        ok("v60 : les armes sont comparées par EMPLACEMENT (deux noms côte à côte)",
           any("⟷" in l for l in lignes), joint[:160])
        ok("v60 : la meilleure valeur de chaque ligne est mise en avant",
           tbl.locator(".ars-cmp-v.ok").count() >= 3,
           str(tbl.locator(".ars-cmp-v.ok").count()))
        ok("v60 : le tableau défile dans son cadre — la PAGE ne déborde pas",
           not pg.evaluate("document.documentElement.scrollWidth > document.documentElement.clientWidth + 1"))
        pg.keyboard.press("Escape")
        pg.wait_for_timeout(500)
        pg.remove_listener("dialog", repond)

        # ---- v61 : CLASSEMENT DES ARMES -----------------------------------
        # Les armes d'une catégorie, toutes montées par le MÊME algorithme avec
        # le MÊME objectif : c'est ce qui rend la comparaison honnête.
        pg.click("#ars-classement")
        pg.wait_for_selector(".ars-cls", timeout=60000)
        lignes = [" ".join(r.split()) for r in pg.locator(".ars-cls tr").all_text_contents()]
        ok("v61 : le classement s'ouvre avec un tableau rempli",
           len(lignes) > 10, str(len(lignes)))
        # Le texte d'une LIGNE colle les colonnes (« 1SiroccoPistol012500… ») :
        # il faut lire la dernière CELLULE, pas deviner dans la chaîne.
        def dps_soutenu(i):
            c = pg.locator(".ars-cls tr").nth(i).locator("td")
            return float((c.nth(c.count() - 1).text_content() or "0").strip() or 0)

        dps = [dps_soutenu(i) for i in range(1, 11)]
        ok("v61 : il est trié par DPS soutenu décroissant",
           _decroissant(dps), str(dps[:5]))
        note = pg.locator(".ars-cls-note").text_content() or ""
        ok("v61 : les DEUX limites sont écrites sous le tableau",
           "heuristique" in note and "montée en cadence" in note, note[:150])
        ok("v61 : l'anomalie du Sirocco est assumée, pas filtrée en douce",
           "Sirocco" in note and "Rien n'est filtré" in note, note[-200:])
        ok("v61 : la colonne Type est là (elle explique l'anomalie)",
           "Pistol" in " ".join(lignes[1:6]), " | ".join(lignes[1:3]))

        # Changer de catégorie recalcule tout
        pg.click('[data-cls-cat="Melee"]')
        pg.wait_for_timeout(2000)
        lignes_m = [" ".join(r.split()) for r in pg.locator(".ars-cls tr").all_text_contents()]
        ok("v61 : changer de catégorie recalcule le classement",
           len(lignes_m) > 10 and lignes_m[1] != lignes[1], lignes_m[1][:70])
        ok("v61 : et la mêlée ne contient que des armes de mêlée",
           all("Melee" in l for l in lignes_m[1:6]), " | ".join(lignes_m[1:3]))

        # Cliquer une arme l'équipe
        pg.click(".ars-cls-n")
        pg.wait_for_timeout(1200)
        ok("v61 : cliquer une arme du classement l'équipe",
           pg.locator("#ars-picker").is_hidden()
           and "Melee" in (pg.locator("#ars-stats").text_content() or ""),
           (pg.locator("#ars-stats").text_content() or "")[:80])
        ok("v61 : la page ne déborde pas (le tableau défile dans son cadre)",
           not pg.evaluate("document.documentElement.scrollWidth > document.documentElement.clientWidth + 1"))

        # ---- v62 : BIBLIOTHÈQUE PUBLIQUE — ce qu'on peut VRAIMENT vérifier
        # L'API a besoin d'une liaison D1 que seul le tableau de bord Cloudflare
        # peut créer : elle n'existe ni ici ni en CI. Ce qui se vérifie, et qui
        # est le comportement le plus important tant que la base n'est pas
        # branchée : l'interface ANNONCE l'absence au lieu de casser.
        # (La validation de l'API, elle, est du JavaScript pur et a son propre
        # garde-fou : node scripts/verifier_api_builds.mjs.)
        pg.click('[data-slot="primaire"]')
        pg.wait_for_timeout(600)
        if not pg.locator("#ars-pk-q").is_visible():
            pg.click('[data-slot="primaire"]')
            pg.wait_for_timeout(600)
        pg.fill("#ars-pk-q", "soma prime")
        pg.wait_for_timeout(500)
        pg.locator('#ars-picker .ars-pk-it[data-un]:not([data-un=""])').first.click()
        pg.wait_for_timeout(800)
        pg.click("#ars-biblio-btn")
        pg.wait_for_timeout(1500)
        absent = pg.locator(".ars-biblio-absente").text_content() or ""
        ok("v62 : l'absence de bibliothèque est ANNONCÉE, pas subie",
           "pas encore branchée" in absent, absent[:120])
        ok("v62 : le statut HTTP réel est donné (404 ici, pas « réseau »)",
           "404" in absent, absent[:140])
        ok("v62 : et le repli est rappelé — le lien marche toujours",
           "partageable par lien" in absent, absent[-90:])
        ok("v62 : le bouton d'envoi est masqué tant que l'API est absente",
           pg.locator("#ars-biblio-go").count() == 0
           and pg.locator(".ars-biblio-pub").count() == 1)
        pg.keyboard.press("Escape")
        pg.wait_for_timeout(400)

        # ---- v63 : DURÉE DE STATUT -----------------------------------------
        # v58 disait dans l'interface « non modélisé : les mods de durée de
        # statut ». Ils le sont maintenant, et le wiki donne le cas d'école :
        # « Using Hunter Track in tandem with Hunter Munitions will increase the
        # base 6-second duration to 11.4 seconds, allowing for 11 ticks of
        # damage rather than the normal 6. »
        pg.click('[data-slot="primaire"]')
        pg.wait_for_timeout(600)
        if not pg.locator("#ars-pk-q").is_visible():
            pg.click('[data-slot="primaire"]')
            pg.wait_for_timeout(600)
        pg.fill("#ars-pk-q", "soma prime")
        pg.wait_for_timeout(500)
        pg.locator('#ars-picker .ars-pk-it[data-un]:not([data-un=""])').first.click()
        pg.wait_for_timeout(800)
        pg.click("#ars-removeall")
        pg.wait_for_timeout(600)
        pg.click('.ars-vide[data-i="0"]')
        pg.wait_for_timeout(600)
        pg.fill("#ars-coll-q", "munitions du chasseur")
        pg.wait_for_timeout(500)
        pg.click('#ars-coll [data-equipe$="Sets/Hunter/PrimaryHunterMunitionsMod"]')
        pg.wait_for_timeout(800)
        note = pg.locator(".ars-saign").text_content() or ""
        ok("v63 : sans mod de durée, 6 ticks et aucune ligne « Durée de statut »",
           "6 ticks" in note and "Durée de statut" not in (pg.locator("#ars-stats").text_content() or ""),
           note[:120])

        pg.click('.ars-vide[data-i="1"]')
        pg.wait_for_timeout(600)
        pg.fill("#ars-coll-q", "pistage du chasseur")
        pg.wait_for_timeout(500)
        pg.click('#ars-coll [data-equipe$="Sets/Hunter/PrimaryHunterTrackMod"]')
        pg.wait_for_timeout(800)
        note = pg.locator(".ars-saign").text_content() or ""
        st_d = pg.locator("#ars-stats").text_content() or ""
        # 6 x 1,9 = 11,4 s -> 11 ticks (PAS 12 : un tick par seconde, les 0,4 s
        # restantes n'en portent aucun). C'est le cas d'école du wiki.
        ok("v63 : Pistage du Chasseur (+90 %) — 11 ticks, pas 12",
           "11 ticks" in note and "12 ticks" not in note, note[:150])
        ok("v63 : la durée annoncée est bien 11.4 s", "11.4 s" in note, note[:150])
        ok("v63 : la durée de statut apparaît dans le tableau (190 %)",
           "190" in st_d, st_d[:200])
        # 83 x 11/6 = 152.7 -> 153
        ok("v63 : le saignement suit — 83 → 153",
           (ligne_saign() or "").endswith("153"), ligne_saign())
        ok("v63 : la note explique d'où viennent les ticks supplémentaires",
           "allonge les 6 s" in note, note[-140:])
        pg.click("#ars-removeall")
        pg.wait_for_timeout(600)

        # ---- v64 : HÉMORRAGIE INTERNE — le saignement PAR L'IMPACT ---------
        # Même saignement qu'en v58, chaîne de déclenchement radicalement
        # différente : ce n'est pas le critique qui déclenche mais un STATUT
        # D'IMPACT. D'où trois conditions en série, et une conséquence qui
        # prend tout le monde à revers — un mod élémentaire FAIT BAISSER ce
        # saignement, alors qu'il laissait celui de v58 rigoureusement
        # inchangé. Les deux sens sont vérifiés côte à côte, sur la même arme.
        def ligne_hem():
            for r in pg.locator("#ars-stats table tr").all_text_contents():
                if "Saignement d'Impact" in r:
                    return " ".join(r.split())
            return ""

        def val_fin(txt):
            """Le nombre collé à la fin de la ligne (« …hors armure)37 »).
            Un split sur les espaces rendrait « armure)37 » : la valeur d'une
            cellule ne se déduit pas de la mise en page."""
            m = re.search(r"(\d+(?:\.\d+)?)\s*$", txt or "")
            return float(m.group(1)) if m else None

        equipe_primaire("gorgon wraith")
        pg.click("#ars-removeall")
        pg.wait_for_timeout(600)
        pg.click('.ars-vide[data-i="0"]')
        pg.wait_for_timeout(600)
        pg.fill("#ars-coll-q", "hemorragie interne")
        pg.wait_for_timeout(500)
        pg.click('#ars-coll [data-equipe$="Rifle/WeaponBleedOnImpactProcRifleMod"]')
        pg.wait_for_timeout(800)
        note_h = pg.locator(".ars-hem").text_content() or ""
        hem_nu = ligne_hem()
        ok("v64 : la ligne « Saignement d'Impact » apparaît, hors armure",
           hem_nu != "" and "hors armure" in hem_nu, hem_nu)
        # Gorgon Wraith nu : 22,95 d'Impact sur 27 (84,9 %), statut 21 %,
        # cadence réelle 9,23 tirs/s (rechargement compris), mod à 35 %.
        #   procs/s = 9,229 × 0,21 × 0,849 × 0,35 = 0,58
        #   tick    = 0,35 × 27 × (1 + 0,15 × 0,9) = 10,7
        #   DPS     = 0,58 × 10,7 × 6 ticks = 37
        ok("v64 : les trois conditions sont chiffrées dans la note",
           "un statut part (21 %)" in note_h and "des dégâts" in note_h, note_h[:200])
        ok("v64 : la part d'Impact annoncée est celle du tableau (84.9 %)",
           "84.9 % des dégâts" in note_h, note_h[:200])
        ok("v64 : 0.58 proc/s et 10.7 par tick",
           "0.58 proc/s" in note_h and "10.7 par tick" in note_h, note_h[:220])
        ok("v64 : cadence 13.33 → PAS de doublement",
           "DOUBLÉ" not in note_h, note_h[:160])
        val_nu = val_fin(hem_nu)
        ok("v64 : DPS d'Impact = 0.58 × 10.7 × 6 ticks = 37", val_nu == 37, hem_nu)

        # LE PIÈGE, et l'inverse exact de v58 : un mod élémentaire dilue la part
        # d'Impact, donc réduit CE saignement.
        pg.click('.ars-vide[data-i="1"]')
        pg.wait_for_timeout(600)
        pg.fill("#ars-coll-q", "feu des enfers")
        pg.wait_for_timeout(500)
        pg.click('#ars-coll [data-equipe$="Rifle/WeaponFireDamageMod"]')
        pg.wait_for_timeout(800)
        note_h2 = pg.locator(".ars-hem").text_content() or ""
        val_feu = val_fin(ligne_hem())
        ok("v64 : un mod ÉLÉMENTAIRE fait BAISSER le saignement d'Impact",
           val_feu < val_nu, f"{val_nu} → {val_feu}")
        ok("v64 : et la note dit pourquoi (dilution de la part d'Impact)",
           "DILUE" in note_h2, note_h2[-180:])
        part_apres = note_h2.split("% des dégâts")[0].split("(")[-1].strip()
        ok("v64 : la part d'Impact affichée a bien chuté sous 85 %",
           float(part_apres.replace(",", ".")) < 85, part_apres)

        # ... et sur la MÊME arme, avec Munitions du Chasseur en plus, le
        # saignement critique reste indifférent au même mod élémentaire.
        # C'est la démonstration que les deux modèles ne se confondent pas.
        pg.click('.ars-vide[data-i="2"]')
        pg.wait_for_timeout(600)
        pg.fill("#ars-coll-q", "munitions du chasseur")
        pg.wait_for_timeout(500)
        pg.click('#ars-coll [data-equipe$="Sets/Hunter/PrimaryHunterMunitionsMod"]')
        pg.wait_for_timeout(800)
        saign_avec_feu = ligne_saign()
        ok("v64 : les DEUX saignements coexistent sur des lignes distinctes",
           saign_avec_feu != "" and ligne_hem() != "",
           saign_avec_feu + " | " + ligne_hem())

        pg.click("#ars-removeall")
        pg.wait_for_timeout(600)

        # La clause « x2 quand la cadence est sous 2,5 » : Chakkhurr Kuva tire à
        # 1,17, donc le mod vaut 70 % et non 35 %. C'est la cadence MODDÉE qui
        # décide — un mod de cadence peut faire franchir le seuil.
        equipe_primaire("chakkhurr kuva")
        pg.click("#ars-removeall")
        pg.wait_for_timeout(600)
        pg.click('.ars-vide[data-i="0"]')
        pg.wait_for_timeout(600)
        pg.fill("#ars-coll-q", "hemorragie interne")
        pg.wait_for_timeout(500)
        pg.click('#ars-coll [data-equipe$="Rifle/WeaponBleedOnImpactProcRifleMod"]')
        pg.wait_for_timeout(800)
        note_x2 = pg.locator(".ars-hem").text_content() or ""
        ok("v64 : cadence sous 2,5 → la chance est DOUBLÉE à 70 %",
           "DOUBLÉ" in note_x2 and "70 %" in note_x2, note_x2[:200])
        ok("v64 : et la note nomme la cadence qui déclenche le doublement",
           "sous 2,5" in note_x2, note_x2[:200])
        ok("v64 : saignement d'Impact non nul sur le Chakkhurr",
           (val_fin(ligne_hem()) or 0) > 0, ligne_hem())
        pg.click("#ars-removeall")
        pg.wait_for_timeout(600)

        # ---- v65 : ÉNERGIE (Rage, Équilibre) et POUVOIR GRANDISSANT --------
        # Trois familles que le moteur ignorait, et qui ne changent aucune stat
        # du tableau : elles changent le RYTHME de l'énergie, ou n'existent que
        # sous condition. D'où deux traitements différents et vérifiés à part.
        pg.click('[data-slot="frame"]')
        pg.wait_for_timeout(600)
        if not pg.locator("#ars-pk-q").is_visible():
            pg.click('[data-slot="frame"]')
            pg.wait_for_timeout(600)
        pg.fill("#ars-pk-q", "chroma prime")
        pg.wait_for_timeout(500)
        pg.locator('#ars-picker .ars-pk-it[data-un]:not([data-un=""])').first.click()
        pg.wait_for_timeout(800)
        pg.click("#ars-removeall")
        pg.wait_for_timeout(600)

        ok("v65 : frame nue — aucune ligne d'économie d'énergie",
           pg.locator(".ars-energie").count() == 0)

        pg.click('.ars-vide[data-i="0"]')
        pg.wait_for_timeout(600)
        pg.fill("#ars-coll-q", "adrenaline du chasseur")
        pg.wait_for_timeout(500)
        pg.click('#ars-coll [data-equipe$="Sets/Hunter/WarframeHunterAdrenalineMod"]')
        pg.wait_for_timeout(800)
        nrj = pg.locator(".ars-energie").text_content() or ""
        # Chroma Prime : 370 PV × 45 % = 166,5 → 167 d'énergie rendue.
        ok("v65 : Adrénaline du Chasseur — 45 % des dégâts sur la santé",
           "45 %" in nrj, nrj[:180])
        ok("v65 : le chiffre utile est ce que rend une barre de santé entière",
           "370 PV" in nrj and "167" in nrj, nrj[:200])
        ok("v65 : et il est rapporté à la réserve maximale",
           "de ta réserve" in nrj, nrj[:220])

        # Équilibre : DEUX valeurs dans une phrase, deux sens distincts.
        pg.click('.ars-vide[data-i="1"]')
        pg.wait_for_timeout(600)
        pg.fill("#ars-coll-q", "equilibre")
        pg.wait_for_timeout(500)
        pg.click('#ars-coll [data-equipe$="Warframe/AvatarPickupBonusMod"]')
        pg.wait_for_timeout(800)
        nrj2 = pg.locator(".ars-energie").text_content() or ""
        ok("v65 : Équilibre — les deux sens sont dits séparément (110 % / 110 %)",
           nrj2.count("110 %") == 2, nrj2[-200:])
        ok("v65 : et Rage reste affiché à côté, pas remplacé",
           "45 %" in nrj2 and "110 %" in nrj2, nrj2[:120])
        pg.click("#ars-removeall")
        pg.wait_for_timeout(600)

        # POUVOIR GRANDISSANT : une aura, ET un conditionnel. Le bonus ne doit
        # PAS tomber dans la puissance permanente — sinon le simulateur promet
        # 25 % qu'on n'a qu'après avoir infligé un statut.
        st_avant = pg.locator("#ars-stats").text_content() or ""
        pg.click('.ars-vide[data-i="aura"]')
        pg.wait_for_timeout(700)
        pg.fill("#ars-coll-q", "pouvoir grandissant")
        pg.wait_for_timeout(500)
        pg.click('#ars-coll [data-equipe$="Aura/FairyQuest/FairyQuestCritToAbilityAuraMod"]')
        pg.wait_for_timeout(800)
        st_apres = pg.locator("#ars-stats").text_content() or ""
        ok("v65 : la case apparaît, DÉCOCHÉE — rien n'est supposé",
           pg.locator("#ars-gstr").count() == 1
           and not pg.locator("#ars-gstr").is_checked())
        ok("v65 : décochée, la puissance reste celle de la frame nue",
           "avec Pouvoir Grandissant" not in st_apres, st_apres[:160])
        ok("v65 : la note dit la CONDITION, pas seulement le chiffre",
           "infliger un statut" in st_apres and "6 s" in st_apres,
           (pg.locator(".ars-gstr").text_content() or "")[:200])

        pg.check("#ars-gstr")
        pg.wait_for_timeout(800)
        st_coche = pg.locator("#ars-stats").text_content() or ""
        # 100 % de base + 25 % = 125 % pendant la fenêtre.
        ok("v65 : cochée, un chiffre CHANGE — une case inerte ne sert à rien",
           "avec Pouvoir Grandissant" in st_coche and "125 %" in st_coche,
           st_coche[:200])
        # Le choix survit au rechargement, comme celui d'Adaptation.
        pg.reload(wait_until="networkidle")
        pg.wait_for_timeout(1200)
        ok("v65 : le réglage est retenu d'une visite à l'autre",
           pg.locator("#ars-gstr").is_checked())
        pg.uncheck("#ars-gstr")
        pg.wait_for_timeout(600)
        pg.click("#ars-removeall")
        pg.wait_for_timeout(600)

        # ---- v66 : LES CONDITIONNELS « EN VISÉE » --------------------------
        # Treize mods portent la même forme (« On Headshot: +135% Critical
        # Chance when Aiming for 9s ») et touchent les stats qui décident du
        # DPS. Deux pièges, et les deux sont vérifiés :
        #   • le séparateur de la source est un « \n » LITTÉRAL, pas un espace —
        #     un motif qui attend \s ne matche rien du tout ;
        #   • les Galvanisés ont des PALIERS : +120 % puis +40 % × 5 = +320 %.
        #     Ne lire que la première clause sous-évaluerait de presque trois
        #     fois le mod le plus posé du jeu.
        equipe_primaire("soma prime")
        pg.click("#ars-removeall")
        pg.wait_for_timeout(600)
        ok("v66 : arme nue — aucune case « en visée »",
           pg.locator("#ars-cvise").count() == 0)

        pg.click('.ars-vide[data-i="0"]')
        pg.wait_for_timeout(600)
        pg.fill("#ars-coll-q", "viseur a argon")
        pg.wait_for_timeout(500)
        pg.click('#ars-coll [data-equipe$="Rifle/Event/CritChanceWhileAimingRifleMod"]')
        pg.wait_for_timeout(800)
        st = pg.locator("#ars-stats").text_content() or ""
        ok("v66 : la case apparaît, DÉCOCHÉE",
           pg.locator("#ars-cvise").count() == 1
           and not pg.locator("#ars-cvise").is_checked())
        ok("v66 : décochée, la chance critique reste celle de l'arme nue (30 %)",
           "30 %" in st and "70.5 %" not in st, st[:200])
        note = pg.locator(".ars-cvise").text_content() or ""
        ok("v66 : la case dit CE QUE la condition apporte, sans qu'on ait à cocher",
           "135 %" in note and "critique" in note.lower(), note[:150])
        ok("v66 : et elle dit la CONDITION et sa durée",
           "VISER" in note and "9 s" in note, note[:220])

        pg.check("#ars-cvise")
        pg.wait_for_timeout(800)
        st2 = pg.locator("#ars-stats").text_content() or ""
        # 30 % x (1 + 1,35) = 70,5 %
        ok("v66 : cochée — 30 % × (1 + 135 %) = 70.5 %", "70.5 %" in st2, st2[:220])

        # Les PALIERS : Viseur Galvanisé vaut +320 %, pas +120 %.
        pg.click('.ars-case[data-i="0"] .ars-mod-corps, .ars-vide[data-i="0"]')
        pg.wait_for_timeout(700)
        pg.fill("#ars-coll-q", "viseur galvanise")
        pg.wait_for_timeout(500)
        pg.click('#ars-coll [data-equipe$="Rifle/Event/CritChanceWhileAimingRifleSPMod"]')
        pg.wait_for_timeout(800)
        note_g = pg.locator(".ars-cvise").text_content() or ""
        st3 = pg.locator("#ars-stats").text_content() or ""
        ok("v66 : les paliers comptent — +120 % + 5 × 40 % = +320 %",
           "320 %" in note_g and "120 %" not in note_g, note_g[:160])
        # 30 % x (1 + 3,2) = 126 %
        ok("v66 : la chance critique dépasse 100 % — 126 %", "126 %" in st3, st3[:220])

        # Une autre stat, pour prouver que le repli n'est pas câblé sur le seul crit.
        pg.click('.ars-vide[data-i="1"]')
        pg.wait_for_timeout(600)
        pg.fill("#ars-coll-q", "salves de lames")
        pg.wait_for_timeout(500)
        pg.click('#ars-coll [data-equipe$="Rifle/Event/CritDamageWhileAimingRifleMod"]')
        pg.wait_for_timeout(800)
        st4 = pg.locator("#ars-stats").text_content() or ""
        # multi. critique 3 x (1 + 1,2) = 6,6
        ok("v66 : les dégâts critiques suivent aussi — ×3 → ×6.6",
           "×6.6" in st4, st4[:240])
        ok("v66 : les deux stats sont annoncées ensemble dans la case",
           "320 %" in (pg.locator(".ars-cvise").text_content() or "")
           and "120 %" in (pg.locator(".ars-cvise").text_content() or ""),
           (pg.locator(".ars-cvise").text_content() or "")[:170])

        # Le réglage survit au rechargement, comme Adaptation et Pouvoir Grandissant.
        pg.reload(wait_until="networkidle")
        pg.wait_for_timeout(1200)
        ok("v66 : le réglage est retenu d'une visite à l'autre",
           pg.locator("#ars-cvise").is_checked())
        pg.uncheck("#ars-cvise")
        pg.wait_for_timeout(600)
        st5 = pg.locator("#ars-stats").text_content() or ""
        ok("v66 : décochée à nouveau, on revient aux valeurs nues",
           "126 %" not in st5 and "30 %" in st5, st5[:200])
        pg.click("#ars-removeall")
        pg.wait_for_timeout(600)

        # ---- v68 : LA POLARITÉ DU CRÉNEAU EXILUS ---------------------------
        # Elle était codée en dur à « aucune » alors que le wiki la publie pour
        # 328 armes sur 353. Le simulateur facturait donc l'exilus PLEIN TARIF
        # là où le jeu divise le drain par deux. Sur 60 de capacité, la
        # différence décide si un build rentre.
        equipe_primaire("soma prime")
        pg.click("#ars-removeall")
        pg.wait_for_timeout(600)

        def cap_txt():
            return " ".join((pg.locator(".ars-cap-txt").text_content() or "").replace("\xa0", " ").split())

        # Le créneau exilus de la Soma Prime est NARAMON. Feu des Enfers est
        # naramon aussi : concordant → drain 11 divisé par deux = 6.
        pg.click('.ars-vide[data-i="x"]')
        pg.wait_for_timeout(700)
        pg.fill("#ars-coll-q", "feu des enfers")
        pg.wait_for_timeout(500)
        pg.click('#ars-coll [data-equipe$="Rifle/WeaponFireDamageMod"]')
        pg.wait_for_timeout(800)
        ok("v68 : exilus naramon + mod naramon → drain 11 divisé par deux = 6",
           "Capacité 6" in cap_txt(), cap_txt()[:70])

        # Le MÊME mod dans un créneau normal (madurai sur la Soma) est
        # discordant : 11 + 25 % = 14. Les deux chiffres côte à côte prouvent
        # que la polarité de l'exilus est bien lue, et pas devinée.
        pg.click('.ars-case[data-i="x"] .ars-mod-corps, .ars-vide[data-i="x"]')
        pg.wait_for_timeout(700)
        pg.click("#ars-removeall")
        pg.wait_for_timeout(600)
        pg.click('.ars-vide[data-i="0"]')
        pg.wait_for_timeout(600)
        pg.fill("#ars-coll-q", "feu des enfers")
        pg.wait_for_timeout(500)
        pg.click('#ars-coll [data-equipe$="Rifle/WeaponFireDamageMod"]')
        pg.wait_for_timeout(800)
        ok("v68 : le même mod dans un créneau madurai est discordant — 14",
           "Capacité 14" in cap_txt(), cap_txt()[:70])
        pg.click("#ars-removeall")
        pg.wait_for_timeout(600)

        # La polarité affichée sur le créneau exilus doit être celle de l'arme,
        # pas un point neutre : un chiffre juste avec un pictogramme faux
        # resterait incompréhensible.
        ok("v68 : le créneau exilus affiche bien une polarité",
           pg.evaluate("""() => {
             const c = document.querySelector('.ars-case[data-i="x"]');
             return !!(c && c.querySelector('.ars-pol-ic'));
           }"""))

        # Une MÊLÉE n'a pas de créneau exilus polarisé (une seule arme sur 269
        # en a un) : le cas « aucune polarité » doit rester intact.
        pg.click('[data-slot="melee"]')
        pg.wait_for_timeout(600)
        if not pg.locator("#ars-pk-q").is_visible():
            pg.click('[data-slot="melee"]')
            pg.wait_for_timeout(600)
        pg.fill("#ars-pk-q", "nikana prime")
        pg.wait_for_timeout(500)
        pg.locator('#ars-picker .ars-pk-it[data-un]:not([data-un=""])').first.click()
        pg.wait_for_timeout(800)
        pg.click("#ars-removeall")
        pg.wait_for_timeout(600)
        pg.click('.ars-vide[data-i="x"]')
        pg.wait_for_timeout(700)
        pg.fill("#ars-coll-q", "point de pression")
        pg.wait_for_timeout(500)
        pg.locator('#ars-coll [data-equipe]').first.click()
        pg.wait_for_timeout(800)
        cap_m = cap_txt()
        ok("v68 : sans polarité d'exilus, le drain reste PLEIN (aucune remise inventée)",
           "Capacité 6" not in cap_m and "Capacité" in cap_m, cap_m[:70])
        pg.click("#ars-removeall")
        pg.wait_for_timeout(600)

        # ---- v50 : stats d'armes à feu (bases lues dans les modules du wiki,
        # absentes de WFCD). Elles débloquent les mods qui étaient « non
        # simulés » faute de valeur de base à laquelle les appliquer.
        choisir_slot("frame")
        pg.click("#ars-removeall")     # repart d'une frame nue : plus d'aura
        pg.wait_for_timeout(600)
        pg.click('[data-slot="primaire"]')
        pg.wait_for_timeout(600)
        if not pg.locator("#ars-pk-q").is_visible():
            pg.click('[data-slot="primaire"]')
            pg.wait_for_timeout(600)
        pg.fill("#ars-pk-q", "soma prime")
        pg.wait_for_timeout(500)
        pg.locator('#ars-picker .ars-pk-it[data-un]:not([data-un=""])').first.click()
        pg.wait_for_timeout(800)
        pg.click("#ars-removeall")
        pg.wait_for_timeout(600)
        st_p = pg.locator("#ars-stats").text_content() or ""
        ok("v50 : munitions max de la Soma Prime (800)", "800" in st_p, st_p[:260])
        ok("v50 : montée en cadence annoncée (4 tirs, DPS à pleine cadence)",
           "Montée en cadence" in st_p and "4 tirs" in st_p, st_p[:400])

        pg.click('.ars-vide[data-i="0"]')
        pg.wait_for_timeout(600)
        pg.fill("#ars-coll-q", "tambour de munitions")
        pg.wait_for_timeout(500)
        pg.click('#ars-coll [data-equipe$="Rifle/WeaponAmmoMaxMod"]')
        pg.wait_for_timeout(700)
        st_p = pg.locator("#ars-stats").text_content() or ""
        ok("v50 : Tambour de Munitions (+90 %) — 800 → 1520",
           "1520" in st_p, st_p[:280])

        pg.click('.ars-vide[data-i="1"]')
        pg.wait_for_timeout(600)
        pg.fill("#ars-coll-q", "charpie")
        pg.wait_for_timeout(500)
        pg.click('#ars-coll [data-equipe$="Rifle/DualStat/ShredMod"]')
        pg.wait_for_timeout(700)
        st_p = pg.locator("#ars-stats").text_content() or ""
        ok("v50 : Charpie — pénétration 0 → 1.2 m (mètres PLATS, pas un %)",
           "1.2 m" in st_p, st_p[:300])

        # portée de rayon : base 27 m sur l'Ignis Wraith, +12 m avec Portée Sinistre
        pg.click('[data-slot="primaire"]')
        pg.wait_for_timeout(600)
        pg.fill("#ars-pk-q", "ignis wraith")
        pg.wait_for_timeout(500)
        pg.locator('#ars-picker .ars-pk-it[data-un]:not([data-un=""])').first.click()
        pg.wait_for_timeout(800)
        pg.click("#ars-removeall")
        pg.wait_for_timeout(600)
        st_p = pg.locator("#ars-stats").text_content() or ""
        ok("v50 : portée de rayon de l'Ignis Wraith (27 m)", "27 m" in st_p, st_p[:300])
        pg.click('.ars-vide[data-i="0"]')
        pg.wait_for_timeout(600)
        pg.fill("#ars-coll-q", "portee sinistre")
        pg.wait_for_timeout(500)
        pg.click('#ars-coll [data-equipe$="Rifle/WeaponBeamDistanceMod"]')
        pg.wait_for_timeout(700)
        st_p = pg.locator("#ars-stats").text_content() or ""
        ok("v50 : Portée Sinistre — 27 → 39 m", "39 m" in st_p, st_p[:300])

        # ---- v51 : COMPTEUR DE COMBO -------------------------------------
        # Formules relevées sur le wiki le 03/09/2026 :
        #   CC = CC base × [1 + mods CC + Coup de Sang × (combo − 1)]
        #   SC = SC base × [1 + mods SC + Blessures Suintantes × (combo − 1)]
        #   dégâts = base × [1 + mods dégâts + Surcharge d'État × n statuts]
        # Le multiplicateur de combo ne multiplie PAS les attaques normales.
        pg.click('[data-slot="melee"]')
        pg.wait_for_timeout(600)
        if not pg.locator("#ars-pk-q").is_visible():
            pg.click('[data-slot="melee"]')
            pg.wait_for_timeout(600)
        pg.fill("#ars-pk-q", "nikana prime")
        pg.wait_for_timeout(500)
        pg.locator('#ars-picker .ars-pk-it[data-un]:not([data-un=""])').first.click()
        pg.wait_for_timeout(800)
        pg.click("#ars-removeall")
        pg.wait_for_timeout(600)
        ok("v51 : réglage du compteur de combo présent sur une mêlée",
           pg.locator("#ars-combo").count() == 1)
        ok("v51 : durée du combo de la Nikana Prime (5 s)",
           "5 s" in (pg.locator("#ars-stats").text_content() or ""))

        pg.click('.ars-vide[data-i="0"]')
        pg.wait_for_timeout(600)
        pg.fill("#ars-coll-q", "coup de sang")
        pg.wait_for_timeout(500)
        pg.click('#ars-coll [data-equipe$="Melee/Event/ComboCritChanceMod"]')
        pg.wait_for_timeout(700)
        st = pg.locator("#ars-stats").text_content() or ""
        ok("v51 : sans combo (×1), Coup de Sang ne donne RIEN — crit 28 %",
           "28 %" in st and "61.6" not in st, st[:200])

        pg.select_option("#ars-combo", "4")
        pg.wait_for_timeout(700)
        st = pg.locator("#ars-stats").text_content() or ""
        ok("v51 : combo ×4 → 28 × (1 + 0,4 × 3) = 61.6 % de crit",
           "61.6 %" in st, st[:230])

        # + Acier Véritable Prime (+220 %) : 28 × (1 + 2,2 + 1,2) = 123.2 %
        pg.click('.ars-vide[data-i="1"]')
        pg.wait_for_timeout(600)
        pg.fill("#ars-coll-q", "acier veritable")
        pg.wait_for_timeout(500)
        pg.click('#ars-coll [data-equipe$="Melee/WeaponCritChanceMod"]')
        pg.wait_for_timeout(700)
        st = pg.locator("#ars-stats").text_content() or ""
        ok("v51 : Coup de Sang ADDITIF avec les mods de crit — 28 × (1 + 1,2 + 1,2) = 95.2 %",
           "95.2 %" in st, st[:250])

        # Surcharge d'État : additive avec les mods de dégâts, × nb de statuts
        pg.click('.ars-vide[data-i="2"]')
        pg.wait_for_timeout(600)
        pg.fill("#ars-coll-q", "surcharge")
        pg.wait_for_timeout(500)
        pg.click('#ars-coll [data-equipe$="Melee/WeaponDamageIfVictimProcActive"]')
        pg.wait_for_timeout(700)
        ok("v51 : le champ « types de statut » apparaît avec Surcharge d'État",
           pg.locator("#ars-statuts").count() == 1)
        st = pg.locator("#ars-stats").text_content() or ""
        ok("v51 : 0 statut sur la cible → Surcharge d'État ne donne rien (198)",
           "198" in st, st[:200])
        pg.fill("#ars-statuts", "3")
        pg.dispatch_event("#ars-statuts", "change")
        pg.wait_for_timeout(700)
        st = pg.locator("#ars-stats").text_content() or ""
        # 673.3 et non 673.2 : le jeu, comme l'arsenal, arrondit CHAQUE type de
        # dégât avant de sommer (9.9 × 3,4 = 33.7 ; 178.2 × 3,4 = 605.9).
        ok("v51 : 3 types de statut → 198 × (1 + 0,8 × 3) = 673.3",
           "673.3" in st, st[:230])

        # durée du combo : 5 s + 12 s du Décompte des Morts
        pg.click('.ars-vide[data-i="3"]')
        pg.wait_for_timeout(600)
        pg.fill("#ars-coll-q", "decompte")
        pg.wait_for_timeout(500)
        pg.click('#ars-coll [data-equipe$="Melee/Event/ComboDurationMod"]')
        pg.wait_for_timeout(700)
        st = pg.locator("#ars-stats").text_content() or ""
        ok("v51 : Décompte des Morts — durée du combo 5 → 17 s",
           "17 s" in st, st[:300])

        # montée du combo, calculée depuis les combos de la posture
        pg.click('.ars-vide[data-i="st"]')
        pg.wait_for_timeout(700)
        pg.fill("#ars-coll-q", "justice")
        pg.wait_for_timeout(500)
        pg.locator("#ars-coll [data-equipe]").first.click()
        pg.wait_for_timeout(800)
        montee = pg.locator(".ars-post-montee").text_content() or ""
        # 220 coups (table du wiki : palier n = (n − 1) × 20 coups) / 7,3 pts/s
        ok("v51 : la posture dit en combien de temps elle monte à ×12 (220 coups)",
           "×12" in montee and "30 s" in montee, montee[:140])
        ok("v51 : points de combo affichés par enchaînement (1900 % = 19 pts)",
           "19 pts combo" in (pg.locator("#ars-stats").text_content() or ""),
           (pg.locator(".ars-post-tbl").text_content() or "")[:160])

        pg.select_option("#ars-combo", "1")   # on repart d'un état honnête
        pg.wait_for_timeout(500)

        # ---- v52 : ATTAQUE LOURDE & ALLONGE ------------------------------
        # Wiki : dégâts lourds = dégâts normaux MODDÉS × multiplicateur fixe de
        # la classe d'arme × multiplicateur de combo. Le multiplicateur de
        # classe se déduit de l'arme (Nikana Prime : 990 pour 198 de base = ×5),
        # pas d'une table recopiée. Coup Mortel s'ajoute dans le même seau que
        # Point de Pression, mais pour la lourde seule.
        pg.click('[data-slot="melee"]')
        pg.wait_for_timeout(600)
        if not pg.locator("#ars-pk-q").is_visible():
            pg.click('[data-slot="melee"]')
            pg.wait_for_timeout(600)
        pg.fill("#ars-pk-q", "nikana prime")
        pg.wait_for_timeout(500)
        pg.locator('#ars-picker .ars-pk-it[data-un]:not([data-un=""])').first.click()
        pg.wait_for_timeout(800)
        pg.click("#ars-removeall")
        pg.wait_for_timeout(600)
        st = pg.locator("#ars-stats").text_content() or ""
        ok("v52 : bloc Attaque lourde — 990 (198 × ×5) au combo ×1",
           "Attaque lourde" in st and "990" in st and "×5" in st, st[:320])
        ok("v52 : allonge de base de la Nikana Prime (2.5 m)", "2.5 m" in st, st[:320])
        ok("v52 : temps de charge (0.5 s)", "0.5 s" in st, st[:320])

        pg.click('.ars-vide[data-i="0"]')
        pg.wait_for_timeout(600)
        pg.fill("#ars-coll-q", "atteinte")
        pg.wait_for_timeout(500)
        pg.click('#ars-coll [data-equipe$="Melee/WeaponMeleeRangeIncMod"]')
        pg.wait_for_timeout(700)
        st = pg.locator("#ars-stats").text_content() or ""
        ok("v52 : Atteinte — allonge 2.5 → 4 m (mètres plats)", "4 m" in st, st[:320])

        pg.click('.ars-vide[data-i="1"]')
        pg.wait_for_timeout(600)
        pg.fill("#ars-coll-q", "coup mortel")
        pg.wait_for_timeout(500)
        pg.click('#ars-coll [data-equipe$="Melee/WeaponMeleeHeavyDamageMod"]')
        pg.wait_for_timeout(700)
        st = pg.locator("#ars-stats").text_content() or ""
        ok("v52 : Coup Mortel — lourde 990 → 2178 (198 × 2,2 × 5)",
           "2178" in st, st[:360])
        ok("v52 : Coup Mortel accélère la charge — 0.5 → 0.31 s",
           "0.31 s" in st, st[:360])
        ok("v52 : les dégâts NORMAUX ne bougent pas (198) — la lourde est à part",
           "198" in st, st[:200])

        pg.select_option("#ars-combo", "4")
        pg.wait_for_timeout(700)
        st = pg.locator("#ars-stats").text_content() or ""
        ok("v52 : combo ×4 → lourde 8712 (2178 × 4), la seule chose qu'il multiplie",
           "8712" in st, st[:360])
        pg.select_option("#ars-combo", "1")
        pg.wait_for_timeout(500)

        # ---- v53 : ADAPTATION --------------------------------------------
        # Wiki : +10 % de résistance par coup reçu, plafond 90 %, PAR TYPE de
        # dégât, et MULTIPLICATIF avec les autres réductions — dont l'armure,
        # déjà comprise dans les PV effectifs. Chroma Prime nue : 370 PV,
        # 450 d'armure → 370 × (1 + 450/300) = 925 ; ÷ (1 − 0,9) = 9250.
        pg.click('[data-slot="frame"]')
        pg.wait_for_timeout(600)
        if not pg.locator("#ars-pk-q").is_visible():
            pg.click('[data-slot="frame"]')
            pg.wait_for_timeout(600)
        pg.fill("#ars-pk-q", "chroma prime")
        pg.wait_for_timeout(500)
        pg.locator('#ars-picker .ars-pk-it[data-un]:not([data-un=""])').first.click()
        pg.wait_for_timeout(800)
        pg.click("#ars-removeall")
        pg.wait_for_timeout(600)
        ok("v53 : sans Adaptation, aucun réglage ne s'affiche",
           pg.locator("#ars-adapt").count() == 0)
        ok("v53 : Chroma Prime nue — 925 PV effectifs",
           "925" in (pg.locator("#ars-stats").text_content() or ""))

        pg.click('.ars-vide[data-i="0"]')
        pg.wait_for_timeout(600)
        pg.fill("#ars-coll-q", "adaptation")
        pg.wait_for_timeout(500)
        pg.click('#ars-coll [data-equipe$="Warframe/AvatarResistanceOnDamageMod"]')
        pg.wait_for_timeout(700)
        st_a = pg.locator("#ars-stats").text_content() or ""
        ok("v53 : Adaptation équipée → le réglage apparaît (90 %)",
           pg.locator("#ars-adapt").count() == 1 and "90 %" in st_a, st_a[:200])
        ok("v53 : décochée, elle ne gonfle RIEN — toujours 925",
           "925" in st_a and "9250" not in st_a, st_a[:200])

        pg.check("#ars-adapt")
        pg.wait_for_timeout(700)
        st_a = pg.locator("#ars-stats").text_content() or ""
        ok("v53 : cumuls max → 925 ÷ (1 − 0,9) = 9250 PV effectifs",
           "9250" in st_a, st_a[:220])
        ok("v53 : la nature du bonus est dite (par type de dégât)",
           "type de dégât" in (pg.locator(".ars-adapt").text_content() or ""),
           (pg.locator(".ars-adapt").text_content() or "")[:140])
        pg.uncheck("#ars-adapt")
        pg.wait_for_timeout(500)

        # ---- v54 : SURGARDE (overguard) ----------------------------------
        # Chef de Meute donne +1 200 de surgarde AU COMPAGNON (wiki : le mod le
        # soigne à chaque coup de mêlée de la Warframe, le surplus devient de
        # la surgarde). Règle capitale : « Overguard is not affected by Damage
        # Reduction from armor […] or Damage type resistance effects such as
        # Adaptation » — elle ne se multiplie avec RIEN et ne rejoint jamais
        # les PV effectifs.
        pg.click('[data-slot="compagnon"]')
        pg.wait_for_timeout(600)
        if not pg.locator("#ars-pk-q").is_visible():
            pg.click('[data-slot="compagnon"]')
            pg.wait_for_timeout(600)
        pg.fill("#ars-pk-q", "chesa")
        pg.wait_for_timeout(500)
        pg.locator('#ars-picker .ars-pk-it[data-un]:not([data-un=""])').first.click()
        pg.wait_for_timeout(800)
        pg.click("#ars-removeall")
        pg.wait_for_timeout(600)
        st_c = pg.locator("#ars-stats").text_content() or ""
        ok("v54 : compagnon nu — aucune ligne de surgarde",
           "Surgarde" not in st_c, st_c[:160])

        pg.click('.ars-vide[data-i="0"]')
        pg.wait_for_timeout(600)
        pg.fill("#ars-coll-q", "chef de meute")
        pg.wait_for_timeout(500)
        pg.click('#ars-coll [data-equipe$="Kubrow/KubrowPackLeaderMod"]')
        pg.wait_for_timeout(700)
        st_c = pg.locator("#ars-stats").text_content() or ""
        ok("v54 : Chef de Meute — surgarde max 1200 (valeur PLATE)",
           "Surgarde" in st_c and "1200" in st_c, st_c[:260])
        ok("v54 : la règle est dite — tampon à part, ni armure ni Adaptation",
           "Adaptation" in st_c and "armure" in st_c, st_c[-320:])
        # la surgarde ne doit toucher NI les PV NI l'armure du compagnon
        ok("v54 : PV et armure du Chesa Kubrow inchangés (940 / 300)",
           "940" in st_c and "300" in st_c, st_c[:200])

        # ---- Relecture du 03/09/2026 : trois divisions par zéro ----------
        # Le champ de saisie d'un riven accepte −200 % à +400 %, et « dmg » en
        # fait partie. À −100 %, mult = 1 + f.dmg = 0 — ce qui faisait sortir
        # NaN ou Infinity de la ligne d'attaque lourde (introduite en v52) et
        # du rechargement (défaut plus ancien).
        pg.click('[data-slot="melee"]')
        pg.wait_for_timeout(600)
        if not pg.locator("#ars-pk-q").is_visible():
            pg.click('[data-slot="melee"]')
            pg.wait_for_timeout(600)
        pg.fill("#ars-pk-q", "nikana prime")
        pg.wait_for_timeout(500)
        pg.locator('#ars-picker .ars-pk-it[data-un]:not([data-un=""])').first.click()
        pg.wait_for_timeout(800)
        pg.click("#ars-removeall")
        pg.wait_for_timeout(600)
        pg.click("[data-riven]")
        pg.wait_for_timeout(600)
        pg.locator(".ars-rv-stat").nth(0).select_option("dmg")
        pg.locator(".ars-rv-val").nth(0).fill("-100")
        pg.fill("#ars-rv-d", "12")
        pg.click("#ars-rv-ok")
        pg.wait_for_timeout(900)
        st_z = pg.locator("#ars-stats").text_content() or ""
        ok("riven à −100 % de dégâts : aucun NaN ni Infinity dans le panneau",
           "NaN" not in st_z and "Infinity" not in st_z, st_z[:260])
        ok("riven à −100 % : l'attaque lourde tombe à 0, pas à un symbole",
           "Attaque lourde" in st_z, st_z[:260])

        # même piège côté rechargement, sur une arme à chargeur
        pg.click('[data-slot="primaire"]')
        pg.wait_for_timeout(600)
        if not pg.locator("#ars-pk-q").is_visible():
            pg.click('[data-slot="primaire"]')
            pg.wait_for_timeout(600)
        pg.fill("#ars-pk-q", "soma prime")
        pg.wait_for_timeout(500)
        pg.locator('#ars-picker .ars-pk-it[data-un]:not([data-un=""])').first.click()
        pg.wait_for_timeout(800)
        pg.click("#ars-removeall")
        pg.wait_for_timeout(600)
        pg.click("[data-riven]")
        pg.wait_for_timeout(600)
        pg.locator(".ars-rv-stat").nth(0).select_option("rel")
        pg.locator(".ars-rv-val").nth(0).fill("-100")
        pg.fill("#ars-rv-d", "12")
        pg.click("#ars-rv-ok")
        pg.wait_for_timeout(900)
        st_z = pg.locator("#ars-stats").text_content() or ""
        ok("riven à −100 % de rechargement : DPS soutenu reste un nombre fini",
           "NaN" not in st_z and "Infinity" not in st_z, st_z[:260])

        # Adaptation : restaure() avale un build depuis le hash d'URL SANS
        # validation — c'est le chemin d'un lien de partage bricolé. On y pose
        # les DEUX Adaptation du jeu, que l'interface interdit normalement.
        # Adaptation est un PLAFOND (« stacks up to 90% »), pas un bonus : deux
        # exemplaires ne font pas 180 %, ils font 90 %. Sans cette règle,
        # 1 − 1,8 était négatif et les PV effectifs partaient dans le rouge.
        etat_pourri = {
            "reacteur": True, "sel": "frame", "adapt": True,
            "equip": {"frame": {
                "un": "/Lotus/Powersuits/Dragon/ChromaPrime",
                "mods": {"aura": None, "aura2": None, "st": None, "exilus": None, "slots": [
                    {"un": "/Lotus/Upgrades/Mods/Warframe/AvatarResistanceOnDamageMod", "rk": None},
                    {"un": "/Lotus/Upgrades/Mods/Nemesis/AvatarSentientArmourMod", "rk": None},
                    None, None, None, None, None, None]},
                "formas": {}, "arcanes": [None, None]}}}
        lien = base64.b64encode(
            json.dumps(etat_pourri, ensure_ascii=False).encode("utf-8")).decode()
        # NB : on est déjà sur /arsenal, et changer seulement le HASH ne
        # recharge pas la page — restaure() ne repasserait jamais. D'où le
        # rechargement explicite, qui rejoue le démarrage avec le hash en place.
        pg.goto(BASE + "/arsenal#b=" + lien, wait_until="domcontentloaded", timeout=30000)
        pg.reload(wait_until="domcontentloaded")
        pg.wait_for_selector(".ars-slot", timeout=15000)
        pg.wait_for_timeout(1500)
        st_z = pg.locator("#ars-stats").text_content() or ""
        ok("lien bricolé à deux Adaptation : le plafond reste à 90 %, pas 180",
           "90 %" in st_z and "180 %" not in st_z, st_z[:200])
        ok("lien bricolé : PV effectifs positifs (925 ÷ 0,1 = 9250)",
           "9250" in st_z, st_z[:200])
        ok("lien bricolé : ni NaN ni Infinity",
           "NaN" not in st_z and "Infinity" not in st_z, st_z[:200])

        ok("zéro erreur JS", not errs, str(errs[:2]))
        ctx.close()
        b.close()
    if srv:
        srv.terminate()
    return bilan("simulateur d'arsenal")


if __name__ == "__main__":
    sys.exit(main())
