#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Audit : data/market.json contre les ordres EN DIRECT de warframe.market.

Pour chaque objet suivi, relit les ordres v2 (PC), applique LE MÊME calcul que
le pipeline (vendeurs en jeu, même rang : `_prix_ordres`) et compare le prix
le plus bas et la médiane au snapshot. Liste les écarts > 15 % ou > 5 platine,
avec la cause probable de chacun :

  retard        : le snapshot a plus de 2 h (cadence du cron) — les vendeurs en
                  jeu ont tourné depuis, c'est la cause ordinaire ;
  offre isolée  : le plus bas du snapshot ou du direct est seul (2e offre
                  ≥ 1,3 × la 1re) — un seul ordre, pas un marché ;
  rang          : le rang qu'on choisirait aujourd'hui n'est plus celui du
                  snapshot ;
  en ligne hors jeu : un vendeur « en ligne » sur le site mais pas en jeu est
                  moins cher que le plus bas en jeu — warframe.market l'affiche,
                  le pipeline l'exclut (on ne peut pas lui acheter maintenant) ;
  mal identifié : slug absent du catalogue ou famille inattendue.

Débit : 0,4 s après chacun des 2 appels par objet (≈ 2 à 3 min pour 124 objets),
3 tentatives au plus sur erreur réseau, 429 ou 5xx (un 404 est définitif). `--sauver f.json` garde les ordres bruts, `--depuis f.json` les
relit sans réseau. Sortie : tableau Markdown, et code 0 (l'audit informe, il
ne bloque pas : un écart de 3 h de marché n'est pas un défaut du code).

    python3 scripts/auditer_prix_marche.py [--sauver f.json | --depuis f.json]
"""
import argparse
import calendar
import json
import os
import sys
import time
import urllib.error
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from update_warframe_data import (DEFAULT_CONFIG, _choisir_rang, _median,  # noqa: E402
                                  _prix_ordres, noms_catalogue, read_json)

DATA = os.path.join(os.path.dirname(HERE), "data")
H = {"User-Agent": "voidrelay-audit/1.0", "Accept": "application/json",
     "Platform": "pc", "Language": "en"}


def get(url):
    err = None
    for i in range(3):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=H), timeout=25) as r:
                return json.loads(r.read().decode("utf-8")), None
        except urllib.error.HTTPError as e:
            err = "HTTPError: %s" % e.code
            if e.code != 429 and e.code < 500:
                return None, err      # 4xx définitif (slug inconnu) : inutile d'insister
        except Exception as e:  # réseau, JSON : on réessaie, puis on note l'erreur
            err = "%s: %s" % (type(e).__name__, e)
        if i < 2:
            time.sleep(2 * (i + 1))
    return None, err


def collecter(slugs):
    base = DEFAULT_CONFIG["market_base"].rstrip("/")
    out = {"collected_utc": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
           "orders": {}, "item": {}, "errors": {}}
    for n, s in enumerate(slugs, 1):
        d, e = get("%s/v2/orders/item/%s" % (base, s))
        if e:
            out["errors"][s] = e
        else:
            out["orders"][s] = d.get("data") or []
        time.sleep(0.4)
        d, e = get("%s/v2/item/%s" % (base, s))
        if not e:
            out["item"][s] = d.get("data") or {}
        time.sleep(0.4)
        print("  %3d/%d %s" % (n, len(slugs), s), file=sys.stderr)
    return out


def isole(low5):
    return len(low5) > 1 and low5[1] >= 1.3 * low5[0]


def epoch(iso):
    return calendar.timegm(time.strptime(iso, "%Y-%m-%dT%H:%M:%SZ"))


def ecart(a, b, pct=15, plat=5):
    if a is None or b is None:
        return a is not b
    return abs(a - b) > plat or (b and abs(a - b) * 100.0 / b > pct)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--sauver")
    ap.add_argument("--depuis")
    args = ap.parse_args()
    market = read_json(DATA, "market.json") or {}
    items = market.get("items") or []
    if args.depuis:
        with open(args.depuis, encoding="utf-8") as f:
            live = json.load(f)
    else:
        live = collecter([it["slug"] for it in items])
        if args.sauver:
            with open(args.sauver, "w", encoding="utf-8") as f:
                json.dump(live, f)
    noms = noms_catalogue(DATA)
    age_h = (epoch(live["collected_utc"]) - epoch(market.get("generated"))) / 3600.0 \
        if market.get("generated") else None
    lignes, n_ecarts = [], 0
    for it in items:
        s = it["slug"]
        o = live["orders"].get(s)
        if o is None:
            lignes.append((s, "—", "—", "—", "erreur réseau : %s" % live["errors"].get(s)))
            continue
        rang = it.get("rang")
        px = _prix_ordres(o, rang) if rang is not None else _prix_ordres(o)
        med = _median(px["low5SellPlat"])
        fiche = live["item"].get(s) or {}
        rang_auj, _ = _choisir_rang(s, o, fiche.get("tags"), fiche.get("maxRank"), rang, it.get("rangRegle"))
        if not (ecart(px["minSellPlat"], it.get("minSellPlat")) or ecart(med, it.get("median"))):
            continue
        n_ecarts += 1
        causes = []
        if rang != rang_auj:
            causes.append("rang (%s → %s)" % (rang, rang_auj))
        if s not in noms or not fiche.get("tags"):
            causes.append("mal identifié")
        if isole(it.get("low5SellPlat") or []):
            causes.append("offre isolée (snapshot %s)" % it.get("low5SellPlat"))
        if isole(px["low5SellPlat"]):
            causes.append("offre isolée (direct %s)" % px["low5SellPlat"])
        enl = [dict(x, user=dict(x["user"], status="ingame")) for x in o
               if (x.get("user") or {}).get("status") in ("ingame", "online")]
        px_enl = _prix_ordres(enl, rang) if rang is not None else _prix_ordres(enl)
        if px_enl["minSellPlat"] is not None and px["minSellPlat"] is not None \
                and px_enl["minSellPlat"] < px["minSellPlat"]:
            causes.append("en ligne hors jeu à %s (exclu)" % px_enl["minSellPlat"])
        if age_h is not None and age_h > 2:
            causes.append("retard (snapshot de %.1f h)" % age_h)
        if not causes:
            causes.append("rotation des vendeurs en jeu")
        nom = (noms.get(s) or {}).get("nomFr") or (noms.get(s) or {}).get("nom") or s
        lignes.append((nom, "R%s" % rang if rang is not None else "—",
                       "%s → %s" % (it.get("minSellPlat"), px["minSellPlat"]),
                       "%s → %s" % (it.get("median"), med), " ; ".join(causes)))
    print("Snapshot %s · direct %s · %d objets · %d écart(s) > 15 %% ou > 5 p" %
          (market.get("generated"), live["collected_utc"], len(items), n_ecarts))
    print()
    print("| Objet | Rang | Plus bas (snapshot → direct) | Médiane (snapshot → direct) | Cause |")
    print("|---|---|---|---|---|")
    for l in lignes:
        print("| " + " | ".join(str(x) for x in l) + " |")
    return 0


if __name__ == "__main__":
    sys.exit(main())
