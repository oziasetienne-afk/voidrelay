#!/usr/bin/env python3
# /marche-profils : les cinq classements, le choix du profil, et le bandeau qui
# le rappelle sur les autres pages du marché.
#
# Tout se joue hors ligne (bloquer_externe) : les trois fichiers de données sont
# servis en local, donc les chiffres affichés sont reproductibles. Ce qui est
# vérifié ici n'est pas le calcul — scripts/verifier_profils.mjs s'en charge sans
# navigateur — mais le CÂBLAGE : le bon classement pour le bon profil, le choix
# qui persiste, et le bandeau qui apparaît PENDANT l'analyse de la page.
import sys

from playwright.sync_api import sync_playwright

from _outils import BASE, ok, lancer, bloquer_externe, demarrer_serveur, bilan


def entetes(pg):
    return [t.strip() for t in pg.eval_on_selector_all("#pfTbl thead th", "e=>e.map(x=>x.textContent)")]


def nb_lignes(pg):
    return pg.evaluate("() => document.querySelectorAll('#pfTbl tbody tr').length")


def choisir(pg, pid):
    pg.click(f'.pf-card[data-id="{pid}"]')
    pg.wait_for_timeout(400)


def main():
    srv = demarrer_serveur()
    with sync_playwright() as p:
        b = lancer(p)
        ctx = b.new_context(viewport={"width": 1280, "height": 900})
        bloquer_externe(ctx)
        pg = ctx.new_page()
        errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)[:160]))
        pg.goto(BASE + "/marche-profils", wait_until="networkidle", timeout=30000)

        ok("les cinq profils sont proposés",
           pg.evaluate("() => document.querySelectorAll('.pf-card').length") == 5)
        ok("sans profil choisi, le classement du farmeur est servi par défaut",
           "Ce que ta pièce rapporte" in pg.text_content("#pfTitre"))
        ok("le tableau est rempli", nb_lignes(pg) >= 20, f"{nb_lignes(pg)} lignes")

        # 🎯 farmeur — la colonne qui compte est « ce que tu toucheras », pas la médiane
        choisir(pg, "farmeur")
        e = entetes(pg)
        ok("farmeur : la première valeur est ce qu'il touchera vraiment",
           e[1] == "Tu toucheras" and "Médiane" in e, " · ".join(e))
        prem = pg.eval_on_selector_all(
            "#pfTbl tbody tr td:nth-child(2)",
            "e=>e.slice(0,12).map(x=>parseFloat(x.textContent))")
        ok("farmeur : trié sur la vente la plus basse, décroissant",
           all(prem[i] >= prem[i + 1] for i in range(len(prem) - 1)), str(prem[:5]))

        # 🧩 monteur — les pièces sont chargées à la demande, et les doubles comptent
        choisir(pg, "monteur")
        pg.wait_for_function("() => document.querySelectorAll('#pfTbl tbody tr').length > 3",
                             timeout=15000)
        e = entetes(pg)
        ok("monteur : coût des pièces face au prix du set", "Coût des pièces" in e, " · ".join(e))
        # v98 : le tableau n'affiche que les N meilleurs sets du jour. Chercher
        # « Akbolto Prime » faisait dépendre le test du marché : le 27/09, ses pièces
        # (92 p) coûtaient plus cher que le set (70 p), il sortait du tableau et le
        # test rougissait sans défaut. On vérifie la RÈGLE sur n'importe quel set
        # affiché qui a une pièce en double : coût = somme des quantités × prix.
        dbl = pg.evaluate("""() => {
            for (const tr of document.querySelectorAll('#pfTbl tbody tr')) {
              const det = (tr.querySelector('.pf-piv') || {}).textContent || '';
              if (!/(^|· )[2-9]× /.test(det)) continue;
              let somme = 0;
              for (const m of det.matchAll(/(\\d+)× .*? à ([\\d.,]+) p/g))
                somme += Number(m[1]) * Number(m[2].replace(',', '.'));
              const cout = parseFloat(tr.cells[1].textContent.replace(/\\s/g, '').replace(',', '.'));
              return { det: det, somme: Math.round(somme * 10) / 10, cout: cout };
            }
            return null;
        }""")
        ok("monteur : une pièce en double compte double dans le coût du set",
           dbl is not None and abs(dbl["somme"] - dbl["cout"]) < 0.11, str(dbl)[:160])
        ok("monteur : le nombre de rendez-vous en jeu est une colonne", "Trades" in e)

        # ⚡ flipper — les deux garde-fous d'ordres isolés sont câblés
        choisir(pg, "flipper")
        e = entetes(pg)
        ok("flipper : les trois marges sont des colonnes distinctes",
           "Marge patiente" in e and "Aller-retour" in e and "Marge affichée" in e,
           " · ".join(e))
        pat = pg.eval_on_selector_all(
            "#pfTbl tbody tr td:nth-child(6)",
            "e=>e.slice(0,12).map(x=>parseFloat(x.textContent.replace('+','')))")
        ok("flipper : trié sur la marge PATIENTE, pas sur la marge affichée",
           all(pat[i] >= pat[i + 1] for i in range(len(pat) - 1)), str(pat[:5]))
        # La colonne qui trie doit être reconstructible depuis les deux prix
        # PRUDENTS affichés (médiane − 2ᵉ vente) : si elle l'est, aucun extrême
        # — ni la vente la plus basse, ni la demande la plus haute — n'entre
        # dans le classement. C'est le vrai garde-fou ; le badge n'est qu'un
        # avertissement, et une ligne badgée peut légitimement être en tête.
        trip = pg.eval_on_selector_all(
            "#pfTbl tbody tr",
            "e=>e.slice(0,12).map(r=>[3,4,6].map(i=>"
            "parseFloat(r.querySelector('td:nth-child('+i+')').textContent"
            ".replace('+','').replace('−','-'))))")
        chiffres = [t for t in trip if not any(x != x for x in t)]
        ecarts = [round(t[1] - t[0] - t[2], 1) for t in chiffres]
        ok("flipper : la colonne qui trie est médiane − 2ᵉ vente, jamais un extrême",
           bool(chiffres) and max(abs(x) for x in ecarts) <= 0.15,
           f"{len(chiffres)} lignes chiffrées · écart max {max((abs(x) for x in ecarts), default='?')}")
        # Le verdict est la vraie information de ce tableau : l'aller-retour
        # immédiat ne paie sur aucun objet suivi, et la page doit le dire.
        note = pg.text_content("#pfNote") or ""
        ok("flipper : le verdict du jour sur l'aller-retour immédiat est affiché",
           "verdict" in note.lower() and "aller-retour" in note.lower(),
           note[note.lower().find("verdict"):][:110])

        # 💎 ducatier et 🌱 débutant
        choisir(pg, "ducatier")
        ok("ducatier : le ratio ducats/platine est la colonne classée",
           "Ducats / platine" in entetes(pg), " · ".join(entetes(pg)))
        choisir(pg, "debutant")
        e = entetes(pg)
        ok("débutant : ce qu'un acheteur donne DÉJÀ, et ce que la vitesse coûte",
           "Un acheteur donne" in e and "Ce que la vitesse coûte" in e, " · ".join(e))
        parts = pg.eval_on_selector_all(
            "#pfTbl tbody tr td:nth-child(4)",
            "e=>e.slice(0,10).map(x=>parseFloat(x.textContent))")
        ok("débutant : la part est plafonnée à la médiane — aucune demande gonflée ne passe",
           bool(parts) and max(parts) <= 100, f"part max {max(parts) if parts else '?'} %")

        # le choix survit au rechargement, et se retire en recliquant
        pg.reload(wait_until="networkidle")
        ok("le profil est retenu d'une visite à l'autre",
           pg.evaluate("() => localStorage.getItem('vr_profil')") == "debutant")
        ok("et la carte le dit",
           pg.get_attribute('.pf-card[data-id="debutant"]', "aria-pressed") == "true")
        choisir(pg, "debutant")
        ok("recliquer sur son propre profil le retire",
           pg.evaluate("() => localStorage.getItem('vr_profil')") is None)

        ok("zéro erreur JS", not errs, str(errs[:2]))
        ctx.close()

        # Le bandeau sur les autres pages du marché — posé PENDANT l'analyse, donc
        # présent avant même que le réseau ait répondu : c'est ce qui empêche le
        # décalage de mise en page que le garde-fou CLS traque.
        for url in ["/marche", "/marche-complet", "/estimateur", "/trade", "/bons-plans"]:
            ctx = b.new_context(viewport={"width": 1280, "height": 900})
            bloquer_externe(ctx)
            pg = ctx.new_page()
            pg.add_init_script("try{localStorage.setItem('vr_profil','flipper')}catch(e){}")
            pg.goto(BASE + url, wait_until="domcontentloaded", timeout=30000)
            txt = (pg.text_content(".vr-profil-bandeau") or "")
            ok(f"{url} : le bandeau rappelle le profil choisi",
               "flipper" in txt.lower(), txt.strip()[:70])
            href = pg.get_attribute(".vr-profil-bandeau", "href")
            ok(f"{url} : et renvoie à son classement", href == "/marche-profils", str(href))
            ctx.close()

        # /trade s'ouvre du bon côté : celui qui achète au plus bas ouvre cette
        # page pour ACHETER, et y trouvait « WTS » à chaque visite.
        for pid, attendu in [("flipper", "buy"), ("ducatier", "buy"),
                             ("farmeur", "sell"), (None, "sell")]:
            ctx = b.new_context(viewport={"width": 1280, "height": 900})
            bloquer_externe(ctx)
            pg = ctx.new_page()
            if pid:
                pg.add_init_script(f"try{{localStorage.setItem('vr_profil','{pid}')}}catch(e){{}}")
            pg.goto(BASE + "/trade", wait_until="networkidle", timeout=30000)
            actif = pg.get_attribute(".tr-pill.active", "data-tt")
            ok(f"/trade : profil {pid or 'aucun'} → onglet {attendu}", actif == attendu, str(actif))
            ctx.close()

        # ---- La page anglaise ------------------------------------------
        # Une page bilingue qui laisse passer un mot de français est pire qu'une
        # page absente : elle donne l'impression d'une traduction faite à moitié.
        # On vérifie donc les libellés ET l'absence de résidus français.
        ctx = b.new_context(viewport={"width": 1280, "height": 900})
        bloquer_externe(ctx)
        pg = ctx.new_page()
        errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)[:160]))
        pg.goto(BASE + "/en/market-profiles", wait_until="networkidle", timeout=30000)

        ok("EN : les cinq profils sont proposés en anglais",
           pg.evaluate("() => document.querySelectorAll('.pf-card').length") == 5
           and "The farmer" in pg.text_content("#pfChoix"),
           pg.text_content("#pfChoix")[:60])
        ok("EN : le classement par défaut est en anglais",
           "What your part actually pays" in pg.text_content("#pfTitre"),
           pg.text_content("#pfTitre"))
        e = entetes(pg)
        ok("EN : les colonnes sont traduites",
           "You will get" in e and "Sellers ahead of you" in e, " · ".join(e))
        ok("EN : le tableau est rempli", nb_lignes(pg) >= 20, f"{nb_lignes(pg)} lignes")

        choisir(pg, "flipper")
        e = entetes(pg)
        ok("EN : flipper — les trois marges sont traduites",
           "Patient margin" in e and "Round trip" in e and "Headline margin" in e, " · ".join(e))
        note = pg.text_content("#pfNote") or ""
        ok("EN : le verdict du jour est en anglais",
           "verdict" in note.lower() and "round trip" in note.lower(),
           note[note.lower().find("verdict"):][:90])

        choisir(pg, "monteur")
        pg.wait_for_function("() => document.querySelectorAll('#pfTbl tbody tr').length > 3",
                             timeout=15000)
        ok("EN : monteur — colonnes traduites et quantités présentes",
           "Parts cost" in entetes(pg) and "2×" in pg.text_content("#pfTbl"),
           " · ".join(entetes(pg)))

        # Aucun résidu français dans ce que la page produit vraiment.
        residus = pg.evaluate("""() => {
            const t = document.querySelector('main').textContent;
            const mots = ['Objet', 'Médiane', 'Vendeurs', 'Chargement', 'aujourd', 'Aucune',
                          'ton profil', 'il y a ', 'pièces', 'lignes ·'];
            return mots.filter(m => t.includes(m));
        }""")
        ok("EN : aucun résidu de français dans la page", not residus, str(residus))
        ok("EN : liens objets vers /en/o/",
           pg.evaluate("() => !![...document.querySelectorAll('#pfTbl a')].every(a => a.getAttribute('href').startsWith('/en/o/'))"))
        ok("EN : zéro erreur JS", not errs, str(errs[:2]))
        ctx.close()

        # Le bandeau anglais sur les pages marché EN, et son lien vers la page EN.
        for url in ["/en/price-check", "/en/trade"]:
            ctx = b.new_context(viewport={"width": 1280, "height": 900})
            bloquer_externe(ctx)
            pg = ctx.new_page()
            pg.add_init_script("try{localStorage.setItem('vr_profil','ducatier')}catch(e){}")
            pg.goto(BASE + url, wait_until="domcontentloaded", timeout=30000)
            txt = pg.text_content(".vr-profil-bandeau") or ""
            ok(f"{url} : bandeau en anglais", "ducat hunter" in txt.lower(), txt.strip()[:70])
            ok(f"{url} : renvoie vers la page anglaise",
               pg.get_attribute(".vr-profil-bandeau", "href") == "/en/market-profiles")
            ctx.close()

        # Les deux pages se citent l'une l'autre : sans ça, un anglophone arrivé
        # par la page française n'a aucun moyen de trouver la sienne.
        for url, cible in [("/marche-profils", "/en/market-profiles"),
                           ("/en/market-profiles", "/marche-profils")]:
            ctx = b.new_context(viewport={"width": 1280, "height": 900})
            bloquer_externe(ctx)
            pg = ctx.new_page()
            pg.goto(BASE + url, wait_until="domcontentloaded", timeout=30000)
            ok(f"{url} : hreflang réciproque vers {cible}",
               pg.evaluate(f"() => !!document.querySelector('link[rel=alternate][href$=\"{cible}\"]')"))
            ok(f"{url} : lien visible vers {cible}",
               pg.evaluate(f"() => !!document.querySelector('.bc a[href=\"{cible}\"]')"))
            ctx.close()

        # Sans profil, le bandeau invite au lieu de disparaître : la page reste
        # utilisable, mais celui qui ne sait pas que ça existe l'apprend.
        ctx = b.new_context(viewport={"width": 1280, "height": 900})
        bloquer_externe(ctx)
        pg = ctx.new_page()
        pg.goto(BASE + "/marche", wait_until="domcontentloaded", timeout=30000)
        ok("sans profil, le bandeau invite à en choisir un",
           "Dis comment tu joues" in (pg.text_content(".vr-profil-bandeau") or ""))

        # /outils : « tes outils » plutôt qu'une liste de dix-sept. La correspondance
        # outil → profils est écrite sur la carte (data-pf), donc c'est le CÂBLAGE
        # qui est vérifié ici — que la bonne carte s'allume pour le bon profil, et
        # jamais toutes, sinon le profil ne trie rien.
        for url, cartes, mot in [("/outils", 17, "Tes outils"), ("/en/tools", 12, "Your tools")]:
            pg.goto(BASE + url, wait_until="networkidle", timeout=30000)
            ok(f"{url} : sans profil choisi, aucune boîte « tes outils »",
               pg.evaluate("()=>document.querySelectorAll('.vr-profil-outils').length") == 0)
            pg.evaluate("()=>localStorage.setItem('vr_profil','ducatier')")
            pg.reload(wait_until="networkidle")
            nd = pg.evaluate("()=>document.querySelectorAll('.tool-card.pf-mien').length")
            txt = pg.text_content(".vr-profil-outils") or ""
            ok(f"{url} : ducatier — ses outils sont soulignés ET listés",
               nd > 0 and mot in txt, f"{nd} cartes · {txt[:80]}")
            ok(f"{url} : le convertisseur de ducats en fait partie",
               pg.evaluate("()=>[...document.querySelectorAll('.tool-card.pf-mien')]"
                           ".some(c=>/ducat/.test(c.getAttribute('href')))"))
            pg.evaluate("()=>localStorage.setItem('vr_profil','farmeur')")
            pg.reload(wait_until="networkidle")
            nf = pg.evaluate("()=>document.querySelectorAll('.tool-card.pf-mien').length")
            ok(f"{url} : farmeur — un autre profil allume d'autres outils",
               nf > 0 and nf != nd, f"farmeur {nf} · ducatier {nd}")
            ok(f"{url} : jamais toutes les cartes — sinon le profil ne trie rien",
               nf < cartes, f"{nf} / {cartes}")
            pg.evaluate("()=>localStorage.removeItem('vr_profil')")
        ctx.close()

        b.close()
    if srv:
        srv.terminate()
    return bilan("profils de marché")


if __name__ == "__main__":
    sys.exit(main())
