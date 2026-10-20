# VoidRelay — ce qu'il faut savoir avant de toucher au dépôt

Site statique de fans **Warframe** (HTML/CSS/JS, aucun build), PWA, déployé sur
Cloudflare Pages. FR + EN. `HANDOFF.md` raconte l'histoire complète (1475 lignes) ;
ce fichier-ci ne contient que ce qui **casse quelque chose si on l'ignore**.

## La seule commande obligatoire

```bash
bash scripts/verifier_invariants.sh     # ~25 s — à passer AVANT chaque push
```

Elle enchaîne l'accessibilité, le SEO, la synchro, et **dix garde-fous purs** :
`verifier_profils` · `verifier_prix_rangs{,_client}` · `verifier_prix_objet` ·
`verifier_historique_coherent` · `verifier_api_builds` · `verifier_api_evt` · `verifier_cartes_partage` ·
`verifier_liens_internes` · `verifier_sync` · le gabarit des pages générées.

Chacun a été **mis en échec sur un vrai défaut** avant d'être branché. Si l'un d'eux
rougit, il a probablement raison : lis son message avant de le contourner.

## Les six pièges qui ont déjà coûté cher

### 1. Ne jamais retoucher une page générée à la main
`o/**`, `en/o/**`, `guides/**`, `sitemap.xml`, `data/pages_index.json`,
`data/en_pages_index.json` sortent de `scripts/generer_pages_objets.mjs`.

Les éditer à la main **gèle le générateur** : son garde-fou de dérive refuse alors de
tourner, donc plus rien de ce qu'on ajoute au gabarit ne part. C'est arrivé — 4120
fichiers avaient forké **dans les deux sens** pendant des semaines sans que rien ne le
montre. Modifie le gabarit, puis :

```bash
node scripts/generer_pages_objets.mjs --verifier   # 2 s, n'écrit rien, dit si ça diverge
node scripts/generer_pages_objets.mjs --force      # régénère pour de bon
```

Même règle pour `builds/**` et `en/builds/**` (sauf les 22 builds ★ faits main, sans
marqueur `vr-builds-gen`) : ils sortent de `scripts/generer_builds.mjs`. Le lien
« Feedback » y avait été collé à la main dans 727 pages ; la première régénération
l'aurait effacé. `node scripts/generer_builds.mjs --verifier` le dit désormais
(branché dans les invariants).

### 2. Un conflit sur `data/` se RÉSOUT EN RÉGÉNÉRANT
`main` pousse une mise à jour de données toutes les 2 h (minute 17, depuis le 19/10/2026). En cas de conflit sur
`data/market.json`, `market_history.json`, `summary.json`, `cycles.json`,
`last_update.json`, `warframe.ics` :

```bash
git checkout --ours data/… && git add data/ && python3 scripts/update_warframe_data.py
```

**Jamais `--theirs`, jamais un choix de camp.** Les deux côtés n'ont pas la même
chaîne de calcul et choisir réintroduit des prix écrits sur le mauvais rang.

### 3. `VR_BLOQUER_EXTERNE=1` pour les garde-fous de rendu, en local
```bash
VR_BLOQUER_EXTERNE=1 node scripts/verifier_contraste.mjs http://localhost:8901
```
Sans la variable, ils **bloquent** sur les scripts publicitaires Google : 31 minutes
d'attente à 0,2 % de CPU, qu'on prend pour de la lenteur. En CI, ce n'est pas nécessaire.

### 4. Bump du service worker à chaque changement de coque
`sw.js` ligne 2 : `const CACHE="wf-hub-vNNN"` → incrémente. Sans ça les visiteurs
gardent l'ancienne version.

`cache.addAll()` est **atomique** : une seule URL absente de `SHELL` ou `ARSENAL` et
l'installation entière échoue — plus de PWA du tout, sans le moindre symptôme visible.
`verifier_liens_internes.mjs` le vérifie.

### 5. Un objet à rangs n'a pas UN prix
Arcanes et mods Primed se négocient par rang, avec des écarts allant jusqu'à **×17**
(Arcane Energize : 8 p au rang 0, 137 p au rang 5). Le site fait **trois** calculs de
prix différents, délibérément, chacun répondant à une question distincte :

| Où | Question | Garde-fou |
|---|---|---|
| `scripts/update_warframe_data.py` | à quel prix puis-je acheter maintenant | `verifier_prix_rangs.py` |
| `js/api.js` `summarizeStats` | qu'est-ce qui change de mains | `verifier_prix_rangs_client.mjs` |
| `js/objet.js` (3838 pages SEO) | combien vaut cet objet | `verifier_prix_objet.mjs` |

Ne les uniformise pas sans lire `HANDOFF.md` v67–v71 : ils ne mesurent pas la même chose.

**Le RANG, lui, est fixé (20/10/2026)** : mods Primés et arcanes → rang max partout ;
autres mods → rang de la passe précédente (`_choisir_rang`). Chaque point d'historique
d'un objet à rangs porte `r`, et variations, alertes et sparkline ne lisent que
`serie_du_rang()`. Un point sans `r` sur un objet à rangs ne compte pour rien : avant,
le rang basculait 0 ↔ max d'une passe à l'autre (Primed Flow « +65 % » sur un prix
immobile). `change24h`/`change7d` sont en **platine**, `…Pct` en %, `null` = non disponible.

### 6bis. Dépôt PUBLIC : rien de secret ni de personnel, jamais
Depuis le 19/10/2026 le dépôt est public (plus de quota Actions ; le Worker
`voidrelay-quota-guard` a été supprimé, l'historique est reparti de zéro). Tout ce qui est
poussé est lisible par tout le monde, pour toujours.
- Les clés vont dans les secrets Actions / Cloudflare, **jamais** dans un fichier.
- Pas de prénom, nom, email perso ni nom de machine dans le code, les commentaires,
  les commits, les issues ou les PR. Désigner la propriétaire par « l'admin ».
- Les commits doivent être signés avec une adresse `@users.noreply.github.com`.
- `garde-secrets.yml` (gitleaks + `scripts/garde_perso.py`) bloque sinon. Ne le
  contourne pas : un secret poussé une fois est compromis, il faut le révoquer.
Le vrai témoin d'une mise à jour bloquée reste `data/last_update.json` → `updated_utc` :
plus de 8 h = mise à jour bloquée. (Le cron demande 2 h, mais GitHub retarde les crons :
mesuré le 19–20/10/2026, 5 passes en 29 h, écarts de 3 h 46 à 6 h 46 entre deux départs.)

### 6. La liste blanche de synchro
`js/sync.js` : **ne jamais y ajouter `wmuser` ni `wfproxy`.** Ce sont un compte
warframe.market et une URL de proxy personnelle, pas des progrès de jeu.
`verifier_sync.mjs` l'interdit.

## Sous-agents (19/10/2026, système repris du projet Application)

Dans `.claude/agents/`, chacun avec son modèle : `relecteur-code` (Sonnet, après chaque modif),
`invariants` (Haiku, avant chaque push, vrai code de sortie), `securite-depot-public` (Opus, avant
chaque push : dépôt public), `debogueur` (Opus, garde-fou rouge ou chiffre faux), `verificateur-warframe`
(Sonnet, tout fait Warframe vérifié sur le wiki / warframe.market), `passation-doc` (Sonnet, fin de
chantier), `Explore` (Haiku, recherche). Le hook `.claude/hooks/taille-de-session.mjs` prévient à 250 000
jetons ajoutés et demande la passation à 350 000.

## Conventions locales

- **Cartes d'outils** (`outils.html`, `en/tools.html`) : chaque `.tool-card` porte un
  `data-pf="farmeur monteur …"` — la correspondance outil→profil vit **sur la carte**,
  pas dans le JS. Une carte sans `data-pf` fait échouer `verifier_profils.mjs`.
- **Données d'arsenal** : `npm run arsenal:data` — deux étapes enchaînées. Ne lance
  jamais `generer_arsenal_data.mjs` seul, il écrase `warframes.json` et perd les stats
  de pouvoirs.
- **Toute page publique** doit avoir `og:title`, `og:description`, `og:image` et
  `twitter:card`, avec une image **qui existe sur le disque**.
- **Commentaires en français**, comme tout le dépôt. Explique le POURQUOI et le chiffre
  mesuré, pas le QUOI.

## Tester

```bash
python3 -m http.server 8901 &            # les suites démarrent leur propre serveur
python3 tests/e2e/test_marche_profils.py # suites dans tests/e2e/ (liste dans tout_tester.py)
```

`python3 tests/e2e/tout_tester.py` les enchaîne toutes (22 suites, 10 à 15 min) ; la liste qui fait foi
est `SUITES` dans ce fichier — une suite qui n'y est pas inscrite ne tourne jamais.

⚠️ Ne lance pas les suites pendant que `npm run arsenal:data` tourne : les attentes de
300 ms deviennent des faux échecs. Ça a déjà fait croire à une régression.

## La règle de fond

**Mesurer avant de corriger, et refuser de deviner.** Presque tous les défauts trouvés
ici ne cassaient rien, n'affichaient aucune erreur et ne rougissaient aucun test — ils
donnaient juste des chiffres faux. Un garde-fou qu'on n'a pas vu échouer n'est pas un
garde-fou : mets-le en échec sur un vrai défaut avant de le brancher.
