# Sécurité — Warframe Hub

Site **100% statique** (HTML/CSS/JS), servi sur GitHub Pages / githack. **Aucun backend, aucune base de données, aucun secret côté serveur.** Cette page récapitule les protections en place et leurs limites honnêtes.

## Modèle de menace

Surface d'attaque principale d'un site statique : **XSS** (injection de HTML/JS via des données dynamiques) et le **détournement d'onglet** (tabnabbing). Pas de secrets à voler côté serveur ; les données utilisateur restent **en local** (`localStorage`) sur l'appareil.

## Protections en place

### Anti-XSS
- **Échappement systématique** : toute donnée dynamique injectée dans le DOM passe par `esc()` (échappe `& < > " '`). Concerne les réponses API (warframe.market, WarframeStat) **et** les entrées utilisateur (pseudo warframe.market, liens promo, URL de proxy, cibles de recherche…).
- **Validation des URL** : `safeUrl()` n'autorise que `http(s)://`, les liens internes (`#/…`) et chemins relatifs ; **rejette** `javascript:`, `data:`, `vbscript:`, `file:` (y compris obfusqués par des espaces). Appliquée aux liens fournis par l'utilisateur (promo/affiliation) et aux URL externes des API (liens/images d'actualités).
- **Aucun `eval` / `new Function`** dans le code.
- **Aucun gestionnaire d'événement inline** (`onerror`, `onclick`…) : les images cassées sont gérées par un écouteur global délégué — ce qui permet une CSP `script-src 'self'` stricte (pas de `'unsafe-inline'` pour les scripts).

### Content Security Policy (`<meta http-equiv>`)
- `default-src 'self'` · `object-src 'none'` · `base-uri 'self'` · `form-action 'self'` · `frame-src 'none'`
- `script-src 'self'` — **pas de `unsafe-inline`, pas de `unsafe-eval`**.
- `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com` — `unsafe-inline` requis car l'app utilise de nombreux attributs `style=""` (risque d'injection CSS faible ; refactor massif évité volontairement).
- `font-src 'self' https://fonts.gstatic.com`
- `img-src 'self' data: https:` — les images proviennent de plusieurs CDN (WarframeStat, warframe.market, images d'actualités/wiki) ; `https:` évite de casser ces sources tout en bloquant `http:`/autres schémas.
- `connect-src 'self' https://api.warframestat.us https://api.warframe.market https://api.allorigins.win https://api.codetabs.com https://*.workers.dev` — limité aux API et proxys réellement utilisés (+ proxy Cloudflare perso en `*.workers.dev`).
- `worker-src 'self'` · `manifest-src 'self'` · `upgrade-insecure-requests`.

### Confidentialité / comptes
- **Aucun mot de passe** n'est demandé, stocké ou journalisé. La liaison warframe.market se fait **par pseudo public** (lecture seule) ; la connexion sécurisée se fait sur le site officiel.
- Données utilisateur (favoris, panier, tâches, pseudo, liens promo, proxy, alertes) : **uniquement en `localStorage`**, jamais transmises à un tiers par le site.

### Liens externes
- Tous les liens `target="_blank"` portent `rel="noopener noreferrer"` (anti-tabnabbing + pas de fuite de `Referer`).
- `<meta name="referrer" content="strict-origin-when-cross-origin">`.

### En-têtes HTTP de sécurité (Cloudflare Pages)
Appliqués à `/*` via le fichier **`_headers`** à la racine (lu par **Cloudflare Pages** — `warframe-hub.pages.dev`) :
- `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload` (HTTPS forcé)
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY` (anti-clickjacking — complète `frame-ancestors`)
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: geolocation=(), microphone=(), camera=(), payment=(), usb=()`
- `Cross-Origin-Opener-Policy: same-origin`

> **Pas de `Cross-Origin-Embedder-Policy`** volontairement : COEP casserait le chargement des images du CDN WarframeStat (qui n'envoient pas de `CORP`). Les en-têtes ci-dessus n'affectent ni les images CDN ni les `fetch` via le worker. La **CSP** (balise meta) reste en place et est complétée par ces en-têtes.
> *GitHub Pages ignore `_headers` ; ces en-têtes ne s'appliquent donc que sur Cloudflare Pages.*

### Proxy warframe.market (`proxy/worker.js`)
Verrouillé, **pas un proxy ouvert** : hôte unique `api.warframe.market`, chemins `/v1/`–`/v2/` seulement, HTTPS amont obligatoire, `GET`/`OPTIONS` uniquement, en-têtes minimaux.

### Dépôt
- **Aucun secret/token** committé (vérifié). Les tokens de déploiement sont fournis hors-dépôt et à usage unique.

## Limites honnêtes (intrinsèques à un site statique)

- **En-têtes HTTP** : désormais **actifs sur Cloudflare Pages** via `_headers` (HSTS, nosniff, X-Frame-Options, Referrer-Policy, Permissions-Policy, COOP — voir ci-dessus). Sur **GitHub Pages** ils restent **indisponibles** (`_headers` ignoré, aucun contrôle des en-têtes) → privilégier l'URL Cloudflare Pages pour la posture de sécurité complète. La CSP (meta) s'applique partout.
- **`style-src 'unsafe-inline'`** conservé pour les attributs `style=""` (injection CSS, à faible impact).
- **`img-src https:` / `connect-src` avec `*.workers.dev`** : volontairement un peu larges pour ne pas casser les CDN d'images et un proxy perso. Un proxy sur **domaine personnalisé** doit être ajouté manuellement à `connect-src` dans `index.html`.
- **Pas de secrets côté client** : tout ce qui est livré au navigateur est public par nature — aucune clé d'API privée n'est (ni ne doit être) intégrée.

## Signaler un problème

Ouvre une issue sur le dépôt (`oziasetienne-afk/voidrelay`) en décrivant le souci, sans publier d'exploit détaillé.
