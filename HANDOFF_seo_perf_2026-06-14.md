# PASSATION — VoidRelay : SEO + perf index.html (2026-06-14)

> Pour le bot qui reprend. Auteur : claude-code. Statut : **fait en LOCAL, 0 push, 0 déploiement**.
> Repo de travail : `~/warframe-hub`. Domaine officiel : **voidrelay.fr** (Cloudflare Pages).

## ✅ Déjà fait (modifs locales, non déployées)

1. **`index.html`** (l'app riche servie à la racine `/`) — pointait ENCORE vers l'ancien
   domaine `warframe-hub.pages.dev` (canonical + OG + Twitter + image `icon-512`) et
   `og:site_name=Warframe Hub`. Corrigé :
   - canonical/OG/Twitter → `https://voidrelay.fr/`
   - image de partage → `https://voidrelay.fr/assets/og.png` + `og:image:width/height/alt`
   - `og:site_name` → `VoidRelay`, titre/description rebrandés VoidRelay
   - ajout du script de redirection `pages.dev`/`github.io` → `voidrelay.fr` (comme hub.html)
   - ajout `<meta http-equiv="X-Content-Type-Options" content="nosniff">` + `robots` + `author`
2. **`index.html`** — `defer` ajouté sur les 6 `<script>` (i18n/data/api/views/app/alerts) → FCP.
3. **`sw.js`** — `v43`→**`v44`** ; `data/items.json` (~198 Ko) retiré du pré-cache `SHELL`
   (il est déjà chargé à la demande via la palette de recherche, puis mis en cache par le
   handler `fetch`). Gain : ~198 Ko en moins à la 1re visite.
4. **`faq.html` + `faq-en.html`** — `datePublished:"2026-06-01"` ajouté au JSON-LD (WebPage +
   FAQPage) + `og:image:width/height`.

**Vérifs faites :** `grep` → 0 reste de `warframe-hub.pages.dev` · JSON-LD FR+EN valides
(`json.loads` OK).

## ▶️ Prochaines actions (par priorité de RENTABILITÉ)

1. 🚨 **Cloudflare bloque les robots d'IA (403 sur GPTBot/ClaudeBot/PerplexityBot)** →
   tout le référencement IA (GEO/AEO) est coupé MALGRÉ le `robots.txt` qui les autorise et
   le `llms.txt`. C'est LE plus gros levier. Action = régler le pare-feu/WAF Cloudflare
   (Bot Fight Mode / règle WAF) pour laisser passer ces user-agents. **Geste du Chef requis
   (compte Cloudflare).** Déjà documenté côté CERVEAU (cycle 7 ameliorateur-voidrelay).
2. 🚨 **L'Action GitHub de rafraîchissement des données ne s'exécute jamais** → données
   figées au 02/06, le « live » ne tient que par le secours côté client. Vérifier le workflow
   (cron + permissions Actions activées sur le repo). Documenté CERVEAU (poll 08:00-08:28).
3. **Déployer les correctifs ci-dessus** : repo public → **feu vert du Chef obligatoire**
   (le deploy part de `main`/`claude-work`). Option propre : commit sur une branche dédiée
   pour relecture avant merge.

## ⛔ Garde-fous (CLAUDE.md du Chef)
- Site PUBLIC → **rendre public / déployer = ligne rouge** : préparer puis demander le feu vert.
- Jamais de compte / mot de passe / CB / réglage de sécurité sans accord.
- Anti-doublon : lire `CERVEAU/SESSIONS.md` (claim `chantier:voidrelay-seo-perf-index`,
  2026-06-14 05:35) avant de relancer quoi que ce soit.
