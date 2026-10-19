#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Garde-fou : la SÉRIE et le PRIX COURANT doivent décrire le même objet.

Ce garde-fou ne surveille pas les prix — il surveille qu'on ne change pas
d'objet en cours de route. Sur un objet à rangs, « Arcane Energize » désigne
deux choses très différentes selon le rang : 9 platine au rang 0, 149 au rang 5.
Le jour où le pipeline change de rang retenu sans que l'historique suive, la
série montre une explosion qui n'a jamais eu lieu — et comme change24h en
découle, /bons-plans titre un « bon plan » fabriqué.

C'est arrivé le 04/09/2026 : le correctif des rangs a mis 21 objets sur 33 en
écart, jusqu'à ×20 (Melee Duplicate : 9 → 180). Réparé par
scripts/reparer_historique_rangs.py, qui réaligne la série sur le rang retenu.

LE SEUIL. Un écart de ×3 entre le dernier point et le prix courant n'est pas un
mouvement de marché : c'est un changement d'objet. Le pire écart légitime
mesuré après réparation est ×1,47, et il s'explique — la série porte des
médianes d'ÉCHANGES, market.json des ordres de VENTE, deux mesures voisines
mais pas identiques. Trois laisse donc de la marge à la volatilité réelle tout
en attrapant un basculement de rang, qui commence à ×8.

    python3 scripts/verifier_historique_coherent.py
"""
import json
import os
import sys

RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(RACINE, "data")
SEUIL = 3.0


def lire(nom):
    p = os.path.join(DATA, nom)
    if not os.path.isfile(p):
        return None
    with open(p, encoding="utf-8") as f:
        return json.load(f)


def main():
    marche = lire("market.json")
    hist = lire("market_history.json")
    if not marche or not hist:
        print("  · market.json ou market_history.json absent — rien à vérifier")
        return 0

    fautifs, verifies = [], 0
    for it in marche.get("items", []):
        slug = it.get("slug")
        med = it.get("median")
        serie = hist.get(slug) or []
        if not med or not serie:
            continue
        der = (serie[-1] or {}).get("median")
        if not der:
            continue
        verifies += 1
        ecart = max(med, der) / max(0.1, min(med, der))
        if ecart >= SEUIL:
            fautifs.append((slug, der, med, ecart, it.get("rang")))

    if fautifs:
        print("  ✗ %d objet(s) dont la série et le prix courant ne décrivent PAS "
              "le même objet :" % len(fautifs))
        for slug, der, med, ecart, rang in sorted(fautifs, key=lambda x: -x[3])[:10]:
            print("      %-26s historique %-8s vs marché %-8s  ×%.1f%s"
                  % (slug, der, med, ecart,
                     "  (rang retenu : %s)" % rang if rang is not None else ""))
        print("    → si le rang retenu a changé, relance :")
        print("      python3 scripts/reparer_historique_rangs.py")
        return 1

    print("  ✓ série et prix courant cohérents sur %d objets (écart max toléré : ×%.0f)"
          % (verifies, SEUIL))
    return 0


if __name__ == "__main__":
    sys.exit(main())
