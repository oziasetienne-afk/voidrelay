# Audit du marché — 21/10/2026

Comparaison des 124 objets de `data/market.json` aux ordres **en direct** de warframe.market
(API publique v2, plateforme PC, vendeurs **en jeu**, **même rang** que le snapshot, 0,4 s entre
deux appels). Outil : `python3 scripts/auditer_prix_marche.py` (relançable, `--sauver` / `--depuis`).
Seuil d'écart : > 15 % ou > 5 platine, sur le plus bas ou sur la médiane.

## Résultat en une ligne

Avant correctif, snapshot de 2 h 44 : **39 écarts / 124**. Après correctif, snapshot régénéré
localement et relu 2 à 3 min plus tard : **10 écarts / 124**, tous = rotation des vendeurs en jeu sur
un marché mince (5 à 10 vendeurs au rang max). Aucun objet mal identifié, aucun rang faux, aucun
vendeur hors ligne compté.

## Causes trouvées

| Cause | Constat | Correctif |
|---|---|---|
| **Mise à jour en retard** | Snapshot 21:40, cron de 23:17 non livré à 00:24 (GitHub retarde : 3 h 46 à 6 h 46 mesurés). C'est la cause de 35 des 39 écarts. | Pas de code à corriger côté prix. Les pages mentaient sur la cadence (« chaque jour », seuil « en retard » 26 h) : textes → « toutes les 2 h », seuil → 8 h (CLAUDE.md), le garde-fou de cadence attrape désormais « chaque jour / daily » (8 pages en échec avant correction). |
| **Offre isolée** (valeur aberrante) | `minSellPlat` = UNE offre. Lex Prime Set : 7, 8, 8 puis **3 p** (2ᵉ offre à 5, 3ᵉ à 9) → « −62 % », tête des baisses de /bons-plans, « meilleur farm de ducats » du Hub à 18,3 ducats/plat ; 3 h plus tard : 11,0. Gauss Prime « +43 % » (35 → 50) pendant que la médiane faisait 50 → 55. Sur 6 703 couples J/J-1 de l'historique : 707 alertes sur le plus bas, dont **258 (36 %) avec une médiane immobile**. | Variations 24 h / 7 j, alertes, movers, sparkline et `ducatsPerPlat` se calculent sur la **médiane des 5 offres les plus basses** (déjà présente sur chaque point d'historique : aucun trou « n.d. »). `minSellPlat` reste publié comme prix d'achat immédiat. Le profil ducatier de /marche-profils lit la même médiane (il achète plusieurs sets). |
| **Rang** | 0 écart : le rang du snapshot est celui qu'on choisirait aujourd'hui pour les 124 objets. 4 mods ordinaires restent cotés au rang 0 (règle « suivi ») : Fleeting Expertise, Blood Rush, Condition Overload, Bladed Rounds. | Rien (décision admin en attente, PASSATION #11). /marche affiche maintenant le rang (R5, R10) comme /hub et /bons-plans. |
| **Vendeurs hors ligne** | Jamais comptés (garde-fou `verifier_prix_rangs.py`). 17 objets ont une offre **« en ligne » hors jeu** moins chère que le plus bas en jeu (1 à 5 p d'écart, Zakti Prime 35 vs 55) : warframe.market l'affiche, le site l'exclut. | Rien : on ne peut pas acheter maintenant à un joueur hors jeu. Signalé par l'audit (« en ligne hors jeu à N (exclu) »). |
| **Objet mal identifié** | 0 : 124/124 dans le catalogue, tags cohérents. | Les pages FR fabriquaient le nom depuis le slug (« ash prime set », « Primed Flow »). Le pipeline pose `nom` / `nomFr` depuis le catalogue (`data/items.json`, `data/arcanes.json`, `data/arsenal/mods.json`) ; /hub, /marche, /bons-plans, /marche-profils les lisent (Primed Flow → Flux Accru Prime, Arcane Energize → Arcane Énergétique). Garde-fou `verifier_noms_marche.py`. |

## Classements avant / après (mêmes données du 20/10, nouveau calcul)

| Classement | Avant (plus bas) | Après (médiane) |
|---|---|---|
| Meilleur ducats/platine | Lex Prime Set 18,33 (une offre à 3 p) | Orthos Prime Set 11,54 · Paris Prime 11,5 · Braton Prime 11,0 |
| Plus fortes hausses 24 h | Gauss +43 %, Braton +43 %, Magnus +23 % | Arcane Bénédiction +82 %, Armement du Vigile +60 % (marchés minces au rang 5, médiane 33 → 60) |
| Plus fortes baisses 24 h | Lex −62 %, Fang −22 %, Paris −20 % | Blessures Suintantes −40 %, Viseur à Argon −29 % |
| Alertes (≥ 15 %) | 10, dont Lex, Gauss, Braton fabriquées par une offre isolée | 8, toutes avec une médiane qui a vraiment bougé |

## Tableau des écarts — AVANT (snapshot 20/10 21:40, direct 21/10 00:24)

| Objet | Rang | Plus bas (snapshot → direct) | Médiane (snapshot → direct) | Cause |
|---|---|---|---|---|
| Nekros Prime Set | — | 90 → 98 | 99 → 98 | en ligne hors jeu à 95 (exclu) ; retard (snapshot de 2.7 h) |
| Nidus Prime Set | — | 80 → 78 | 89 → 79 | retard (snapshot de 2.7 h) |
| Nyx Prime Set | — | 52 → 60 | 58 → 60 | en ligne hors jeu à 58 (exclu) ; retard (snapshot de 2.7 h) |
| Saryn Prime Set | — | 75 → 65 | 78 → 70 | retard (snapshot de 2.7 h) |
| Volt Prime Set | — | 66 → 60 | 68 → 65 | retard (snapshot de 2.7 h) |
| Wukong Prime Set | — | 67 → 70 | 68 → 74 | retard (snapshot de 2.7 h) |
| Braton Prime Set | — | 10 → 7 | 10 → 9 | retard (snapshot de 2.7 h) |
| Latron Prime Set | — | 72 → 70 | 80 → 73 | retard (snapshot de 2.7 h) |
| Vectis Prime Set | — | 120 → 135 | 139 → 140 | retard (snapshot de 2.7 h) |
| Baza Prime Set | — | 60 → 49 | 65 → 52 | retard (snapshot de 2.7 h) |
| Lex Prime Set | — | 3 → 5 | 9 → 9 | offre isolée (snapshot [3, 5, 9, 9, 10]) ; offre isolée (direct [5, 7, 9, 9, 10]) ; retard (snapshot de 2.7 h) |
| Vasto Prime Set | — | 20 → 24 | 25 → 25 | retard (snapshot de 2.7 h) |
| Aklex Prime Set | — | 27 → 32 | 35 → 33 | retard (snapshot de 2.7 h) |
| Aksomati Prime Set | — | 85 → 79 | 85 → 85 | retard (snapshot de 2.7 h) |
| Magnus Prime Set | — | 48 → 42 | 50 → 44 | retard (snapshot de 2.7 h) |
| Spira Prime Set | — | 94 → 100 | 100 → 105 | retard (snapshot de 2.7 h) |
| Ballistica Prime Set | — | 99 → 110 | 105 → 114 | retard (snapshot de 2.7 h) |
| Bo Prime Set | — | 75 → 65 | 76 → 68 | retard (snapshot de 2.7 h) |
| Kronen Prime Set | — | 115 → 109 | 120 → 110 | retard (snapshot de 2.7 h) |
| Arcane Énergétique | R5 | 120 → 130 | 130 → 130 | retard (snapshot de 2.7 h) |
| Arcane Grâce | R5 | 99 → 115 | 120 → 135 | en ligne hors jeu à 100 (exclu) ; retard (snapshot de 2.7 h) |
| Arcane Gardien | R5 | 43 → 50 | 45 → 55 | retard (snapshot de 2.7 h) |
| Duplication de Mêlée | R5 | 135 → 135 | 180 → 170 | retard (snapshot de 2.7 h) |
| Magus Réparation | R5 | 80 → 90 | 100 → 94 | retard (snapshot de 2.7 h) |
| Arcane Vélocité | R5 | 160 → 170 | 175 → 195 | retard (snapshot de 2.7 h) |
| Arcane Vengeance | R5 | 65 → 80 | 80 → 90 | retard (snapshot de 2.7 h) |
| Arcane Bénédiction | R5 | 24 → 40 | 33 → 50 | retard (snapshot de 2.7 h) |
| Continuité Accrue Prime | R10 | 76 → 109 | 100 → 110 | offre isolée (snapshot [76, 100, 100, 105, 105]) ; retard (snapshot de 2.7 h) |
| Flux Accru Prime | R10 | 90 → 100 | 90 → 100 | en ligne hors jeu à 90 (exclu) ; retard (snapshot de 2.7 h) |
| Atteinte Accrue Prime | R10 | 80 → 90 | 90 → 95 | retard (snapshot de 2.7 h) |
| Courage Passager | R10 | 70 → 65 | 73 → 65 | retard (snapshot de 2.7 h) |
| Expertise Éphémère | R0 | 6 → 7 | 8 → 8 | retard (snapshot de 2.7 h) |
| Super-Étendu | R5 | 24 → 25 | 31 → 25 | en ligne hors jeu à 20 (exclu) ; retard (snapshot de 2.7 h) |
| Blessures Suintantes | R5 | 25 → 29 | 50 → 45 | retard (snapshot de 2.7 h) |
| Surcharge d'État | R0 | 6 → 9 | 8 → 10 | retard (snapshot de 2.7 h) |
| Chambre Galvanisée | R10 | 46 → 54 | 54 → 69 | retard (snapshot de 2.7 h) |
| Armement du Vigile | R5 | 10 → 12 | 15 → 24 | retard (snapshot de 2.7 h) |
| Viseur à Argon | R5 | 10 → 10 | 14 → 10 | retard (snapshot de 2.7 h) |
| Nuée de Dards | R10 | 40 → 55 | 70 → 60 | retard (snapshot de 2.7 h) |

## Tableau des écarts — APRÈS (snapshot régénéré 21/10 00:42, direct 00:42–00:45)

| Objet | Rang | Plus bas (snapshot → direct) | Médiane (snapshot → direct) | Cause |
|---|---|---|---|---|
| Vectis Prime Set | — | 135 → 125 | 140 → 135 | rotation des vendeurs en jeu |
| Vasto Prime Set | — | 25 → 25 | 25 → 29 | rotation des vendeurs en jeu |
| Zakti Prime Set | — | 43 → 55 | 55 → 59 | en ligne hors jeu à 35 (exclu) |
| Spira Prime Set | — | 100 → 100 | 109 → 100 | rotation des vendeurs en jeu |
| Ballistica Prime Set | — | 100 → 100 | 110 → 100 | rotation des vendeurs en jeu |
| Tipedo Prime Set | — | 60 → 69 | 70 → 70 | rotation des vendeurs en jeu |
| Arcane Énergétique | R5 | 130 → 124 | 132 → 130 | rotation des vendeurs en jeu |
| Arcane Égide | R5 | 130 → 130 | 130 → 145 | rotation des vendeurs en jeu |
| Arcane Vélocité | R5 | 155 → 155 | 180 → 195 | rotation des vendeurs en jeu |
| Salves de Lames | R0 | 14 → 14 | 23 → 15 | rotation des vendeurs en jeu |

## Ce qui n'a pas été fait

- Les données régénérées localement ne sont **pas commitées** : `nom` / `nomFr` et les variations sur la
  médiane arrivent à la première passe du robot après fusion (`warframe-hub-update.yml`). D'ici là, les
  pages retombent sur le nom EN dérivé du slug — comme avant.
- Règle de rang des mods ordinaires et vendeurs « en ligne » hors jeu : inchangés, à trancher par l'admin.
- Générateurs de builds et déploiement : non touchés.
