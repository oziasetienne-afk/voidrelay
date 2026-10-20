#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Garde-fou du calcul de prix : vendeurs en jeu, et UN SEUL RANG à la fois.

Le défaut que ce fichier existe pour empêcher est passé inaperçu longtemps
parce qu'il ne casse rien : la page s'affiche, le chiffre est absurde. Arcane
Steadfast se vendait 10 platine au rang 0 pendant que des joueurs en
demandaient 840 au rang 5 — le site en déduisait une marge de 830 platine sur
un objet que personne ne peut acheter à 10 pour revendre à 840. Ce ne sont pas
le même objet.

    python3 scripts/verifier_prix_rangs.py
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from update_warframe_data import _choisir_rang, _prix_ordres, _rang_marchand  # noqa: E402

OK = KO = 0


def dit(cond, titre, detail=""):
    global OK, KO
    if cond:
        OK += 1
        print("  ✓ %s%s" % (titre, " — " + detail if detail else ""))
    else:
        KO += 1
        print("  ✗ %s%s" % (titre, " — " + detail if detail else ""))


def o(t, p, rang=None, statut="ingame"):
    d = {"type": t, "platinum": p, "user": {"status": statut}}
    if rang is not None:
        d["rank"] = rang
    return d


print("rang retenu")
# Arcane Steadfast, relevé réel du 03/09/2026 : 6 ventes au rang 0, 13 au rang 5.
steadfast = ([o("sell", 10, 0), o("sell", 10, 0), o("sell", 20, 0),
              o("sell", 60, 0), o("sell", 72, 0), o("sell", 78, 0)]
             + [o("sell", 120 + i, 5) for i in range(13)]
             + [o("buy", 840, 5), o("buy", 150, 5), o("buy", 150, 5),
                o("buy", 145, 5), o("buy", 15, 0)])
px = _prix_ordres(steadfast)
dit(px["rang"] == 5, "le rang le plus vendu l'emporte", "13 ventes au rang 5 contre 6 au rang 0")
dit(px["minSellPlat"] == 120, "la vente la plus basse est celle DU rang retenu", "120, pas 10")
dit(px["sellOrders"] == 13, "seules les ventes du rang retenu sont comptées")
dit(px["maxBuyPlat"] == 840 and px["high5BuyPlat"][1] == 150,
    "les achats aussi sont filtrés sur le rang, et le deuxième est gardé",
    "l'achat isolé à 840 ne cache plus le vrai marché à 150")
dit(px["maxBuyPlat"] - px["minSellPlat"] == 720 and 840 - 10 == 830,
    "la fausse marge de 830 platine a disparu", "le calcul reste dans un seul rang")

# Sans rang imposé (pièces de set) : le rang le plus vendu, un rang 1 isolé écarté.
flow = ([o("sell", 35, 1)] + [o("sell", 38 + i, 0) for i in range(32)]
        + [o("sell", 200 + i, 10) for i in range(30)]
        + [o("buy", 36, 10), o("buy", 15, 0)])
px = _prix_ordres(flow)
dit(px["rang"] == 0, "sans rang imposé, à 32 ventes contre 30, le rang 0 l'emporte",
    "rang retenu : %s" % px["rang"])
dit(px["minSellPlat"] == 38, "le rang 1 isolé ne tire pas le prix vers le bas", "38, pas 35")
dit(px["maxBuyPlat"] == 15, "l'achat au rang 10 n'est pas comparé à une vente au rang 0")

print("règle de rang (20/10/2026)")
# Le défaut : à 32 contre 30 vendeurs, le rang « le plus vendu » basculait d'une
# passe à l'autre (relevé réel : la série de Primed Flow alternait 28, 99, 90, 33).
rang, regle = _choisir_rang("primed_flow", flow, ["mod", "legendary"], 10, 0)
dit((rang, regle) == (10, "max"), "un mod Primé est TOUJOURS coté au rang max",
    "rang %s (%s), même si le rang 0 a plus de vendeurs" % (rang, regle))
px = _prix_ordres(flow, rang)
dit(px["minSellPlat"] == 200 and px["maxBuyPlat"] == 36,
    "et tout le calcul reste dans ce rang", "200 / 36")
dit(_choisir_rang("arcane_energize", steadfast, ["arcane_enhancement"], 5, 0)[0] == 5,
    "un arcane aussi, quel que soit le rang de la passe précédente")
dit(_choisir_rang("primed_reach", flow, None, None, 0) == (10, "max"),
    "fiche /v2/item indisponible : le plus haut rang vu dans les ordres",
    "Primed Reach n'est plus coté au rang 0")
dit(_choisir_rang("blind_rage", flow, ["mod"], 10, 10) == (10, "suivi"),
    "autre mod : le rang précédent est suivi tant qu'il a des vendeurs", "pas de bascule 0 ↔ 10")
dit(_choisir_rang("blind_rage", flow, ["mod"], 10, None) == (0, "plus-vendu"),
    "sans rang précédent : le rang le plus vendu")
dit(_choisir_rang("x_set", [o("sell", 5), o("buy", 4)], [], None, None) == (None, None),
    "un set n'a pas de rang")

print("objets sans rang")
sets = [o("sell", 78), o("sell", 79), o("sell", 80),
        o("buy", 65), o("buy", 60), o("buy", 50)]
px = _prix_ordres(sets)
dit(px["rang"] is None, "un set n'a pas de rang : aucun filtre appliqué")
dit(px["minSellPlat"] == 78 and px["maxBuyPlat"] == 65, "prix inchangés", "78 / 65")
dit(px["low5SellPlat"] == [78, 79, 80], "les cinq ventes les plus basses, triées")

print("vendeurs hors ligne")
mixte = [o("sell", 5, None, "offline"), o("sell", 50), o("buy", 40),
         o("buy", 900, None, "offline")]
px = _prix_ordres(mixte)
dit(px["minSellPlat"] == 50, "un vendeur hors ligne ne fixe pas le prix d'achat", "50, pas 5")
dit(px["maxBuyPlat"] == 40, "un acheteur hors ligne non plus", "40, pas 900")
dit(px["sellOrders"] == 1 and px["buyOrders"] == 1, "et il n'est pas compté dans le volume")

print("cas vides")
px = _prix_ordres([])
dit(px["minSellPlat"] is None and px["maxBuyPlat"] is None and px["sellOrders"] == 0,
    "aucun ordre : des None, jamais des zéros", "un zéro passerait pour un prix")
dit(_rang_marchand([]) is None, "aucune vente : aucun rang retenu")

print("-" * 70)
if KO:
    print("❌ %d échec(s) sur %d" % (KO, OK + KO))
    sys.exit(1)
print("\U0001f6e1️  GARDE-FOU : le calcul de prix tient — %d vérifications OK." % OK)
