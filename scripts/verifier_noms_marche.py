#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Garde-fou : les noms du marché viennent du catalogue, jamais du slug.

Jusqu'au 21/10/2026, /hub écrivait « ash prime set » et /marche, /bons-plans
« Primed Flow » sur des pages françaises : le nom était fabriqué par le code
depuis le slug. Les noms du jeu existent pourtant dans le dépôt
(data/items.json, data/arcanes.json, data/arsenal/mods.json) ; le pipeline les
pose désormais sur chaque objet (`nom`, `nomFr`) et les pages les lisent.

Ce fichier vérifie trois choses : chaque objet suivi a un nom dans le
catalogue ; chaque mod et arcane suivi a son nom FRANÇAIS ; un slug inconnu ne
reçoit AUCUN nom (rien n'est inventé). Et que les pages lisent bien `nomFr`.
Mis en échec avant branchement : « primed_fury » (hors catalogue) rougit.

    python3 scripts/verifier_noms_marche.py
"""
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
RACINE = os.path.dirname(HERE)
DATA = os.path.join(RACINE, "data")
sys.path.insert(0, HERE)
from update_warframe_data import attacher_noms, load_config, noms_catalogue  # noqa: E402

OK = KO = 0


def dit(cond, titre, detail=""):
    global OK, KO
    if cond:
        OK += 1
        print("  ✓ %s%s" % (titre, " — " + detail if detail else ""))
    else:
        KO += 1
        print("  ✗ %s%s" % (titre, " — " + detail if detail else ""))


noms = noms_catalogue(DATA)
suivis = load_config()["market_watchlist"]
dit(len(noms) > 3000, "le catalogue est chargé", "%d noms" % len(noms))

print("chaque objet suivi a son nom du catalogue")
manquants = [s for s in suivis if s not in noms]
dit(not manquants, "%d objets suivis, tous dans data/items.json" % len(suivis), ", ".join(manquants))

print("chaque mod / arcane suivi a son nom français")
a_rang = [s for s in suivis if not s.endswith("_set")]
sans_fr = [s for s in a_rang if not (noms.get(s) or {}).get("nomFr")]
dit(not sans_fr, "%d mods et arcanes, tous nommés en français" % len(a_rang), ", ".join(sans_fr))
dit(all((noms.get(s) or {}).get("nomFr") != s.replace("_", " ").title() for s in a_rang),
    "aucun nom français n'est la simple mise en forme du slug")
dit((noms.get("primed_flow") or {}).get("nomFr") == "Flux Accru"
    and (noms.get("arcane_energize") or {}).get("nomFr") == "Arcane Énergétique",
    "Primed Flow → Flux Accru (noms_fr.json, pas « Flux Accru Prime »), Arcane Energize → Arcane Énergétique")
# UNE seule source FR sur le site : les noms du marché sont ceux de data/noms_fr.json.
with open(os.path.join(DATA, "noms_fr.json"), encoding="utf-8") as fh:
    off = json.load(fh)
off_par_en = dict(off.get("mods") or {})
off_par_en.update(off.get("arcanes") or {})
divergents = [s for s in a_rang if noms[s]["nom"] in off_par_en
              and noms[s].get("nomFr") != off_par_en[noms[s]["nom"]]]
dit(not divergents, "aucun nom FR du marché ne diverge de data/noms_fr.json", ", ".join(divergents))

print("rien n'est inventé")
m = attacher_noms({"items": [{"slug": "objet_qui_n_existe_pas"}, {"slug": "ash_prime_set"}]}, noms)
dit("nom" not in m["items"][0] and "nomFr" not in m["items"][0],
    "un slug hors catalogue reste SANS nom", "la page montrera le slug, pas un nom fabriqué")
dit(m["items"][1].get("nom") == "Ash Prime Set" and "nomFr" not in m["items"][1],
    "un set Prime garde son nom de catalogue (identique en français)")

print("les pages lisent le nom du catalogue")
for f in ("hub.html", "marche.html", "js/deals.js", "js/marche-profils.js"):
    with open(os.path.join(RACINE, f), encoding="utf-8") as fh:
        # dans le code, pas seulement dans un commentaire : « .nomFr » est un accès au champ
        dit(re.search(r"\.nomFr\b", fh.read()) is not None, "%s lit le champ nomFr" % f)

print("-" * 70)
if KO:
    print("❌ %d échec(s) sur %d" % (KO, OK + KO))
    sys.exit(1)
print("\U0001f6e1️  GARDE-FOU : les noms du marché viennent du catalogue — %d vérifications OK." % OK)
