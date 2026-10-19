# VoidRelay

> **[voidrelay.fr](https://voidrelay.fr)** — tableau de bord **Warframe** non officiel, en français : cycles (Cetus, Orb Vallis, Cambion Drift), failles du Vide, Baro Ki'Teer, Sortie, Archon Hunt, invasions, Nightwave, Darvo et prix du marché (warframe.market). Gratuit, sans compte, sans pub intrusive, sans tracker.

## Ce que fait le site

- **Timers exacts côté client** : les cycles sont recalculés localement depuis `expiryUtc` (précis à la seconde même entre deux mises à jour de données).
- **Données auto-rafraîchies** : une GitHub Action met à jour `data/` toutes les 4 h (warframestat primaire → worldstate officiel DE en secours), avec un garde-fou de contrat qui refuse tout commit difforme.
- **Secours direct** : si les données servies ont du retard, la page va chercher l'état du monde en direct chez warframestat (bandeau honnête, marché exclu).
- **FAQ bilingue** ([FR](https://voidrelay.fr/faq) / [EN](https://voidrelay.fr/faq-en)) : réponses courtes, chiffrées et sourcées aux questions des joueurs.
- **Agenda** : [warframe.ics](https://voidrelay.fr/data/warframe.ics) — arrivées de Baro et fins d'événements, à abonner dans n'importe quel calendrier.
- **Données machine** : [summary.json](https://voidrelay.fr/data/summary.json) (contrat stable, voir `scripts/check_contract.py`).

## Architecture (100 % statique, 0 serveur, 0 clé au runtime)

```
hub.html / faq.html / faq-en.html / 404.html   ← pages statiques autonomes (0 dépendance)
data/*.json + warframe.ics                     ← écrits par les GitHub Actions (cron 2 h / hebdo)
scripts/update_warframe_data.py                ← Python stdlib uniquement (selftest intégré)
scripts/update_warframe_news.py                ← digest news déterministe (selftest intégré)
scripts/check_contract.py                      ← garde-fou : le commit est refusé si le contrat casse
_headers / _redirects                          ← sécurité (CSP, HSTS…) + URLs propres (Cloudflare Pages)
```

Sources de données : [warframestat.us](https://docs.warframestat.us/) · worldstate officiel [warframe.com](https://www.warframe.com) · [warframe.market](https://warframe.market). Merci à eux.

## Mentions

Projet de fan **non officiel**, sans affiliation à Digital Extremes. « Warframe » est une marque de Digital Extremes Ltd. Les données de jeu appartiennent à leurs propriétaires respectifs.
