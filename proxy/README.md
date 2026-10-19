# Proxy perso warframe.market

> **En service depuis le 19/10/2026 : `proxy/vercel/` → https://voidrelay-prix.vercel.app**
> (projet Vercel `voidrelay-prix`, équipe de l'admin, région Paris `cdg1`).
> warframe.market renvoie désormais 403 « Just a moment » à **toutes** les requêtes qui
> sortent des Workers Cloudflare (4 jeux d'en-têtes testés) : `worker.js` ci-dessous ne
> rend plus aucun prix et n'est gardé que pour l'historique. Les proxys publics de secours
> (allorigins, codetabs) répondaient 522 le même jour.
>
> Redéployer le proxy Vercel : `cd proxy/vercel && npx vercel deploy --prod --scope chef43`.
> Coût : réponses en cache CDN 5 min (`s-maxage=300`) ; budget de dépassement Vercel réglé
> à 1 $ avec pause automatique. Liste blanche stricte : `api.warframe.market`, `/v1/` et `/v2/`.

## Ancien proxy : Cloudflare Worker (bloqué par warframe.market)

`worker.js` est un proxy CORS pour l'API **warframe.market** (qui bloque le CORS
navigateur). Il est **gratuit** (100 000 requêtes/jour sur le plan free), plus rapide
et plus fiable que les proxys publics partagés (allorigins / codetabs) utilisés par
défaut. Une fois déployé, le bouton **⚡ Live** du Marché devient quasi instantané.

> Étape **manuelle** (elle nécessite TON compte Cloudflare — impossible à automatiser).
> Compte un déploiement de ~3 minutes.

## Option A — Dashboard Cloudflare (le plus simple, zéro outil)

1. Crée un compte gratuit sur https://dash.cloudflare.com (aucune carte requise).
2. Menu **Workers & Pages** → **Create application** → **Create Worker**.
3. Donne-lui un nom (ex. `wf-market`) → **Deploy**.
4. Clique **Edit code**, **efface tout**, puis **colle le contenu de `worker.js`** → **Deploy**.
5. Copie l'URL du worker affichée, du type :
   `https://wf-market.TON-SOUS-DOMAINE.workers.dev`

## Option B — Wrangler (CLI)

```bash
npm install -g wrangler
wrangler login
cd proxy
wrangler deploy worker.js --name wf-market --compatibility-date 2024-01-01
```

## Brancher le proxy dans le site

Deux façons (aucune des deux ne nécessite de re-déployer le site) :

- **Sans toucher au code** : ouvre le site → **Réglages → 🛰️ Proxy warframe.market**,
  colle l'URL du worker, clique **Tester & enregistrer**. Stocké sur ton appareil
  (localStorage `wfproxy`). C'est la méthode recommandée.

- **En dur pour tous les visiteurs** : dans `js/api.js`, renseigne la constante
  `CUSTOM_PROXY` avec ton URL :

  ```js
  const CUSTOM_PROXY = "https://wf-market.TON-SOUS-DOMAINE.workers.dev";
  ```

  puis pousse la branche (déploiement auto). Le proxy perso devient prioritaire,
  les proxys publics restent en secours automatique.

## Tester l'URL à la main

```
https://TON-worker.workers.dev/?url=https%3A%2F%2Fapi.warframe.market%2Fv1%2Fitems%2Fash_prime_set%2Fstatistics
```

Doit renvoyer du JSON avec l'en-tête `Access-Control-Allow-Origin: *`.

## Sécurité

Le worker est volontairement verrouillé — **ce n'est pas un proxy ouvert** :
- **Hôte** : uniquement `api.warframe.market` (liste blanche `ALLOWED_HOSTS`).
- **Chemin** : uniquement l'API publique `\/v1\/` ou `\/v2\/` (`ALLOWED_PATH`).
- **Protocole** : HTTPS obligatoire côté amont.
- **Méthode** : `GET` (+ `OPTIONS` pour le préflight) uniquement — aucune écriture.
- **En-têtes** : seul un jeu minimal est transmis à l'amont (Accept/Platform/Language/UA).

> CSP : le site autorise `connect-src … https://*.workers.dev`. Si tu héberges le
> worker sur un **domaine personnalisé** (pas en `*.workers.dev`), ajoute ce domaine
> à la directive `connect-src` du `<meta http-equiv="Content-Security-Policy">` dans
> `index.html`, sinon le navigateur bloquera l'appel.
