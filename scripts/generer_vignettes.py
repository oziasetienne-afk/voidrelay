#!/usr/bin/env python3
# Vignettes WebP des portraits (28/09/2026).
#
# Les pages de builds affichent le portrait en 132 px (84 px sur mobile) mais
# chargeaient le PNG de 512 px : ~80 Ko pour une image vue en timbre-poste, sur
# 1 478 pages. On produit une vignette 264 px (132 × 2, écrans haute densité) en
# WebP, à côté de l'original : assets/<dossier>/v/<Nom>.webp.
#
# Les PNG restent : ils servent d'og:image (aperçu de partage — certains réseaux
# ne lisent pas le WebP) et au reste du site. generer_builds.mjs retombe sur le
# PNG si une vignette manque : un portrait ajouté sans relancer ce script
# s'affiche quand même, juste plus lourd.
#
# Usage : python3 scripts/generer_vignettes.py      (dépendance : pip install pillow)
#         puis node scripts/generer_builds.mjs
import os
import sys

try:
    from PIL import Image
except ImportError:
    sys.exit("❌ Pillow absent : pip install pillow")

RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
# Côté max par dossier = 2 × la taille d'affichage (écrans haute densité).
# wfimg (cartes de mods 120 px, ajouté le 28/09/2026) : 256–512 px en JPG/PNG,
# ~150 Ko chargés à l'ouverture d'une page de build.
DOSSIERS = {"frames": 264, "weapons": 264, "companions": 264, "wfimg": 240}

avant = apres = n = plus_lourdes = 0
for d, COTE in DOSSIERS.items():
    src = os.path.join(RACINE, "assets", d)
    dst = os.path.join(src, "v")
    os.makedirs(dst, exist_ok=True)
    for f in sorted(os.listdir(src)):
        base, ext = os.path.splitext(f)
        if ext.lower() not in (".png", ".jpg", ".jpeg"):
            continue
        sortie = os.path.join(dst, base + ".webp")
        # Déjà à jour : on ne réécrit pas (sorties stables, pas de diff git inutile).
        if os.path.exists(sortie) and os.path.getmtime(sortie) >= os.path.getmtime(os.path.join(src, f)):
            avant += os.path.getsize(os.path.join(src, f)); apres += os.path.getsize(sortie); n += 1
            continue
        im = Image.open(os.path.join(src, f)).convert("RGBA")
        im.thumbnail((COTE, COTE), Image.LANCZOS)
        im.save(sortie, "WEBP", quality=80, method=4)
        # Petites icônes déjà compactes (ex. compétences de Rhino, PNG 128 px) : le WebP
        # pesait PLUS lourd (mesuré : page Rhino 8 → 10 Ko). Sans vignette, les pages
        # gardent l'original — le générateur ne pointe que vers les vignettes existantes.
        if os.path.getsize(sortie) >= os.path.getsize(os.path.join(src, f)):
            os.remove(sortie); plus_lourdes += 1
            continue
        avant += os.path.getsize(os.path.join(src, f)); apres += os.path.getsize(sortie); n += 1

print(f"✅ {n} vignettes ({plus_lourdes} écartées, plus lourdes que l'original) : {avant // 1024} Ko d'originaux (PNG/JPG) → {apres // 1024} Ko de WebP")
