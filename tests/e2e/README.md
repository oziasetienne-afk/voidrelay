# Banc d'essai e2e — VoidRelay

Tests navigateur (Playwright/Chromium) qui rejouent les parcours réels du site :
recherche et suggestions, pages outils, marché complet, repli API, Core Web Vitals.
Nés le 16/07/2026 pendant la grande passe navigation/synchronicité/performance —
consolidés ici pour que toute session future puisse re-vérifier avant de toucher.

## Prérequis

- `python3` + `pip install playwright` (Chromium : `playwright install chromium`,
  ou un Chromium déjà présent — voir variables ci-dessous).
- Aucun besoin d'accès Internet pour la plupart des tests : le serveur local
  émule les URL propres de Cloudflare Pages et les requêtes externes sont bloquées.
- Les tests marqués « relais » appellent les VRAIES API (warframe.market,
  warframestat) depuis Python et les injectent dans le navigateur — utile quand
  le navigateur n'a pas d'accès direct (proxy d'egress). Nécessite le réseau.

## Variables d'environnement (optionnelles)

- `VR_CHROMIUM`   : chemin d'un binaire Chromium (sinon auto-détection
  /opt/pw-browsers/*/chrome-linux/chrome, sinon Chromium de Playwright).
- `VR_CA_BUNDLE`  : bundle CA pour les appels Python vers les API (proxy TLS
  d'entreprise). Par défaut : /root/.ccr/ca-bundle.crt s'il existe, sinon
  les certificats système.
- `VR_PORT`       : port du serveur local (défaut 8899).

## Lancer

    python3 tests/e2e/tout_tester.py            # tout (démarre/arrête le serveur)
    python3 tests/e2e/tout_tester.py --sans-relais   # uniquement les tests hors-ligne

Sortie : ✓/✗ par vérification, code retour 1 à la moindre défaillance.

## Suites

| Fichier | Couvre | Réseau |
|---|---|---|
| test_recherche.py | suggestions globales (data-vr-suggest) sur builds/o/warframes, filtres locaux intacts, navigation Entrée, recherche du header | non |
| test_outils_pages.py | chargement paresseux d'items.json (courses/favoris/trade/estimateur), vignettes locales (thumbs.js), parcours d'ajout, ?q= estimateur | non |
| test_marche_complet.py | catalogue 3 837, familles, prix live au défilement, flux temps réel, mobile sans rognage | relais |
| test_repli_v1.py | estimateur + fiche objet avec v1/statistics vivante PUIS morte (404 simulé) | relais |
| test_cwv.py | LCP < 2 500 ms et CLS < 0,1 sur 14 pages, mobile émulé (4G lent, CPU ×4) | non |

## Philosophie (protocole de recette du repo)

« Codé mais pas testé = pas fait. » Chaque fonctionnalité se vérifie depuis le
canal réel (navigateur, viewport mobile), avec les cas d'échec, et en re-jouant
les parcours après changement. En cas d'échec d'un test après une modification :
c'est le site qu'on répare, pas le test qu'on assouplit — sauf changement
d'intention documenté dans le commit.
