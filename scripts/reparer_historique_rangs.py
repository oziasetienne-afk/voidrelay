#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Réaligne data/market_history.json sur le RANG que le pipeline retient.

POURQUOI CE SCRIPT EXISTE. Le correctif des rangs (04/09/2026) a changé l'objet
que `market.json` décrit pour 33 objets à rangs : Arcane Energize n'y est plus
le rang 0 à 9 platine mais le rang 5 à 149. L'historique, lui, contenait encore
des points écrits par l'ancien code — donc au rang 0.

Sans réparation, la PREMIÈRE passe du pipeline corrigé aurait écrit 149 juste
après une série de 9, et les graphes 90 jours auraient montré une explosion de
prix qui n'a jamais eu lieu. Mesuré avant réparation : 21 objets sur 33
concernés, jusqu'à ×20 (Melee Duplicate : 9 → 180).

Le dégât ne serait pas resté sur les graphes : `enrich_market_items` calcule
change24h depuis cet historique, et /bons-plans titre les plus fortes hausses.
Le site aurait donc annoncé « +1900 % sur Melee Duplicate » comme bon plan du
jour. Un chiffre faux qui se propage en conseil.

CE QU'IL FAIT : pour chaque objet à rang, il relit les 90 jours de statistiques
et ne garde que les seaux DU RANG RETENU, puis réécrit la série. Passé et futur
décrivent alors le même objet.

    python3 scripts/reparer_historique_rangs.py [--dry]
"""
import json
import os
import sys
import time
import urllib.request

RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(RACINE, "data")
MK1 = "https://api.warframe.market/v1"


def lire(nom):
    with open(os.path.join(DATA, nom), encoding="utf-8") as f:
        return json.load(f)


def stats90(slug):
    url = "%s/items/%s/statistics" % (MK1, slug)
    req = urllib.request.Request(url, headers={
        "Platform": "pc", "Accept": "application/json", "User-Agent": "VoidRelay/1.0"})
    for essai in range(3):
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                d = json.loads(r.read())
            c = (d.get("payload") or {}).get("statistics_closed") or {}
            return (c.get("90days") or []) + (c.get("48hours") or [])
        except Exception:
            if essai == 2:
                return []
            time.sleep(2 ** essai)
    return []


def main():
    sec = "--dry" in sys.argv
    marche = lire("market.json")
    hist = lire("market_history.json")
    ranges = {it["slug"]: it["rang"] for it in marche.get("items", []) if it.get("rang") is not None}
    print("objets à rangs : %d" % len(ranges))

    change = 0
    for slug, rang in sorted(ranges.items()):
        seaux = stats90(slug)
        # Un seau sans rang ne concerne pas un objet à rangs : on l'ignore
        # plutôt que de le mélanger — c'est exactement l'erreur qu'on répare.
        dans = [b for b in seaux if b.get("mod_rank") == rang and b.get("median")]
        if not dans:
            print("  ⚠ %-26s aucun seau au rang %s — série laissée telle quelle"
                  % (slug, rang))
            continue
        parJour = {}
        for b in dans:
            j = str(b.get("datetime") or "")[:10]
            if not j:
                continue
            # Dernier relevé du jour, comme le fait le pipeline.
            # r : depuis le 20/10/2026, un point d'objet à rangs sans r est retiré
            # par le pipeline. ATTENTION : ces points sont des ÉCHANGES conclus
            # (min_price), le pipeline écrit des ORDRES de vente en jeu ; un
            # change24h à cheval sur les deux compare deux mesures voisines, pas
            # identiques. Ne relancer qu'en connaissance de cause.
            parJour[j] = {"d": j, "median": round(b["median"], 1), "r": rang,
                          "min": round(b.get("min_price") or b["median"], 1)}
        serie = [parJour[j] for j in sorted(parJour)][-90:]
        if not serie:
            continue
        avant = (hist.get(slug) or [{}])[-1].get("median")
        hist[slug] = serie
        apres = serie[-1]["median"]
        if avant != apres:
            change += 1
            print("  %-26s rang %-3s  %s → %s  (%d points)"
                  % (slug, rang, avant, apres, len(serie)))
        time.sleep(0.4)

    if sec:
        print("\n--dry : rien n'a été écrit (%d séries auraient changé)" % change)
        return 0
    with open(os.path.join(DATA, "market_history.json"), "w", encoding="utf-8") as f:
        json.dump(hist, f, ensure_ascii=False, separators=(",", ":"), sort_keys=True)
        f.write("\n")
    print("\nmarket_history.json réécrit — %d séries réalignées" % change)
    return 0


if __name__ == "__main__":
    sys.exit(main())
