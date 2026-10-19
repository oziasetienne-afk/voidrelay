#!/usr/bin/env python3
# Débordement horizontal (28/09/2026) : aucune page ne doit défiler de côté.
#
# Mesuré avant correction, hors ligne (police de repli, comme une 1re visite en
# display=optional) : /hub +10 px à 375 (tableau marché, 7 colonnes = 353 px),
# /marche +40 px à 768 et +54 px à 320 (pistes 1fr élargies par les noms en
# nowrap), /taches +28 px (piste fixe à 330 px), /compagnon +36 px (champ de
# recherche), /faq-en +2 px (lien nowrap), /confidentialite +4 px (h1).
# Aucun ne produisait d'erreur ni ne rougissait un test : la page glissait
# juste sous le doigt.
#
# Contrôle : scrollWidth du document ≤ largeur de la fenêtre, à 320 (le plus
# petit téléphone courant) et 768 (tablette, où la grille /marche passe à 2 colonnes).
import glob
import os
import sys

from playwright.sync_api import sync_playwright

from _outils import BASE, RACINE, ok, lancer, bloquer_externe, demarrer_serveur, bilan

LARGEURS = (320, 768)
# Fichiers présents à la racine mais qui ne sont pas des pages du site.
EXCLUS = {"hub-widget.example.html"}


def pages():
    os.chdir(RACINE)
    liste = sorted(glob.glob("*.html") + glob.glob("en/*.html"))
    liste = [p for p in liste if p not in EXCLUS and not p.startswith("google")]
    # Pages générées : un échantillon par gabarit suffit, elles partagent tout leur CSS.
    for motif in ("o/*.html", "en/o/*.html", "builds/*/index.html", "builds/*.html",
                  "guides/*.html", "guides/*/index.html"):
        trouvees = sorted(glob.glob(motif))
        if trouvees:
            liste.append(trouvees[0])
    return liste


def main():
    srv = demarrer_serveur()
    liste = pages()
    ok("pages trouvées", len(liste) > 40, str(len(liste)))
    with sync_playwright() as p:
        b = lancer(p)
        for w in LARGEURS:
            ctx = b.new_context(viewport={"width": w, "height": 800}, is_mobile=w < 700, has_touch=w < 700)
            bloquer_externe(ctx)
            pg = ctx.new_page()
            fautives = []
            for chemin in liste:
                try:
                    pg.goto(BASE + "/" + chemin, wait_until="load", timeout=30000)
                    pg.wait_for_timeout(700)   # rendu JS des cartes (hub, marche)
                    sw = pg.evaluate("document.documentElement.scrollWidth")
                    cw = pg.evaluate("document.documentElement.clientWidth")
                except Exception as e:
                    fautives.append(f"{chemin} (chargement : {str(e)[:60]})")
                    continue
                if sw > cw + 1:
                    fautives.append(f"{chemin} +{sw - cw} px")
            ok(f"{w} px : aucune page ne défile de côté ({len(liste)} pages)", not fautives, "; ".join(fautives))
            ctx.close()
        b.close()
    if srv:
        srv.terminate()
    return bilan("débordement horizontal")


if __name__ == "__main__":
    sys.exit(main())
