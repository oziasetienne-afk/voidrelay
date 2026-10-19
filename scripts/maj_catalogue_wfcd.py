#!/usr/bin/env python3
# Catalogue des builds après une mise à jour du jeu (28/09/2026, Update 44 « Iceblade of Narin »).
#
# data/warframes.json, data/weapons.json et data/companions.json alimentent les 1 478 pages
# de builds (generer_builds.mjs), mais aucun script du dépôt ne les produisait : figés au
# 13/09, ils ignoraient Narin, Citrine Prime, les 4 armes de l'Update 44… et Haalvu
# (sortie en juillet 2026, jamais ajoutée).
#
# Ce script AJOUTE les objets absents, avec la correspondance de champs des entrées
# existantes — vérifiée : elle redonne à l'identique 71 Warframes sur 117 et 611 armes
# sur 658, les autres écarts étant des espaces ou de vraies évolutions du jeu. Il ne
# réécrit PAS les entrées existantes : WFCD a aussi des désaccords non tranchés (Hydroid :
# PV et boucliers inversés par rapport au site). Une entrée existante n'est rafraîchie
# que si on la nomme (--rafraichir), après avoir vérifié le changement dans les notes
# de mise à jour.
#
# Images : téléchargées dans assets/{frames,weapons,companions}/ (cdn.warframestat.us).
#
# Usage : python3 scripts/maj_catalogue_wfcd.py [--rafraichir "Banshee,Banshee Prime"] [--a-blanc]
#         puis python3 scripts/generer_vignettes.py && node scripts/generer_builds.mjs
import json
import os
import re
import sys
import urllib.request

RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WFCD = "https://raw.githubusercontent.com/WFCD/warframe-items/master/data/json/"
CDN = "https://cdn.warframestat.us/img/"
A_BLANC = "--a-blanc" in sys.argv
RAFRAICHIR = set()
if "--rafraichir" in sys.argv:
    RAFRAICHIR = {n.strip() for n in sys.argv[sys.argv.index("--rafraichir") + 1].split(",") if n.strip()}


def charger(nom):
    req = urllib.request.Request(WFCD + nom + ".json", headers={"User-Agent": "voidrelay-catalogue/1.0"})
    with urllib.request.urlopen(req, timeout=120) as r:
        return json.load(r)


def texte(s):
    # WFCD garde les balises de couleur (<DT_SLASH_COLOR>) et les variables (|DAMAGE|) du jeu ;
    # le site les retire et referme les espaces que ça laisse.
    s = re.sub(r"<[^>]+>", "", s or "")
    s = re.sub(r"\|[A-Z_0-9]+\|", "", s)
    return re.sub(r"\s+", " ", s).strip()


def warframe(x):
    return {"n": x["name"], "i": x.get("imageName"), "h": x.get("health"), "s": x.get("shield"),
            "ar": x.get("armor"), "e": x.get("power"), "spd": x.get("sprintSpeed"),
            "mr": x.get("masteryReq", 0), "prime": bool(x.get("isPrime")),
            "passive": texte(x.get("passiveDescription")),
            "ab": [a["name"] for a in x.get("abilities", [])], "desc": x.get("description")}


def arme(x):
    # Le site range les armes d'Archwing sous une seule catégorie « Archwing ».
    cat = "Archwing" if x["category"] in ("Arch-Gun", "Arch-Melee") else x["category"]
    return {"n": x["name"], "c": cat, "t": x.get("type"), "i": x.get("imageName"),
            "mr": x.get("masteryReq", 0), "d": 0}


def compagnon(x):
    k = "Sentinelle" if x.get("productCategory") == "Sentinels" else "Bête"
    return {"n": x["name"], "i": x.get("imageName"), "h": x.get("health"), "s": x.get("shield"),
            "ar": x.get("armor"), "mr": x.get("masteryReq", 0), "prime": bool(x.get("isPrime")),
            "k": k, "desc": x.get("description")}


CATALOGUES = [
    # (fichier, dossier d'images, sources WFCD, filtre, correspondance, ensure_ascii d'origine)
    ("warframes", "frames", ["Warframes"], lambda x: x.get("productCategory") == "Suits", warframe, False),
    ("weapons", "weapons", ["Primary", "Secondary", "Melee", "Arch-Gun", "Arch-Melee"],
     lambda x: "Component" not in (x.get("type") or ""), arme, True),
    # Moas et Hounds (modulaires) n'ont ni PV ni catégorie propre dans WFCD : les 7 du site ont
    # été saisis à la main, ce filtre ne les voit pas et n'en ajoutera pas de nouveaux.
    ("companions", "companions", ["Pets", "Sentinels"],
     lambda x: x.get("productCategory") in ("KubrowPets", "Sentinels") and x.get("health"), compagnon, False),
]

bilan = []
for fichier, dossier, sources, filtre, conv, ascii_ in CATALOGUES:
    chemin = os.path.join(RACINE, "data", fichier + ".json")
    actuel = json.load(open(chemin, encoding="utf-8"))
    index = {e["n"]: i for i, e in enumerate(actuel)}
    wfcd = [x for src in sources for x in charger(src) if filtre(x)]
    ajouts, rafraichis = [], []
    for x in wfcd:
        e = conv(x)
        if e["n"] not in index:
            actuel.append(e); ajouts.append(e)
        elif e["n"] in RAFRAICHIR and actuel[index[e["n"]]] != e:
            actuel[index[e["n"]]] = e; rafraichis.append(e["n"])
    for e in ajouts:
        img = e.get("i")
        dest = os.path.join(RACINE, "assets", dossier, img or "")
        if img and not os.path.exists(dest) and not A_BLANC:
            req = urllib.request.Request(CDN + img, headers={"User-Agent": "voidrelay-catalogue/1.0"})
            with urllib.request.urlopen(req, timeout=120) as r, open(dest, "wb") as f:
                f.write(r.read())
    actuel.sort(key=lambda e: e["n"])
    if not A_BLANC:
        with open(chemin, "w", encoding="utf-8") as f:
            f.write(json.dumps(actuel, ensure_ascii=ascii_, separators=(",", ":")))
    bilan.append(f"{fichier}: +{len(ajouts)} {[e['n'] for e in ajouts]}"
                 + (f", rafraîchis {rafraichis}" if rafraichis else ""))

print(("(à blanc) " if A_BLANC else "") + "✅ " + " · ".join(bilan))
