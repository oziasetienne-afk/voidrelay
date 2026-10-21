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
import calendar
import json
import os
import sys
import time

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
        rang = it.get("rang")
        serie = [p for p in hist.get(slug) or []
                 if (p.get("r") == rang if rang is not None else "r" not in p)]
        if not med or not serie:
            continue
        der = (serie[-1] or {}).get("median")
        if not der:
            continue
        verifies += 1
        ecart = max(med, der) / max(0.1, min(med, der))
        if ecart >= SEUIL:
            fautifs.append((slug, der, med, ecart, it.get("rang")))

    # 2) Les VARIATIONS et la sparkline d'un objet à rangs viennent de la série de
    #    SON rang. Le 20/10/2026, Primed Flow affichait spark [28, 30, 99, 90, 90,
    #    75, 33…] et « +65 % en 24 h » : le rang retenu basculait 0 ↔ 10 d'une
    #    passe à l'autre et rien ne le voyait, parce que le contrôle ci-dessus ne
    #    regarde que le DERNIER point. Depuis la PR #8, change24h se calcule sur la
    #    MÉDIANE du rang (et non plus sur le prix minimum) : on le recoupe donc
    #    avec median − médiane de la veille au même rang. Un saut ×3 entre deux points voisins d'une
    #    sparkline n'est pas un marché, c'est un changement d'objet.
    melanges = []
    for it in marche.get("items", []):
        rang = it.get("rang")
        if rang is None:
            continue
        sp = [v for v in (it.get("spark") or []) if isinstance(v, (int, float)) and v > 0]
        saut = max((max(a, b) / min(a, b) for a, b in zip(sp, sp[1:])), default=1)
        serie = [p for p in hist.get(it.get("slug")) or []
                 if p.get("r") == rang and isinstance(p.get("median"), (int, float))]
        motif = None
        if saut >= SEUIL:
            motif = "sparkline à rangs mêlés (saut ×%.1f)" % saut
        elif it.get("change24h") is not None:
            par_jour = {p["d"]: p["median"] for p in serie}
            veille = None
            if serie:
                t = time.strptime(serie[-1]["d"], "%Y-%m-%d")
                veille = par_jour.get(time.strftime(
                    "%Y-%m-%d", time.gmtime(calendar.timegm(t) - 86400)))
            if veille is None or round(it["change24h"], 1) != round(it.get("median") - veille, 1):
                motif = "change24h %s sans point de la veille au rang %s" % (it["change24h"], rang)
        if motif:
            melanges.append((it.get("slug"), motif))
    if melanges:
        print("  ✗ %d objet(s) à rangs dont les variations mélangent les rangs :" % len(melanges))
        for slug, motif in melanges[:10]:
            print("      %-26s %s" % (slug, motif))
        print("    → scripts/update_warframe_data.py doit calculer sur serie_du_rang()")
        return 1

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
