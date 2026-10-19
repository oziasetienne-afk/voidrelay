#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Construit data/set_pieces.json : pour chaque SET suivi, ses pièces et leur NOMBRE.

Pourquoi un fichier à part, régénéré à la main plutôt qu'à chaque passe ?
La composition d'un set est de la donnée de JEU : elle ne bouge que quand
Digital Extremes sort une nouvelle Prime. Les PRIX bougent toutes les heures ;
la recette, non. Les séparer évite de retélécharger 5 Mo de composants six fois
par jour pour un fichier qui ne change pas.

Deux pièges que ce script existe pour fermer :

1. LE NOMBRE. Akbolto Prime demande 2 canons et 2 récepteurs, pas 1 de chaque.
   Sommer bêtement le prix des pièces sous-estime le coût de ~145 platine et
   ferait passer un set perdant pour une bonne affaire. `itemCount` de
   warframestat porte cette information ; on la garde.

2. LES SETS IMBRIQUÉS. Aklex Prime ne demande pas des « pièces » de Lex Prime :
   il demande DEUX Lex Prime ENTIÈRES, plus un lien et un plan. Le composant
   est donc lui-même un set (`lex_prime_set`). Même chose pour Akbronco Prime.
   Sans ce cas, quatre pièces sur 338 restent introuvables — et les deux sets
   concernés afficheraient un coût faux, pas un coût manquant.

Sources : api.warframestat.us (/warframes et /weapons, champ `components`)
et data/wm_catalog.json (les slugs réellement connus de warframe.market).
"""

import json
import os
import re
import sys
import time
import urllib.request

RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(RACINE, "data")
WFS = "https://api.warframestat.us"


def lire(nom):
    with open(os.path.join(DATA, nom), encoding="utf-8") as f:
        return json.load(f)


def telecharge(endpoint):
    url = "%s/%s/?language=en&only=name,components" % (WFS, endpoint)
    req = urllib.request.Request(url, headers={"Accept": "application/json",
                                               "User-Agent": "VoidRelay/1.0"})
    for essai in range(4):
        try:
            with urllib.request.urlopen(req, timeout=90) as r:
                return json.loads(r.read().decode("utf-8"))
        except Exception as e:
            if essai == 3:
                raise
            time.sleep(2 ** essai)
    return []


def norm(s):
    return re.sub(r"[^a-z0-9]+", "_", str(s).lower()).strip("_")


def nom_du_set(slug_set):
    """ash_prime_set -> « Ash Prime » (le nom tel que warframestat le donne)."""
    return " ".join(w.capitalize() for w in slug_set[:-4].split("_"))


def resout(base, composant, slugs):
    """Slug warframe.market d'un composant, ou None.

    Trois formes, essayées dans cet ordre :
      base_piece            (canon d'arme : akbolto_prime_barrel)
      base_piece_blueprint  (partie de Warframe : ash_prime_chassis_blueprint)
      piece_set             (set imbriqué : Lex Prime -> lex_prime_set)
    """
    c = norm(composant)
    for essai in ("%s_%s" % (base, c), "%s_%s_blueprint" % (base, c), "%s_set" % c):
        if essai in slugs:
            return essai
    return None


def construis(sets_suivis, composants, slugs):
    sortie, orphelins = {}, []
    for slug in sets_suivis:
        base = slug[:-4]
        liste = composants.get(nom_du_set(slug))
        if not liste:
            orphelins.append((slug, "aucun composant chez warframestat"))
            continue
        pieces = {}
        for c in liste:
            # Une pièce non échangeable (ressource, cellule Orokin…) ne s'achète
            # pas sur le marché : la compter fausserait le coût du montage.
            if not c.get("tradable"):
                continue
            cible = resout(base, c.get("name"), slugs)
            if not cible:
                orphelins.append((slug, c.get("name")))
                continue
            # Aklex Prime liste « Lex Prime » DEUX FOIS à itemCount 1 : on somme.
            p = pieces.setdefault(cible, {"slug": cible, "nom": c.get("name"), "n": 0})
            p["n"] += int(c.get("itemCount") or 1)
            if c.get("ducats"):
                p["ducats"] = c["ducats"]
            if cible.endswith("_set"):
                p["imbrique"] = True
        if pieces:
            sortie[slug] = {"nom": nom_du_set(slug),
                            "pieces": sorted(pieces.values(), key=lambda p: p["slug"])}
    return sortie, orphelins


def main():
    slugs = {c["slug"] for c in lire("wm_catalog.json")}
    marche = lire("market.json")
    sets_suivis = [i["slug"] for i in marche.get("items", []) if i["slug"].endswith("_set")]

    composants = {}
    for endpoint in ("warframes", "weapons"):
        for x in telecharge(endpoint):
            nom = x.get("name")
            if nom and x.get("components"):
                composants.setdefault(nom, x["components"])

    sets, orphelins = construis(sets_suivis, composants, slugs)
    total_pieces = sum(len(s["pieces"]) for s in sets.values())
    distinctes = {p["slug"] for s in sets.values() for p in s["pieces"]}

    with open(os.path.join(DATA, "set_pieces.json"), "w", encoding="utf-8") as f:
        json.dump({"generated": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                   "source": "warframestat components (itemCount) + wm_catalog",
                   "sets": sets}, f, ensure_ascii=False, indent=1, sort_keys=True)
        f.write("\n")

    # v70 — LES SETS IMBRIQUÉS, dans un fichier minuscule à part.
    # warframe.market modélise « Aklex Prime Set » comme plan + lien : les DEUX
    # LEX PRIME entières n'en font pas partie pour lui, parce qu'elles se
    # vendent comme leur propre objet. Son API /item/<slug>/set ne les renvoie
    # donc pas — et un comparatif pièces/set bâti dessus conseille d'acheter
    # six platine de pièces pour une arme qu'on n'aura pas.
    # Ce fichier ne sert qu'à DIRE que la comparaison est incomplète ; il pèse
    # quelques centaines d'octets et les pages objet ne le chargent que sur un
    # set. Il se régénère tout seul le jour où DE sort une nouvelle arme double.
    imbriques = {}
    for slug, d in sets.items():
        manquantes = [p for p in d["pieces"] if p.get("imbrique")]
        if manquantes:
            imbriques[slug] = [{"slug": p["slug"], "nom": p.get("nom") or p["slug"], "n": p["n"]}
                               for p in manquantes]
    with open(os.path.join(DATA, "sets_imbriques.json"), "w", encoding="utf-8") as f:
        json.dump({"generated": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                   "note": "sets dont la recette de JEU contient une autre arme entière, "
                           "que warframe.market ne compte pas dans ses pieces",
                   "sets": imbriques}, f, ensure_ascii=False, indent=1, sort_keys=True)
        f.write("\n")

    print("sets   : %d / %d suivis" % (len(sets), len(sets_suivis)))
    print("pieces : %d lignes, %d slugs distincts à tarifer" % (total_pieces, len(distinctes)))
    if orphelins:
        print("orphelins (%d) :" % len(orphelins))
        for s, c in orphelins[:20]:
            print("   ✗ %s -> %s" % (s, c))
    return 0


if __name__ == "__main__":
    sys.exit(main())
