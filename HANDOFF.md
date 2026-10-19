# 📋 Warframe Hub — Récap / Handoff

> Document de reprise. Pour continuer dans un nouveau chat :
> « Continue le projet Warframe Hub, dépôt `oziasetienne-afk/voidrelay`, branche `claude/warframe-updates-app-thkv5`. Lis HANDOFF.md. »

## 🎯 Le projet
Site web tout-en-un Warframe (orienté **trading de platine** + infos jeu), en **HTML/CSS/JS pur** (aucun build, aucune dépendance), PWA installable. En français.

## 🌐 Liens & dépôt
- **Dépôt** (public) : `oziasetienne-afk/voidrelay`
- **Branche de travail** : `claude/warframe-updates-app-thkv5`
- **`main`** : synchronisée automatiquement depuis la branche de travail (workflow `sync-main.yml`)
- **SITE EN LIGNE (gratuit)** : https://raw.githack.com/oziasetienne-afk/voidrelay/main/index.html
  - (githack affiche « One more step » → bouton rouge « Open the page », une fois)
- **GitHub Pages** : NON activé (optionnel). Pour `oziasetienne-afk.github.io/test/` → 1 clic owner : Settings → Pages → Source : **GitHub Actions** (impossible via API/robot).

## 🗂️ Structure
```
index.html              coque + topbar + palette + barre mobile + modale
css/style.css           design (verre dépoli, dégradés, animations, thème clair/sombre, graphe .pchart)
js/data.js              WATCH (listes marché), GUIDE, BUILDS (frames+armes), TASKS, GEN_FRAME/GEN_WEAPON, helpers (esc, slug, sellPrice)
js/api.js               fetch WarframeStat + warframe.market via PROXY (proxy perso prioritaire), throttle, mapLimit, summarizeStats, extractHistory
js/views.js             toutes les pages (rendu) + autocomplétion (acAttach) + graphe SVG (priceChartSVG) + Historique + Réglages (alertes/proxy)
js/app.js               routeur (hash), modale, toasts, palette de recherche, thème, service worker
js/alerts.js            alertes/notifications locales (Baro, Nuit Cetus, prix cible favori) + config pour le SW
data/market.json        instantané pré-calculé du marché (~103 sets Prime)
data/market_history.json historique quotidien (1 point/jour/item, capé 90 j) — alimenté par l'Action « Warframe Hub » (2 h)
data/items.json         tous les items warframe.market (~3794) pour l'autocomplétion
manifest.webmanifest    PWA (icônes inline en data-URI)
sw.js                   service worker (hors-ligne) + handlers push / notificationclick / periodicsync
scripts/update_warframe_data.py   régénère data/market.json (format items) + market_history.json + summary.json (Action « Warframe Hub » toutes les 4 h)
proxy/worker.js         proxy CORS warframe.market (Cloudflare Worker) — À DÉPLOYER (cf. proxy/README.md)
proxy/README.md         déploiement & branchement du proxy perso
.nojekyll               GitHub Pages sert les fichiers tels quels (pas de Jekyll)
.github/workflows/pages.yml          déploie GitHub Pages depuis main (enablement:true → auto-activation)
.github/workflows/warframe-hub-update.yml régénère les données du Hub toutes les 4 h (l'ancien refresh-market.yml horaire, format incompatible, a été retiré le 16/07/2026)
.github/workflows/sync-main.yml      force main = branche de travail à chaque push (déploiement auto)
assets/icon-*.png       icônes (désormais aussi inline en data-URI dans index/manifest)
```

## 🔌 APIs & contraintes (IMPORTANT)
- **WarframeStat.us** (`api.warframestat.us`) : CORS OK navigateur. Endpoints : `/pc/news`, `/pc` (worldstate), `/warframes`, `/weapons`, `/mods`, `/items` (langue `?language=fr`). Les listes incluent `components[].drops` (reliques), `masteryReq`, `disposition`, `vaulted`, `passiveDescription`, `polarities`, etc.
- **warframe.market** : **CORS bloqué** navigateur → **proxy** : `https://api.allorigins.win/raw?url=` (principal) + fallback `https://api.codetabs.com/v1/proxy/?quest=`. 
  - Stats = API **v1** : `/v1/items/{slug}/statistics` (statistics_closed → 48hours/90days, median + volume).
  - Liste items = API **v2** : `/v2/items` (data[].slug + i18n.en.name). ⚠️ `/v1/items` renvoie 404 (mort).
- **Marché** : affichage **instantané** via `data/market.json`, bouton **⚡ Live** (proxy, concurrence 8 + throttle ~110 ms), cache navigateur 2 h (`localStorage` clé `mkt_<cat>`).
- Lien objet → `https://warframe.market/items/{slug}` (slug = nom minuscule, espaces→`_`).

## 🧩 Fonctionnalités (≈22 outils)
Accueil (item vedette calculé prix×volume + alertes Baro / Nuit Cetus) · **Marché** (top vendus/chers + « vends à » = ~15 % sous médian) · **Favoris** (prix cible, total stock, bouton WTS) · **Que farmer** · **Liste de courses** (prix réels + WTB) · **Estimateur** (autocomplétion live sur items.json) · **Ducats** · **Endo/Ayatan** · **Rivens** (dispositions) · **Comparateur** (armes + Warframes) · **Calc reliques** (chances Intacte→Radieuse, solo/radshare) · **Guide platine** · **Builds** (tous frames+armes ; ★ = détaillé par situation ; sinon template + liens directs **PandaaHH/Wiki/Overframe**) · **Codex** (118 frames Prime/non-Prime + armes/reliques/mods ; **palier MR** badge 🔒/✓ ; filtre « mon palier » ; drops/farm) · **Monde** (cycles avec timers live, fissures filtrables par ère + Acier, Sortie, Chasse Archon, Arbitrage, Steel Path, Darvo, Nightwave, Anomalie Sentiente, Invasions, Événements) · **Tâches** (checklist quoti/hebdo auto-reset) · **Réglages** (palier MR, thème, effacer données, installer PWA).
Transverse : **palette de recherche globale** (touche `/` ou ⌘K, navigation clavier), **toasts**, **barre de nav mobile** native, **skeleton loaders**, animations d'apparition.

## 💾 Stockage local (localStorage)
`favs` (favoris), `cart` (liste de courses {slug:{n,q}}), `tasks` (checklist + dates reset), `mr` (palier), `theme` (light/dark), `mkt_<cat>` (cache marché live 2 h).

## ⚙️ Déployer une modif
1. Modifier + pousser sur `claude/warframe-updates-app-thkv5`.
2. `sync-main.yml` force `main` = branche → le site githack se met à jour seul.
3. (Si Pages activé : `pages.yml` redéploie aussi.)

## 🧪 Tester en local
`python3 -m http.server 8000` puis `http://localhost:8000`.

## ✅ Fait récemment (4 chantiers du handoff)
- **Historique/graphiques de prix** : page `#/historique` + mini-graphe dans l'estimateur. Courbe SVG pure depuis l'historique 90 j de warframe.market (aucun backend). L'historique quotidien vit dans `data/market_history.json` (90 j, pipeline hub) — l'ancien `history.json` a été retiré le 16/07/2026.
- **GitHub Pages** : `.nojekyll` + `pages.yml` (`enablement:true`) → s'active tout seul au 1er push sur `main`. *(Voir étape manuelle si l'org bloque l'auto-activation.)*
- **Notifications/alertes** : `js/alerts.js` + handlers SW. Alertes locales (Baro, Nuit Cetus, prix cible favori) quand l'app est ouverte ; arrière-plan best-effort via periodicSync (Chrome/PWA). Réglages → 🔔.
- **Proxy perso** : `proxy/worker.js` (Cloudflare Worker) + branchement auto dans `api.js`. *(Déploiement = étape manuelle.)*

## ⏳ Étapes manuelles restantes (hors-repo)
- **GitHub Pages** : normalement auto-activé par `pages.yml`. Si l'URL `oziasetienne-afk.github.io/test/` ne répond pas après un push, faire le 1 clic owner : Settings → Pages → Source : **GitHub Actions**.
- **Proxy perso (optionnel)** : déployer `proxy/worker.js` sur Cloudflare (compte gratuit, ~3 min, cf. `proxy/README.md`), puis coller l'URL dans Réglages → 🛰️ Proxy. Sans ça, les proxys publics restent utilisés.
- **Vraie push serveur (app fermée)** : nécessiterait un backend VAPID (clés + stockage des abonnements + envoi). Le SW a déjà les handlers `push`/`notificationclick` prêts ; il ne manque que le serveur d'envoi. Les alertes app-ouverte fonctionnent déjà sans rien.

## 🆓 Coûts
**0 € à vie** : githack + GitHub Actions (illimité sur dépôt public) + APIs gratuites + GitHub Pages (si activé).

## 🛠️ Régénérer les données manuellement
- `data/market.json` : `python3 scripts/update_warframe_data.py` (ou Action « Warframe Hub - data update »).
- `data/items.json` : récupéré depuis `https://api.warframe.market/v2/items` (slug + i18n.en.name).

---

## 🛠️ Simulateur d'Arsenal — reprise du 03/09/2026 (v46)

> Reprendre : « Continue le simulateur d'Arsenal VoidRelay, dépôt `oziasetienne-afk/voidrelay`.
> Fichiers : `arsenal.html` + `en/arsenal.html` (CSS inline), `js/arsenal.js` (moteur),
> `data/arsenal/*.json` (données cuites), `scripts/generer_arsenal_data.mjs` +
> `scripts/enrichir_stats_capacites.mjs` (cuisson), `tests/e2e/test_arsenal*.py` (recette). »

### Chaîne de données — une seule commande

    npm run arsenal:data

Elle enchaîne les deux étapes, dans l'ordre :
1. `generer_arsenal_data.mjs` — recuit `data/arsenal/*.json` depuis WFCD
   (`api.warframestat.us` en FR + GitHub raw en EN) et les modules de données
   du wiki officiel (classes de mêlée, postures, stats d'armes à feu).
2. `enrichir_stats_capacites.mjs` — **obligatoire juste après** : le pas 1
   réécrit `warframes.json` de zéro et **perd** les stats par capacité
   (`abilities[].st`, lues sur le wiki).

**Le piège est désormais gardé, plus seulement documenté** (il a été déclenché
deux fois le 03/09/2026, en silence) :
- `generer_arsenal_data.mjs` affiche un avertissement en fin d'exécution ;
- `verifier_invariants.sh` **échoue** si `abilities[].st` a disparu, avec la
  commande de réparation dans le message. Vérifié dans les deux sens : le
  garde-fou passe sur des données saines et tombe dès qu'on retire les stats.

### Ce que v46 a corrigé / ajouté
- **Bug de lecture des mods de crit mêlée** : le libellé
  `+220% Critical Chance (x2 for Heavy Attacks)` n'était pas reconnu par le
  parseur → Acier Véritable, Acier Véritable Prime, Acier Sacrificiel et Acier
  Galvanisé Prime valaient **0** dans le moteur (chance critique de tous les
  builds mêlée restée à sa base). Corrigé à la cuisson.
- **43 mods de FACTION chiffrés** (Fléau des…, Châtie-, Expulse-, Purifie-) :
  clef `f_<faction>` (fraction, ex. `f_grineer: 0.55`), **additive** entre mods
  d'une même faction comme dans le jeu, appliquée **uniquement** dans le bloc
  Cible contre la faction choisie. Rappel visuel `.ars-bane-note` quand le mod
  est équipé mais que la faction visée est une autre.
- Mods aux effets simulés : **259 → 306** sur 655.
- Données rafraîchies (17/07/2026 → 03/09/2026) : + Haalvu (primaire),
  capacités ré-enrichies depuis le wiki.

### Ce que v47 a changé (03/09/2026, même session)
- **La simulation d'ennemi est SUPPRIMÉE** (préréglage d'ennemi, armure, santé,
  niveau, croissance officielle d'armure/santé, réduction de dégâts, temps pour
  tuer). Trop de réglages pour une question qui n'en a qu'une.
  Code retiré : `croissance`, `armureAuNiveau`, `santeAuNiveau`, `rdArmure`,
  `CIBLES`, les coefficients `c` de `FACTIONS`, les champs `#ars-cb-*`.
- **Remplacée par le tableau « Efficacité par faction »** : les six factions
  d'un coup, chacune avec **vulnérabilité × mods de faction = total**, plus les
  dégâts par coup correspondants et une barre de comparaison. Vert = meilleure
  faction (s'il y a un vrai gain) ; rouge = le build PERD (× < 1) ; un ×1 nu
  n'est pas coloré.
- **Règle de calcul** : les deux colonnes se **multiplient**. Le jeu range la
  vulnérabilité de type et les mods de faction dans deux boîtes séparées —
  corrosif pur contre Grineer ×1,5 puis Fléau des Grineers Accru Prime ×1,55
  donne **×2,33**, pas ×2,05 (l'addition serait fausse).
- `etat.cible` ne garde plus que `.fac` : la faction retenue (clic sur une
  ligne) reste la **faction de référence du build auto** (« adapter les
  éléments »), sinon cette option se désactive.
- Les chiffres sont exposés en attributs `data-vuln/-bane/-tot/-dmg` sur chaque
  ligne : la recette ne dépend plus de la mise en page.
- Largeur : le panneau de gauche fait ~320 px. Un tableau à cinq colonnes y
  débordait — d'où les deux colonnes actuelles (le détail sous le total).
  Vérifié à 1440 px et à 390 px : aucun débordement.

### Ce que v48 a apporté (03/09/2026) — les POSTURES
- **La classe de mêlée existe enfin dans les données.** Elle n'est dans AUCUNE
  source WFCD (`type` vaut « Melee » pour les 269 armes) et les dossiers du jeu
  mentent (la Nikana Prime vit sous `/Melee/Swords/`). Elle vient désormais du
  module de données du wiki officiel `Module:Weapons/data/melee`
  (`Class` + `InternalName`). **221 / 269 armes** classées ; les 48 restantes
  sont des **composants de Zaw** (Balla, Cyath, Dehtat…) — des pièces, pas des
  armes montées : elles restent sans classe, et le sélecteur montre alors
  toutes les postures en le disant.
- **Le sélecteur de posture est filtré comme en jeu.** Avant : les 57 postures
  proposées quelle que soit l'arme (« appariement auto impossible » dans le
  code). Après : 3 pour une Nikana, 3 pour un Polearm…
- **Les combos sont chiffrés.** `Module:Stances/data` publie, par combo, les
  dégâts de chaque coup en % des dégâts de base, le nombre de coups, la durée
  et les procs forcés → `data/arsenal/postures.json` (57 / 57 postures).
  Le panneau « Posture » affiche par combo : nom, coups, % total, procs forcés,
  durée et **DPS**, le meilleur en vert.
  DPS = (% total / 100) × coup moyen critique compris ÷ durée, la durée étant
  accélérée par la vitesse d'attaque moddée (règle du jeu).
- **Comparaison des postures entre elles** : chaque carte du sélecteur et de la
  collection annonce son meilleur combo et son DPS **avec les mods déjà posés**
  (Nikana Prime nue : Justice Aveugle 2014 · Fente Tranquille 1837 · Jugement
  Décisif 1670). C'est le choix de posture rendu évident.
- Honnêteté : seuls les combos PROPRES à la posture sont retenus (les combos
  partagés par toute une classe ne disent rien sur le choix) ; les combos
  Conclave (PvP) sont écartés comme les mods PvP ; un combo sans durée publiée
  garde coups et dégâts mais **pas de DPS**.
- Le diagnostic réclame une posture quand il n'y en a pas : elle **ajoute** de
  la capacité au lieu d'en coûter.
- Nouveau : `scripts/lib_lua.mjs` — lecteur du sous-ensemble de Lua utilisé par
  les modules de données du wiki (tables littérales). Aucune exécution de code
  distant : c'est un analyseur, pas un interpréteur.
- `data/arsenal/postures.json` est ajouté au pré-cache hors-ligne de `sw.js`.

### Ce que v49 a apporté — les AURAS
Les **36 auras du jeu valaient zéro** dans le moteur : leur texte est rédigé
côté escouade (« Squad receives +60% Melee Damage ») et aucun motif du parseur
ne le lisait. Ce sont pourtant des bonus **permanents**, rien de conditionnel.

Huit auras sont désormais chiffrées : Charge d'Acier (+60 % mêlée), Fusil
Amplifié (+27 %), Fusil à Pompe Amplifié (+18 %), Pistolet Amplifié (+27 %),
Œil de Lynx (+52,5 % sniper), Physique (+20 % santé), Unis (+25 % armure),
Élan (+15 % sprint). Mods aux effets simulés : **306 → 314**.

Deux familles, deux traitements :
- **statistiques de Warframe** (santé, armure, sprint, puissance…) : l'aura est
  posée sur la frame, elles tombent dans les clefs existantes et `sommeFx` les
  additionne — rien à faire côté moteur ;
- **dégâts par catégorie d'arme** (`a_melee`, `a_rifle`, `a_shotgun`,
  `a_pistol`, `a_sniper`) : l'aura est sur la **frame**, le bonus s'applique à
  l'**arme**. `auraArmeDe()` fait le pont, additif avec les mods de dégâts de
  base (Charge d'Acier + Point de Pression = +180 %, pas ×2,2). Les snipers
  reçoivent Fusil Amplifié **et** Œil de Lynx (ils utilisent les mods Fusil).
  La provenance est annoncée sous le tableau de dégâts (`.ars-aura-note`) :
  un +60 % venu d'ailleurs ne doit pas être un mystère.

Restent honnêtement non simulées : les auras d'escouade sans effet sur TES
chiffres (Radar Ennemi, Récupérateurs), celles qui modifient l'ENNEMI
(Projection Corrosive −18 % armure, Perturbation de Bouclier) — le tableau de
factions ne modélise pas l'armure — et les conditionnelles (Puissance
Croissante, Répit Bref).

### Ce que v50 a apporté — les stats d'armes à feu
`Module:Weapons/data/primary` et `/secondary` publient ce que WFCD n'a pas :
**munitions max, pénétration innée, précision, portée d'attaque et Spool**.
Ces bases manquaient, donc les mods correspondants restaient « non simulés »
faute de valeur à laquelle les appliquer. Mods simulés : **314 → 330**.

- **Munitions max** : base par arme (Soma Prime 800) × (1 + %) → Tambour de
  Munitions, Compression d'Obus, Chargeur Truqué.
- **Pénétration** : mètres **PLATS** (Charpie +1,2 m, Cisaillement Prime
  +2,2 m, Vrille Métallique, Chercheur, Force Chercheuse…). Le parseur a une
  table `PLATES` pour ces clefs : elles ne passent pas par la division par 100.
- **Portée de rayon** : mètres plats aussi (Portée Sinistre +12 m, Extension
  Ruineuse +8 m). Affichée quand un mod la touche ou quand la portée de base
  est courte (≤ 60 m : rayons), pas pour les 300 m d'un fusil hit-scan.
- **Spool** (11 armes : Soma, Gorgon, Kohm, Supra, Tenora…) : nombre de tirs
  avant la cadence maximale. **Aucune source ne publie la COURBE de montée**,
  donc rien n'est inventé : le nombre de tirs est annoncé et le DPS affiché est
  déclaré comme celui à pleine cadence.
- Toujours pas simulé : le **recul**, dont aucune source ne donne la valeur de
  base. Les mods de recul restent honnêtement « non simulés ».

### Ce que v51 a apporté — le COMPTEUR DE COMBO
Quatre mods qu'on trouve dans presque tous les builds mêlée valaient zéro.
Formules relevées sur le wiki officiel le 03/09/2026, **telles quelles** :

| Mod | Formule |
|---|---|
| Coup de Sang | `CC = CC base × [1 + mods CC + BR × (combo − 1)]` |
| Blessures Suintantes | `SC = SC base × [1 + mods SC + WW × (combo − 1)]` |
| Surcharge d'État | `dégâts = base × [1 + mods dégâts + (CO × n)]`, n = types de statut |
| Furie du Berserker | `+35 %` (Prime `+64,2 %`) vitesse d'attaque, 2 cumuls |

**Paliers** : ×2 à 20 coups, +1 tous les 20 coups, plafond ×12 à **220** coups
(le palier n demande `(n − 1) × 20` coups — pas `n × 20`, l'erreur que j'avais
d'abord écrite). ×13 est réservé à la Venka Prime, non modélisé.

**Point capital, écrit noir sur blanc dans l'interface** : le multiplicateur de
combo **ne multiplie PAS les attaques normales** (wiki : « Melee Combo
Multiplier does not multiply the damage of your normal attacks »). Il sert aux
attaques lourdes et à ces mods. C'est pour ça qu'il est un **réglage explicite**
(sélecteur ×1…×12, défaut ×1 = aucun bonus) et pas une hypothèse.

Deux réglages, tous deux à zéro par défaut : le **multiplicateur de combo** et,
quand Surcharge d'État est équipée, le **nombre de types de statut sur la
cible**. Rien n'est supposé à la place du joueur.

**Montée du combo** : les combos de la posture donnent maintenant leurs
**points**. Règle du wiki : 100 % de multiplicateur de posture = 1 point, donc
un combo à 1900 % vaut 19 points. Le panneau en déduit la vitesse de montée —
« Guiding Light donne 7,3 pts/s → ×12 en 30 s de frappe continue ». C'est la
jonction entre le chantier des postures et celui du combo.

Aussi : **durée du combo** (base par arme, + Décompte des Morts, Contact
Errant) et **combo initial** (Charge Corrompue). Mods simulés : **330 → 337**.

### Ce que v52 a apporté — ATTAQUE LOURDE & ALLONGE
- **Attaque lourde** : `dégâts normaux moddés × multiplicateur fixe de la
  classe d'arme × multiplicateur de combo` (wiki). Le multiplicateur de classe
  n'est **pas** recopié depuis la table du wiki : il se déduit de l'arme
  elle-même (Nikana Prime, 990 de lourde pour 198 de base = **×5**), donc il
  reste juste pour les 269 mêlées sans maintenance.
  Coup Mortel (+120 %) s'ajoute dans le **même seau que Point de Pression**
  (wiki : « additive to mods such as Pressure Point »), mais pour la lourde
  seule — d'où le rapport `multHvy / mult` appliqué au total moddé.
  C'est le **seul endroit** où le multiplicateur de combo agit sur les dégâts.
- **Temps de charge** : base par arme, accéléré par Coup Mortel et Élan Rapide.
  Écrit dans l'interface : la vitesse d'attaque ne réduit **pas** le temps de
  charge, elle réduit l'intervalle entre deux lourdes.
- **Efficacité d'attaque lourde** : affichée en « combo consommé ».
- **Allonge** : base par arme (Nikana Prime 2,5 m) + Atteinte (+1,5 m) et
  Atteinte Accrue Prime (+3 m) — des **mètres plats**. Le diagnostic réclamait
  Atteinte depuis v45 sans jamais pouvoir la chiffrer ; c'est réglé.

Mods aux effets simulés : **337 → 344** sur 655 (259 au début de la session).

### Ce que v53 a apporté — ADAPTATION
Le premier des mods vraiment **conditionnels** à être chiffré, sur le patron du
compteur de combo : un réglage explicite, décoché par défaut, jamais supposé.

Règle du wiki (03/09/2026) : +10 % de résistance par coup reçu, **plafond
90 %**, 20 s, **séparément pour chaque type de dégât** — et surtout
**multiplicative** avec les autres réductions, dont l'armure.
D'où le calcul : `PV effectifs ÷ (1 − plafond)`. Chroma Prime nue = 925 PV
effectifs (370 × (1 + 450/300)) → **9250** aux cumuls max.

Le parseur retient le **plafond**, pas le pas de 10 % : c'est la valeur qui a
un sens dans un simulateur de build. Le motif tolère les trois séparateurs que
la source utilise entre les deux phrases (saut de ligne réel, `\n` littéral,
tiret cadratin).

Mods aux effets simulés : **344 → 346**.

### Ce que v54 a apporté — la SURGARDE (overguard)
Chef de Meute (+1 200) et sa version Prime (+2 200) sont désormais chiffrés.
Deux points de règle, relevés sur le wiki le 03/09/2026 :

- **À qui** : le mod soigne le **compagnon** à chaque coup de mêlée de la
  Warframe, et le surplus de soin devient de la surgarde, jusqu'à ce plafond.
  C'est donc le panneau compagnon, pas celui de la frame.
- **Comment** : « Overguard is **not** affected by Damage Reduction from armor
  […] or Damage type resistance effects such as **Adaptation** ». Elle ne se
  multiplie donc avec **rien** — ni l'armure du compagnon, ni l'Adaptation
  posée sur la frame (v53). Elle est affichée comme un **tampon à part** et
  n'est jamais fondue dans des « PV effectifs ». C'est écrit sous le tableau,
  avec les 0,5 s d'invulnérabilité à la rupture et l'annulation des statuts.

Piège de parsing au passage : la source écrit les milliers avec une virgule
(« +1,200 »), que `Number()` rend `NaN`. La branche des valeurs plates les
retire désormais.

Mods aux effets simulés : **346 → 348**.

### Relecture du 03/09/2026 — quatre défauts trouvés en me relisant
Aucun n'avait été signalé par les tests : ils vivent tous dans des cas limites
que la recette ne visitait pas.

- **Division par zéro (×3).** Le champ de saisie d'un riven accepte −200 % à
  +400 %, et `dmg` en fait partie. À −100 %, `mult = 1 + f.dmg = 0`.
  L'attaque lourde (v52) affichait alors **`NaN`** — vérifié avant/après —
  et le rechargement (défaut plus ancien) divisait aussi par zéro.
  Gardes posés aux trois endroits : `mult > 0` pour la lourde, plancher 0,01
  pour le rechargement, borne sous 1 pour Adaptation.
- **Adaptation additionnée au lieu d'être plafonnée.** C'est le vrai défaut de
  conception : « stacks up to 90% » est un **plafond**, pas un bonus. Deux
  exemplaires donnaient 180 %. L'interface l'interdit (même famille de mod),
  mais `restaure()` avale un build depuis le hash d'URL **sans validation** —
  un lien de partage bricolé passait outre. `sommeFx` retient désormais le
  **maximum** pour ces clefs (table `FX_MAX`), pas la somme : deux Adaptation
  donnent 90 %, comme en jeu.

Trois tests de non-régression, dont un qui emprunte le vrai chemin d'attaque
(un lien `#b=` fabriqué). Piège de recette au passage : changer seulement le
HASH d'une page déjà ouverte ne la recharge pas, donc `restaure()` ne repasse
pas — il faut un `reload()` explicite.

### Le garde-fou « rendu » ne pouvait pas finir (03/09/2026)
Rouge ou annulé depuis le 17/07/2026, et ce n'était ni un caprice ni les
poussées : **le job dépassait son propre `timeout-minutes: 20`**. Mesure du
runner GitHub : l'étape de contraste a tourné **19 min 31 s sans finir** sur
3196 chargements, puis a été coupée. Les trois étapes suivantes (débordement,
cibles tactiles, CLS) n'ont jamais eu leur tour. Leur « échec » était un
`exit 143` — le SIGTERM de la coupure, pas un vrai échec.

**Cause** : le groupe `css/pandaahh.css` chargeait ses 1586 pages sans
échantillonnage, dont 750 dans `builds/` et 750 dans `en/builds/` — deux
arbres produits par un seul gabarit. On chargeait 1500 fois la même mise en
page pour vérifier les mêmes couleurs. Le groupe `css/style.css`, juste à côté
dans le même fichier, était déjà échantillonné.

**Correctif** : `samplePagesLinking()` dans `lib_decouverte_pages.mjs`, branché
dans les **quatre** garde-fous. Résultat vérifié programmatiquement :

| | avant | après |
|---|---|---|
| pages `pandaahh.css` | 1586 | **94** |
| chargements (× 2 thèmes) | 3172 | **188** |
| pages hors `builds/` | 86 | **86 — toutes gardées** |

**Le seuil compte.** `discoverObjectTrees()` se déclenche dès 5 fichiers, ce
qui convient à son usage d'origine (`/o/`, 3800 pages) mais attrape ici la
RACINE du site et `en/` — des collections de pages écrites à la main, chacune
avec son CSS propre. Les échantillonner aurait fait perdre de la vraie
couverture. D'où `MIN_ECHANTILLON = 100`.

### Rendre les garde-fous exécutables en local (fait le 03/09/2026)

Chaque page mettait **12,7 s** à charger dans ce conteneur, dont 12,5 à
attendre Google Fonts et AdSense avant qu'ils n'échouent : un scan complet
demandait des heures, donc aucune vérification avant de pousser, donc des
allers-retours de 13 minutes vers le CI pour départager des hypothèses. C'est
ce qui a coûté le plus cher cette nuit-là.

`scripts/lib_blocage_externe.mjs` coupe les requêtes sortantes, **uniquement**
si `VR_BLOQUER_EXTERNE=1` est dans l'environnement. Branché dans les quatre
garde-fous.

    VR_BLOQUER_EXTERNE=1 node scripts/verifier_cibles_tactiles.sh
      108 pages : ~23 min -> 1 min 12 s
    VR_BLOQUER_EXTERNE=1 node scripts/verifier_cls.mjs
      42 pages x 3 essais : 5 min 32 s

**Le défaut est INCHANGÉ** : sans la variable, aucune route n'est posée
(vérifié dans les deux sens) et le CI continue de mesurer les pages telles que
les voit un visiteur, ressources tierces comprises.

**Ce que ça ne remplace pas** : un scan ainsi accéléré ne voit ni les polices
ni la publicité, donc il ne prouve rien sur les défauts qui en dépendent. Il
sert à itérer vite ; le CI reste le juge.

Et si un jour tu dois reproduire une mesure du CI à l'identique, la leçon de
cette nuit vaut d'être relue : voir « CLS : ce que j'ai cru, et ce que c'était
vraiment » — copier le CONTEXTE du garde-fou (pas seulement sa taille d'écran)
et mesurer AU BON MOMENT.

### v55 — Coaction Drift et Acier Préparé (03/09/2026)

Deux trous de la même famille que le bug d'auras de v49 : la valeur était dans
le texte du mod, c'est le LIBELLÉ qui n'était lu par aucun motif.

* **Art de la Coaction** (Coaction Drift) porte deux moitiés qui ne disent pas
  la même chose (wiki) : « Aura Strength » augmente l'effet de TON aura sur
  tout le monde, « Aura Effectiveness » l'effet des auras des AUTRES sur toi.
  Pour le porteur elles se **multiplient** : (1 + 15 %)² = **×1,3225**, et non
  ×1,30. C'est le piège ; une vérification l'interdit explicitement.
  Charge d'Acier passe de +60 % à +79,3 %, et la note de provenance annonce la
  mise à l'échelle et le mod responsable — elle affiche ce qui est VRAIMENT
  appliqué, pas la valeur nominale du mod.
* **Acier Préparé** donne +24 de combo initial. C'est une AURA : la valeur vit
  sur la frame et devait franchir le même pont que Charge d'Acier
  (`auraComboDe`) — sans lui le mod aurait été lu par le parseur et serait
  malgré tout resté sans effet. Piège à retenir pour tout futur mod d'aura
  dont la clef est côté arme.

Mods aux effets simulés : 348 → 350 sur 655.

### v56 — les auras, troisième passe (03/09/2026)

Élan Rapide (aura « Swift Momentum ») et Dresseur (« Shepherd »). Leurs clefs
existaient déjà — vitesse de charge (v52), durée de combo (v51), PV et armure
du compagnon (v54) : seul le **pont** manquait. Nikana Prime : charge 0,5 →
0,38 s, combo 5 → 11 s. Chesa Kubrow : 940 → 1240 PV, 300 → 480 d'armure.

Deux enseignements réutilisables :

* Leurs textes portent **deux valeurs dans une seule phrase**. Une clef de
  motif peut désormais être un TABLEAU, la n-ième clef recevant le n-ième
  groupe capturé.
* Le pont d'aura est factorisé (`auraFrameCle`). C'est le piège récurrent de
  cette famille : la valeur vit sur la FRAME alors que la clef vit sur l'arme
  ou le compagnon. Sans pont, le mod est lu par le parseur **et reste sans
  effet** — l'échec le plus silencieux du moteur. Tout nouveau mod d'aura dont
  la clef n'est pas une stat de frame en a besoin.

Piège de nommage : « Élan Rapide » désigne AUSSI une mêlée (« Quickening »).
Sélection par uniqueName partout, comme Furie du Berserker en v51.

### v57 — résistances par type de dégât (03/09/2026)

Neuf mods permanents (Antitoxine, Ignifugé, Isolation, Paratonnerre, Peau de
Diamant, Amortisseurs de Choc, l'aura Résistance aux Toxines). Wiki, page
Flame Repellent : « Damage resistance works on both health and shields. It
also works for damage over time effects. Damage resistance bonus is
**MULTIPLICATIVE** with other sources of damage resistance such as
Adaptation. »

D'où une **troisième sémantique de cumul** dans `sommeFx`, après la somme (le
cas courant) et le maximum (les plafonds, `FX_MAX`) : la table `FX_RES`
compose par 1 − (1 − a)(1 − b). 45 % + 15 % donnent 53,25 %, pas 60 %.

Deux partis pris d'affichage :
* les résistances ne sont PAS fondues dans le chiffre unique de PV effectifs
  (il serait faux contre tout autre type) — une ligne par type résisté ;
* Ignifugé Prime donne vraiment 100 % : le simulateur répond « immunisé »
  plutôt qu'un très grand nombre issu d'une division par presque zéro.

Mods aux effets simulés : 348 → 364 sur 655 au fil de v55–v57.

### v58 — Munitions du Chasseur et le saignement (03/09/2026)

Le morceau que les « pistes suivantes » annonçaient comme le plus gros. Règle
relevée sur le wiki (`Damage/Slash_Damage` et `Hunter_Munitions`) :

    tick = 0,35 × dégâts de base MODDÉS × (1 + faction)
                × (1 + dégâts de statut) × multiplicateurs additionnels
    dégâts de base moddés = base × (1 + mods de dégâts) × (1 + faction)

Trois points décident de tout, et deux sont contre-intuitifs :

* « their damage only depends on the weapons modded base Damage and is
  therefore **NOT** affected by elemental and physical damage mods » — une
  Dentelure compte, un Feu des Enfers ou un Buzz Kill **non**. D'où un calcul
  qui repart de `baseTot × mult`, surtout pas de `tot` (qui contient déjà les
  éléments). **Deux vérifications gardent ce piège fermé** : le saignement
  doit rester identique quand on ajoute un mod élémentaire.
* « Additional Multipliers include modded critical multiplier on Critical
  Hit » — et le proc n'existe QUE sur un critique, donc le multiplicateur
  critique s'applique **toujours**. Au-delà de 100 % de chance critique, le
  moteur calcule le multiplicateur MOYEN sur les paliers n et n+1 (les
  critiques « orange » et « rouges » du wiki).
* Les ticks **ignorent l'armure**. C'est tout l'intérêt du mod — et la raison
  pour laquelle ce DPS est affiché À PART et jamais ajouté au DPS du dessus,
  qui la subit. Même règle qu'en v54 pour la surgarde.

Soma Prime nue + Munitions du Chasseur : 12,6 par tick, 1,10 proc/s, **83** de
DPS de saignement. Avec Dentelure : 33,4 par tick, **221**. Avec en plus un Feu
des Enfers : **221**, inchangé.

Ce que v58 laissait de côté, en le disant dans l'interface — les mods de
**durée de statut** — est traité en v63, plus bas.

**Restent dans la même famille** : Hémorragie (pistolet) et Hémorragie Interne
(fusil) — « Impact Status Effects have 35% chance to apply a Slash Status
Effect (x2 when Fire Rate is below 2.5) ». Le modèle de saignement est
désormais en place ; il ne manque que la probabilité d'un proc d'Impact, qui
se déduit de la chance de statut et de la part d'Impact dans les dégâts, deux
valeurs que le moteur a déjà.

### v59–v62 — les quatre chantiers « à la Overframe » (03/09/2026)

* **v59 — fiche du build** : titre, auteur et notes voyagent dans le lien.
  Aucun serveur. Deux pièges, invisibles en relisant le code : `rendFiche()`
  était câblé bien AVANT l'appel à `restaure()` (tout en bas du fichier), et
  l'assainissement était placé DANS `restaure()`, qui sort par un `return` dès
  qu'un lien est reconnu — la protection sautait donc sur le seul chemin qui en
  a besoin. `restaure()` est scindée : `restaureBrut()` charge, `restaure()`
  assainit ensuite, quel que soit le chemin.
* **v60 — comparateur à N colonnes** : l'actuel plus tous les builds
  enregistrés, meilleure valeur de chaque ligne en avant. Le maximum par ligne
  n'est légitime QUE parce que, sur ces stats, plus grand vaut mieux — le jour
  où une stat inverse entre au tableau (rechargement, coût d'énergie), il
  faudra un sens par ligne.
* **v61 — classement des armes** : toutes montées par le MÊME algorithme avec
  le MÊME objectif. 195 principales en 465 ms. Il a révélé une anomalie que
  regarder une arme à la fois cachait : le Sirocco est la SEULE arme de type
  « Pistol » rangée dans les principales, et le moteur la monte avec des mods
  qu'elle ne porte pas en jeu. Non filtrée, mais annoncée — une colonne Type et
  une note. Filtrer aurait été mentir par omission.
* **v62 — bibliothèque publique** : écrite, PAS branchée (voir ci-dessous).

### Synchronisation par code — pourquoi PAS de comptes (03/09/2026)

La question posée était « faut-il permettre au visiteur de créer un compte
pour sauver sa progression ? ». Réponse : **non**, et la raison vaut d'être
gardée.

**Le besoin n'est pas une identité.** Le visiteur veut retrouver ses affaires
sur un autre appareil et ne pas tout perdre en vidant son navigateur. C'est de
la SYNCHRONISATION. Un compte répond à une question qu'il ne pose pas, et
apporte : des mots de passe à protéger, des e-mails à vérifier, du support, et
— site français — le RGPD au complet (données personnelles, droit à
l'effacement, droit à la portabilité).

**Le code fait le même travail sans rien de tout ça** : 20 signes aléatoires
(~99 bits), aucune donnée personnelle, donc empreinte RGPD quasi nulle.

**Trois règles portent la sûreté du dispositif, et elles sont testées**
(`node scripts/verifier_sync.mjs`, 22 cas) :

1. **Liste blanche.** On ne synchronise QUE les clefs nommées dans
   `js/sync.js`. Le stockage local contient aussi `wmuser` (un compte
   warframe.market) et `wfproxy` (une URL de proxy personnelle) : tout envoyer
   en bloc les aurait emportés. Une liste NOIRE aurait laissé passer la
   prochaine clef ajoutée par mégarde ; une liste blanche, non.
2. **Chiffré chez le visiteur.** Le serveur ne reçoit qu'un paquet AES-GCM et
   une empreinte du code. Il ne connaît ni le code, ni le contenu — vérifié :
   le texte en clair n'apparaît nulle part dans le paquet, et un autre code ne
   déchiffre pas.
3. **Code perdu = données perdues**, par construction. Le serveur ne peut pas
   dépanner. C'est dit dans l'interface AVANT d'agir, et dans
   `/confidentialite`.

`confidentialite.html` affirmait que les données « ne sont jamais envoyées au
site ». C'était vrai avant, ça devenait FAUX : la phrase est corrigée et une
section décrit ce qui part, ce qui ne part jamais, et l'absence de
récupération. Une page de confidentialité qui ment est pire que pas de page.

**Quand les comptes redeviendront la bonne réponse** : le jour où les gens
voudront modifier ou supprimer LEURS builds dans la bibliothèque, se
construire une réputation, ou quand les votes seront abusés malgré l'empreinte
d'IP. Même alors, deux détours évitent les mots de passe — un jeton d'édition
par build (donné à l'envoi), et une connexion Discord ou Google si l'identité
devient vraiment nécessaire.

Même mise en place que la bibliothèque : la table `sync` est dans
`functions/api/builds.schema.sql`, et la liaison D1 est la même (`BUILDS`).

### Bibliothèque de builds : ce qui reste à faire côté Cloudflare

`functions/api/builds.js` et son schéma sont écrits, mais la bibliothèque
**ne fonctionnera pas** tant que ces quatre étapes ne sont pas faites dans le
tableau de bord Cloudflare — elles demandent un accès au compte :

    1. D1 → Create database → nom : voidrelay
    2. Console SQL → coller functions/api/builds.schema.sql
    3. Pages → warframe-hub → Settings → Functions → D1 bindings :
         variable BUILDS  →  base voidrelay
    4. Settings → Environment variables :
         VR_ADMIN_TOKEN = <secret long>   (modération)
         VR_SEL_IP      = <autre secret>  (sel des empreintes d'IP)

D'ici là, `/api/builds` répond 503 et l'interface l'ANNONCE au lieu de casser
(vérifié par la recette). Le partage par lien, lui, marche déjà.

**Deux choix de conception, et leurs raisons.** D1 plutôt que KV : la question
posée est toujours « les builds de CETTE arme, triés par votes », que KV ne
sait pas faire sans un index maintenu à la main et relu en entier à chaque
vote. File de validation plutôt que publication libre : il n'y a pas de
comptes, donc personne n'est responsable de ce qu'il publie, et le site porte
le nom de son auteur et de la publicité. Débit (5/h par empreinte) et tailles
bornées par-dessus. Les IP ne sont jamais stockées, seulement une empreinte
salée — de quoi limiter le débit et dédoublonner les votes, rien de plus.

**Ce qui est vraiment vérifié** : `node scripts/verifier_api_builds.mjs` —
21 cas sur la seule barrière entre le public et la base (nettoyage des champs,
validation du lien). Un domaine qui CONTIENT voidrelay.fr est refusé,
`javascript:` aussi. Le schéma est exécuté contre un vrai SQLite (D1 en est
un) et la contrainte anti-double-vote est prouvée.

### CLS : ce que j'ai cru, et ce que c'était vraiment (03/09/2026)

**Une version antérieure de ce document affirmait que le CLS de /courses.html
venait d'Auto ads et relevait d'un arbitrage produit. C'était FAUX.** Les deux
causes étaient à nous, et voici les deux pièges qui m'ont fait tourner en rond
— ce sont eux qu'il faut retenir.

**Piège 1 — le contexte de mesure.** Je mesurais en local avec un contexte
Playwright « mobile » (`isMobile` + `hasTouch`), alors que
`verifier_cls.mjs` n'active NI l'un NI l'autre : `viewport: {width:390}` seul.
Ces options changent l'application de la balise viewport, donc la mise en
page. Avec le contexte EXACT du garde-fou, le défaut se reproduit en local à
la valeur près (0.1316) en deux secondes. **Reproduire un garde-fou, c'est
copier son contexte, pas seulement sa taille d'écran.**

**Piège 2 — mesurer au mauvais moment.** Ma sonde relevait la hauteur des
blocs publicitaires à la FIN de la mesure. Or Auto ads insère un bloc, ne le
remplit pas, puis le replie à zéro : lu 2,5 s plus tard, il paraît innocent.
La sonde relève désormais nombre et hauteur **à l'instant de chaque secousse**.

Les deux vraies causes :

1. **/courses.html** — `#cbody` rempli après le premier rendu (source nommée
   par la sonde : « footer.foot 472 → 595 »). Appeler `render()` depuis
   `init()`, donc sur DOMContentLoaded, est DÉJÀ trop tard. Le script étant
   placé après `#cbody`, il dessine pendant l'analyse du HTML.
2. **/codex.html** — `js/warp.js` INJECTE `.langbtn` dans l'en-tête après le
   premier rendu ; sur mobile `.topbar` passe à la ligne et l'en-tête gagne
   une rangée (56 px). Sa place est réservée en CSS, sous
   `@supports selector(:has(*))` — sans ce garde, la réserve subsisterait EN
   PLUS du bouton sur les navigateurs sans `:has()` et causerait le passage à
   la ligne qu'elle évite.

Mesuré, contexte identique au garde-fou : 0.1316 → 0.0016 (courses, FR et EN)
et 0.2687 → 0.0016 (codex).

Écartés par la mesure et non par le raisonnement : les polices Google
(servies depuis le disque, délai balayé de 0 à 400 ms) et AdSense (relayé via
curl pour qu'il fonctionne réellement dans le conteneur).

### v63 — la durée de statut, et donc le nombre de ticks (03/09/2026)

v58 avait écrit sa propre lacune dans l'interface : « non modélisé, les mods de
durée de statut ». v63 la referme, parce qu'une lacune qu'on affiche est la
plus facile à choisir comme chantier suivant.

Règle du wiki, reprise telle quelle : « Using Hunter Track in tandem with
Hunter Munitions will increase the base 6-second duration to 11.4 seconds,
**allowing for 11 ticks of damage** rather than the normal 6 ticks. » Donc :

    durée = 6 s × (1 + durée de statut)
    ticks = plancher(durée)          ← 11,4 s ⇒ 11 ticks, PAS 12

Le plancher est le point qui décide de tout : un tick par seconde, un délai
d'une seconde avant le premier, et la fraction restante ne donne pas de tick.
Une vérification garde ce piège fermé — elle exige 11 et refuse 12.

Sept mods entrent : Pistage du Chasseur, Agonie Perpétuelle, Dard Persistant,
Misère Continue, Chercheur d'Augure, Tourment Persistant. **Résilience Rapide
est volontairement exclue** : son texte est `-75% Status Duration on Self`,
c'est-à-dire les statuts subis PAR la Warframe, jamais ceux qu'elle inflige.
Le motif du parseur est donc **ancré** (`/^\+([\d.]+)% Status Duration$/i`) —
non ancré, il aurait attrapé Résilience Rapide et raccourci le saignement au
lieu de l'allonger. Le mod reste `fx=null`, ce qui est le résultat voulu.

Mesuré : Soma Prime + Munitions du Chasseur = 6 ticks, **83** de saignement.
Avec Pistage du Chasseur (+90 %) = 11 ticks sur 11,4 s, **153**. La note sous
le tableau dit maintenant la durée et le nombre réels de ticks, et d'où
viennent les ticks supplémentaires.

Mods aux effets simulés : 365 → **371** sur 655.

### Profils de marché — cinq façons de jouer, cinq classements (03/09/2026)

La demande : « il y a plusieurs types de personnes, ceux qui farment et vendent,
ceux qui achètent partie par partie pour revendre plus cher, ceux qui achètent
au plus bas et revendent plus cher — que chaque personne se retrouve ».

Le site avait déjà les prix ; il n'avait qu'UN classement, et il servait le même
à tout le monde. Or la donnée est commune, la QUESTION ne l'est pas. Cinq
profils, un `localStorage["vr_profil"]` (un mot, aucune donnée personnelle,
ajouté à la liste blanche de la synchro), et un bandeau qui rappelle le profil
sur `/marche`, `/marche-complet`, `/estimateur`, `/trade` et `/bons-plans`.

| profil | sa question | ce qui TRIE |
|---|---|---|
| 🎯 farmeur | ce que ma pièce rapporte | la vente la plus basse |
| 🧩 monteur de set | monter coûte-t-il moins cher qu'acheter | écart aligné |
| ⚡ flipper | où l'écart paie encore | marge patiente |
| 💎 ducatier | ducats par platine dépensé | le ratio |
| 🌱 débutant | ce qui part tout de suite | part de la médiane déjà offerte |

**Le classement du farmeur trie sur la vente la plus basse, pas sur la médiane.**
Pour vendre aujourd'hui il faut s'aligner sur le moins cher ; trier sur la
médiane aurait flatté le chiffre et menti sur la recette.

#### Trois choses que la MESURE a imposées, contre ce que j'avais écrit d'abord

**1. Les rangs étaient mélangés — sur tout le site, depuis toujours.** Le
03/09/2026, Arcane Steadfast affichait 6 ventes au rang 0 (à partir de 10 p) et
13 au rang 5, pendant que les demandes d'achat étaient au rang 5 (jusqu'à
840 p). `market.json` en tirait « vente 10, achat 840 » : **830 platine de marge
sur deux objets différents**. Un arcane rang 0 et rang 5 ne sont pas le même
objet. `_prix_ordres` retient désormais le rang qui porte le plus de ventes et
calcule DEDANS. Le même jour, Primed Flow voyait son prix tiré vers le bas par
un unique rang 1 à 35 p quand le marché était à 38 au rang 0. Ce défaut ne
cassait aucune page : il fabriquait des chiffres faux, tranquillement. 16
vérifications le tiennent fermé (`scripts/verifier_prix_rangs.py`).

**2. Le nombre de pièces, et les sets imbriqués.** Akbolto Prime demande DEUX
canons et DEUX récepteurs : sommer les pièces à l'unité sous-évaluait le montage
de ~145 platine et faisait passer un set perdant pour une affaire. Et Aklex
Prime ne demande pas des pièces de Lex Prime — il demande **deux Lex Prime
entières**, donc un autre set. Sans ce cas, quatre pièces sur 338 restaient
introuvables et deux sets affichaient un coût faux plutôt qu'absent.
`data/set_pieces.json` (91 sets, 336 pièces, zéro orphelin) porte la recette,
`itemCount` compris ; `data/market_pieces.json` porte leurs prix.

**3. L'aller-retour immédiat ne paie sur AUCUN objet suivi.** J'avais construit
le classement du flipper sur la marge instantanée — acheter l'offre basse,
revendre à la demande haute. Mesuré : **0 sur 124**. Un marché liquide ne laisse
pas d'argent par terre. Le tri est donc passé sur la marge PATIENTE (acheter la
2ᵉ offre, remettre au prix du marché) — positive sur 57 objets — et la page
affiche le verdict au lieu de proposer un « top 40 » de pertes. C'est la
meilleure information du tableau, et un classement seul ne l'aurait jamais dite.

#### Le principe qui traverse les cinq calculs : jamais l'extrême

Le meilleur ordre, des deux côtés, est régulièrement isolé et absurde — une
erreur de saisie, un joueur qui ne répondra pas. Trier dessus remonte les
accidents en tête, exactement là où l'œil se pose. Tous les calculs prennent le
**DEUXIÈME** prix de chaque côté (`low5SellPlat[1]`, `high5BuyPlat[1]` — ce
dernier ajouté pour ça) et **marquent** l'extrême au lieu de le cacher. Le profil
débutant en dépend le plus : c'est celui qui a le moins de moyens de flairer un
ordre isolé, et lui promettre 840 platine parce qu'un joueur a mal tapé serait
la pire des tromperies.

Aucun score composite : chaque profil est trié par LA grandeur qui répond à sa
question, les nuances (concurrence, liquidité, second prix, nombre de trades)
sont AFFICHÉES à côté. Un chiffre qu'on ne peut pas expliquer ne sert à personne.

#### Ce que ça a coûté au reste

* `js/profil.js` (le profil), `js/profil-classement.js` (les cinq calculs, purs),
  `js/marche-profils.js` (le rendu, qui ne calcule rien).
* Le bandeau est posé en HTML puis rempli **pendant l'analyse de la page**, pas
  au chargement : rempli après, il décalerait tout ce qui suit — exactement ce
  que le garde-fou CLS traque.
* `/trade` s'ouvre sur WTB pour le flipper et le ducatier. Un clic, mais c'est
  le genre de détail qui fait qu'on se sent chez soi.
* Les pièces sont tarifées **au plus une fois par jour** (`pieces_perimees`) :
  336 requêtes de plus toutes les 4 h serait discourtois envers une API
  communautaire gratuite, pour une donnée qui ne bouge pas d'heure en heure.
* **Les garde-fous « purs » sont enfin branchés en CI.** `verifier_sync`,
  `verifier_api_builds`, `verifier_profils` et `verifier_prix_rangs` vivaient à
  côté de la CI : ils ne tournaient que quand j'y pensais. Ils sont dans
  `verifier_invariants.sh`, donc à chaque push. Un garde-fou que personne ne
  lance n'est pas un garde-fou.

Vérifié : 35 vérifications sur les classements, 16 sur les prix par rang, 34 en
bout-en-bout (`tests/e2e/test_marche_profils.py`), invariants OK sur 5693 pages,
et les quatre garde-fous de rendu (contraste 214 chargements, débordement 111
pages, cibles tactiles 109, CLS 42).

**Le garde-fou de contraste a attrapé une régression sur la page qui l'ajoutait.**
Les trois pastilles (« peu de concurrence », « marché écrasé », « fantôme ? »)
n'avaient qu'une couleur, pensée pour le fond sombre : en clair, le vert tombait
à **2,56:1** pour un minimum AA de 4,5. C'est mot pour mot la régression du
09/07/2026 que ce garde-fou existe pour empêcher — une couleur fixe sur un fond
devenu variable. Corrigé en donnant à chaque pastille sa couleur par thème ;
recalculé à la main sur les douze combinaisons (3 pastilles × 2 thèmes × fond
normal/survol) : le pire cas est à 4,85:1.

**Piège de banc d'essai, à ne pas réapprendre** : lancé sans
`VR_BLOQUER_EXTERNE=1`, le garde-fou de contraste ne rame pas — il se BLOQUE.
Le navigateur attend le script publicitaire de Google, que le proxy de sortie du
conteneur ne laisse jamais aboutir : 31 minutes à 0,2 % de CPU, et zéro page
mesurée. Toujours exporter la variable en local.

#### Ce qui reste ouvert sur ce chantier

* **Destreza Prime** est le seul set écarté du monteur : sa lame n'a aucun
  vendeur en jeu. Écarté et nommé, jamais complété par une estimation.
* Le **Sirocco** reste rangé dans les principales (cf. v61) — même famille de
  bizarrerie, même parti pris : annoncer plutôt que filtrer.
* ~~Pas de version **anglaise**~~ — faite : `/en/market-profiles`. La bascule est
  la même que celle du simulateur (`document.documentElement.lang`), portée par
  `js/profil.js` et réexportée pour `js/marche-profils.js` : **une seule** source
  de langue, celle de la page. Une vérification liste les mots français qui ne
  doivent PAS apparaître dans le rendu anglais (« Médiane », « Chargement »,
  « il y a », « ton profil »…) — une traduction à moitié faite est pire qu'une
  page absente, et seuls les libellés statiques se voient à l'œil : ceux que le
  JavaScript fabrique (verdict du jour, âge des prix, détail des pièces) passent
  inaperçus jusqu'à ce qu'un anglophone tombe dessus.
* Le profil ne change PAS l'ordre des sections de `/bons-plans` — déplacer des
  blocs après chargement provoquerait le décalage que le point ci-dessus évite.
  À faire côté serveur ou pas du tout.

### v64 — Hémorragie : le saignement par l'IMPACT (04/09/2026)

Le dernier morceau de la famille ouverte en v58. Hémorragie (pistolet) et
Hémorragie Interne (fusil) portent toute leur règle dans leur texte :
« Impact Status Effects have 35% chance to apply a Slash Status Effect
(x2 when Fire Rate is below 2.5) ».

**Le saignement est le même qu'en v58 ; la chaîne qui y mène n'a rien de
commun**, et c'est tout l'intérêt du chantier. Trois différences décident du
chiffre :

1. **Le déclencheur est un statut d'Impact, pas un critique.** Il faut donc
   qu'un statut parte, ET qu'il tombe sur Impact. Le jeu tire le type de statut
   au prorata de la part de chaque type dans les dégâts du coup — **éléments
   compris**. D'où `out.impact / tot`, et non la part physique de base.
2. **Conséquence contre-intuitive, et l'INVERSE exacte de v58** : un mod
   élémentaire **dilue** la part d'Impact, donc **fait baisser** ce saignement,
   alors qu'il laissait Munitions du Chasseur rigoureusement indifférent.
   Mesuré sur un Gorgon Wraith : **37 → 20** en ajoutant un Feu des Enfers, la
   part d'Impact passant de 84,9 % à 44,7 %. Les deux sens sont vérifiés côte à
   côte, sur la même arme, dans le même build.
3. **Le critique n'est pas requis.** Le multiplicateur critique ne s'applique
   donc qu'au *prorata* des coups critiques — `1 + cc × (cm − 1)` en moyenne —
   et non le `cmProc` de v58, qui vaut « sachant qu'il y a eu critique ». Deux
   moyennes qui portent le même nom et ne se valent jamais.

La clause « ×2 sous 2,5 de cadence » se lit sur la cadence **moddée** : un mod
de cadence peut faire franchir le seuil dans un sens comme dans l'autre. Elle
vit donc dans le moteur, pas dans le parseur, qui ne garde que les 35 % de base.

Mesuré : Gorgon Wraith nu (84,9 % d'Impact, statut 21 %, 9,23 tirs/s réels)
= 0,58 proc/s, 10,7 par tick, **37** de DPS. Chakkhurr Kuva (cadence 1,17, donc
chance doublée à 70 %) = **147**.

Les deux saignements s'affichent sur **deux lignes distinctes**, jamais
additionnés : les mods peuvent coexister, mais mélanger les chiffres cacherait
lequel porte le résultat — donc lequel retirer quand on cherche de la capacité.
Comme en v58 et v54, aucun des deux n'est fondu dans le DPS du dessus : ils
ignorent l'armure, lui la subit.

**Trouvé en chemin** : les clefs `hm` et `hem` n'avaient aucun libellé, donc la
carte de Munitions du Chasseur affichait « +30 % hm » — le nom interne. Un mod
dont on ne peut pas lire l'effet est aussi opaque qu'un mod non simulé.

Mods aux effets simulés : 371 → **373** sur 655.

### v65 — l'économie d'énergie, et un conditionnel d'aura (04/09/2026)

Cinq mods très joués que le moteur ignorait, en deux familles qui ne se
ressemblent pas — et aucune des deux ne change une stat du tableau.

**Rage, Rage Prime, Adrénaline du Chasseur** convertissent une part des dégâts
**reçus sur la santé** en énergie (40 %, 110 %, 45 %). Ce n'est ni de la survie
ni des dégâts : c'est un **taux de change**. Le seul chiffre honnête qu'on
puisse en tirer sans inventer les dégâts entrants est ce que rend **une barre
de santé entière** — il ne suppose rien d'autre que la frame elle-même. Chroma
Prime : 370 PV × 45 % = **167 d'énergie, soit 56 % de sa réserve (300)**. C'est
là que le mod devient lisible ; « +45 % » tout seul ne dit rien.

**Équilibre** porte deux valeurs dans une phrase (110 % / 110 %) et les deux
sens ne sont pas interchangeables — un orbe de santé qui rend de l'énergie n'est
pas un orbe d'énergie qui rend de la santé. Deux clefs, deux phrases, jamais
fondues en une.

**Pouvoir Grandissant** est le cas intéressant : une **aura** ET un
**conditionnel**. Son texte est rédigé côté escouade comme toutes les auras
(v49), mais le bonus est « personal » — il ne vaut que pour le porteur. Il ne
tombe surtout **pas** dans la clef `str` : l'y mettre reviendrait à promettre
+25 % de puissance en permanence alors qu'il faut d'abord infliger un statut
avec une arme, pour 6 s. Clef distincte `gstr`, case décochée par défaut, même
parti pris qu'Adaptation en v53.

**Une case qui ne change aucun chiffre visible est une case qui ne sert à
rien.** La première version affichait la condition dans une note et laissait la
case sans effet observable : corrigé avant de committer, le bandeau agrégé
gagne « avec Pouvoir Grandissant 125 % » à côté de la valeur permanente — même
forme que « avec Adaptation », et pour la même raison : on voit ce que la
condition achète, sans que la valeur de base mente.

La durée (6 s) est **parsée**, pas codée en dur : l'écrire dans le texte ferait
mentir l'interface le jour où DE la change.

Mods aux effets simulés : 373 → **378** sur 655.

**Piège de banc d'essai, découvert à mes dépens** : lancer `test_arsenal.py`
pendant que `npm run arsenal:data` tourne encore donne **huit échecs qui n'ont
rien à voir avec le code**. Les premières vérifications de la suite n'attendent
que 300 ms entre un clic et sa conséquence, ce qui suffit à vide et pas sous
charge. J'ai cru à une régression et j'ai bissecté (`git stash` sur le seul
`js/arsenal.js`) avant de comprendre. Attendre la fin de la cuisson, toujours.

### v66 — les conditionnels « en visée » (04/09/2026)

Choisi en MESURANT ce qui restait, pas en devinant : un regroupement des 277
mods encore sans effet chiffré, par forme de texte, a fait ressortir une famille
de **dix-neuf** mods bâtis sur la même phrase — « On Headshot: +135% Critical
Chance when Aiming for 9s ». Treize touchent les stats qui décident du DPS
(critique, dégâts critiques, statut, cadence), et on les trouve dans presque
tous les builds d'armes à feu : Viseur à Argon, Réticule Hydraulique, Salves de
Lames, Lien Catalyseur, les Galvanisés. Aucun n'était simulé.

**Deux pièges, et les deux auraient produit un chiffre faux en silence.**

1. **Le séparateur de la source est un `\n` LITTÉRAL** — deux caractères, pas
   un saut de ligne ni un espace. Mes cinq motifs, écrits avec `\s*`, ne
   matchaient rigoureusement rien : la cuisson passait, les mods restaient
   `fx:null`, et rien ne le signalait. Le diagnostic n'est venu qu'en allant
   lire la chaîne brute servie par l'API (`repr()` sur `levelStats`). Les motifs
   tolèrent désormais les trois séparateurs, comme celui d'Adaptation en v53.
2. **Les Galvanisés ont des PALIERS.** Viseur Galvanisé donne +120 % puis
   +40 % par palier jusqu'à cinq — soit **+320 %**, pas +120 %. Un motif à
   clause unique aurait sous-évalué de presque trois fois le mod le plus posé
   du jeu. D'où deux formes, et l'ordre compte : la variante à paliers est
   essayée EN PREMIER, sinon la simple lui vole la ligne.

**Le repli est explicite et global.** Cochée, la case replie les bonus dans les
clefs normales AVANT tout le reste du calcul : le DPS, les procs et le
saignement sont recalculés avec eux. C'est la seule façon de montrer ce que la
condition achète vraiment — et c'est aussi pour ça qu'elle est décochée par
défaut, comme Adaptation (v53), le compteur de combo (v51) et Pouvoir
Grandissant (v65). La case annonce les valeurs AVANT qu'on la coche : on voit
le gain sans avoir à basculer pour comparer.

Mesuré sur une Soma Prime : Viseur à Argon porte la chance critique de 30 % à
**70,5 %** ; Viseur Galvanisé à **126 %** (au-delà de 100 %, le modèle de
saignement de v58 bascule sur ses paliers orange/rouge — les deux chantiers se
rencontrent) ; Salves de Lames porte le multiplicateur de ×3 à **×6,6**.

Mods aux effets simulés : 378 → **391** sur 655.

**Ce que la mesure a écarté**, et pourquoi : les grosses familles restantes ne
sont pas chiffrables sans inventer une base que personne ne publie — durée
d'Aim Glide (12 mods), vélocité de parkour (9), recul (7), rayon d'explosion
(4), zoom (4). Les afficher en pourcentage nu n'apprendrait rien à personne.

### v67 — un seul prix est un mensonge sur un objet à rangs (04/09/2026)

Le correctif des rangs de la session (côté pipeline Python) ne réglait que la
moitié du problème. **Le navigateur a son propre calcul de prix**
(`summarizeStats`, `js/api.js`), utilisé par `/estimateur`, `/en/price-check`,
`/marche`, `/marche-complet`, `/courses`, `/favoris` et `/trade` — et il
appliquait une règle DIFFÉRENTE : le rang MAX, là où le pipeline retient le rang
qui porte le plus d'ordres de vente.

Mesuré sur les statistiques 48 h réelles :

| objet | rang MAX | rang le plus échangé | rapport |
|---|---|---|---|
| Arcane Energize | 136,6 p (rang 5, 196) | **8,1 p** (rang 0, 280) | **×17** |
| Primed Flow | 89,1 p (rang 10, 143) | 32,3 p (rang 0, 187) | ×2,8 |
| Primed Continuity | 106,5 p (rang 10, 83) | 45,9 p (rang 0, 110) | ×2,3 |

Le rang le plus ÉCHANGÉ est à chaque fois le rang 0 — pas celui dont on cite le
prix. **Aucune des deux valeurs n'est fausse** : ce sont deux objets différents
qui portent le même nom, et le visiteur qui vient estimer son arcane rang 0 lit
137 platine au lieu de 8.

**On n'arbitre pas, on divulgue.** Uniformiser les deux règles aurait demandé de
choisir laquelle a raison — or elles répondent à deux questions différentes (à
quel prix puis-je acheter maintenant / qu'est-ce qui change de mains). Le
chiffre principal reste donc celui du rang max, celui qu'on cite quand on dit
« un Flow Primé vaut 89 », et l'estimateur affiche désormais **le détail par
rang, trié du plus échangé au moins échangé**. Un objet sans rang n'affiche
rien de plus : inventer une phrase de rang pour un set serait du bruit.

Deux détails qui comptent : un rang sans prix médian est **écarté** du détail
plutôt qu'affiché à zéro (une ligne « rang 3 : 0 p » ferait croire à un objet
sans valeur), et le volume du chiffre principal est celui de SON rang, pas la
somme de tous.

Vérifié : 13 vérifications hors navigateur
(`scripts/verifier_prix_rangs_client.mjs`, branché en CI) et 5 bout-en-bout
dans les deux langues, sur un relevé réel rejoué hors ligne — c'est le vrai
chemin d'affichage qui est testé, seule la source de statistiques est
remplacée.

**Attribution honnête d'un échec voisin** : `test_marche_complet.py` échoue sur
« prix LIVE chargés au défilement » (2/12 pour un seuil de 3). Vérifié en
rejouant la même suite sur le commit précédent : **2/12 également**. C'est la
latence du relais, que le commentaire du test anticipe déjà — pas une
régression. Le seuil n'a PAS été abaissé pour faire passer : affaiblir un
garde-fou pour un mauvais jour de réseau, c'est le perdre.

### v68 — le créneau exilus avait une polarité, et le moteur l'ignorait (04/09/2026)

Trouvé en continuant de MESURER plutôt que de deviner : après avoir écarté les
familles de mods non chiffrables (v66), j'ai listé les champs que les modules du
wiki publient et que la cuisson n'utilise pas. `ExilusPolarity` en faisait
partie — et le moteur avait, en toutes lettres :

    if (i === "x") return "none";        // ← la polarité de l'exilus, en dur

Ce que le wiki publie vraiment :

| | avec polarité | sans |
|---|---|---|
| principales | **187 / 198** (95 madurai, 91 naramon, 1 universelle) | 8 |
| secondaires | **141 / 155** (78 madurai, 63 naramon) | 7 |
| mêlées | 1 / 269 | 268 |
| Warframes | 11 / 119 (9 naramon, 2 vazarin) | 108 |

**328 armes sur 353.** Le simulateur facturait donc le mod d'exilus au PLEIN
TARIF là où le jeu divise le drain par deux. Sur une Soma Prime, Feu des Enfers
en exilus passe de **11 à 6** — quatre points sur soixante, et la capacité est
la contrainte centrale d'un build : c'est elle qui décide si le build rentre.

Ce n'était pas un affichage approximatif mais un CHIFFRE FAUX, du même genre
que les rangs mélangés de la veille : rien ne cassait, rien ne le signalait.

Deux cas de bord traités plutôt que subis :

* **« Universal »** (le créneau exilus d'une arme) accepte n'importe quelle
  polarité. Sans traitement, la comparaison `polSlot === m.pol` l'aurait jugée
  DISCORDANTE — donc +25 % de drain au lieu de deux fois moins, l'erreur
  exactement inversée. D'où `polConcorde()`, qui porte la règle une seule fois
  pour le drain ET pour le bonus d'aura.
* **Aucune polarité** reste aucune polarité : les mêlées et les 108 Warframes
  concernées gardent leur drain plein. Une remise inventée serait le symétrique
  du défaut qu'on vient de corriger, et une vérification l'interdit.

Vérifié par les deux chiffres côte à côte : le MÊME mod coûte 6 dans l'exilus
naramon de la Soma Prime et 14 dans un de ses créneaux madurai (discordant,
11 + 25 %). Un seul des deux ne prouverait rien.

### v69 — les 3838 pages objet affichaient un prix TIRÉ AU HASARD (04/09/2026)

Suite directe de v67, sur la surface la plus visible du site. `js/objet.js`
prenait le **dernier seau du tableau** de statistiques, sans regarder le rang :

    const last = sells[sells.length - 1];        // ← aucun filtre de rang

Ce n'était même pas « le rang max » ou « le plus échangé » : c'était **celui
que l'API renvoie en dernier**. Relevé le 04/09/2026 :

| objet | affiché par la page | rang max réel | rapport |
|---|---|---|---|
| Arcane Energize | **9 p** (rang 0) | 150 p (rang 5) | **×17** |
| Arcane Grace | **7 p** (rang 0) | 115 p (rang 5) | ×16 |
| Primed Flow | **45 p** (rang 0) | 115 p (rang 10) | ×2,6 |

Ce sont **les pages qui sortent sur « prix Arcane Energize » dans un moteur de
recherche**. Un joueur y lisait neuf platine pour un arcane qui en vaut cent
cinquante. Et comme aucune règle ne fixait le rang retenu, le chiffre pouvait
changer du simple au décuple sans qu'une ligne de code ait bougé — le pire
genre de nombre : faux ET instable.

Même parti pris qu'en v67 : chiffre principal au rang MAX, **détail par rang
affiché** à côté. On ne choisit pas en silence.

**Trois choses réglées d'un coup, et la troisième n'était pas cherchée :**

1. Le **repli v2** (quand `v1/statistics` se tait) lisait le carnet d'offres
   sans filtrer le rang non plus — il aurait réintroduit exactement ce qu'on
   venait de retirer.
2. L'**étincelle** (le petit graphe de tendance) traçait une courbe qui sautait
   du rang 0 au rang 5 : des variations inventées, jamais arrivées. Elle reste
   maintenant dans le rang retenu.
3. Le détail par rang donne une **médiane par rang**, pas un prix plancher :
   comparable au chiffre principal, qui est une médiane. Une vérification a
   attrapé ma première version, qui mélangeait les deux.

**L'affichage n'a coûté aucune régénération et aucun risque de décalage** : le
détail est écrit dans `#px-updated`, un élément qui existe déjà dans les 3838
pages et qui était déjà rempli après coup. Ajouter un élément aurait demandé de
régénérer tout l'arbre — et créé une surface neuve pour le garde-fou CLS.

Vérifié : 12 vérifications hors navigateur (`scripts/verifier_prix_objet.mjs`,
branché en CI). La fonction est extraite de son IIFE par son texte plutôt que
d'exécuter `js/objet.js`, qui touche au DOM au chargement.

**Le site a maintenant TROIS calculs de prix, et c'est assumé** : les ordres en
cours (pipeline), les statistiques d'échanges (estimateur), les statistiques
live (pages objet). Trois questions différentes, trois règles — mais chacune a
désormais son garde-fou, et **aucune ne mélange les rangs**.

### v70 — un comparatif qui conseillait d'acheter une arme qu'on n'aura pas (04/09/2026)

Parti d'une hypothèse FAUSSE, et c'est la mesure qui a redressé le tir. Je
soupçonnais le comparatif pièces/set des pages objet d'ignorer les quantités
(le piège d'Akbolto Prime : deux canons, deux récepteurs). Vérifié : il lit bien
`quantityInSet`, et l'API le sert correctement. **Pas de défaut de ce côté.**

Mais en regardant les réponses réelles, une autre chose est apparue :

    /v2/item/aklex_prime_set/set  →  plan + lien.  C'est tout.

warframe.market **modélise** « Aklex Prime Set » comme plan + lien : les deux
Lex Prime entières n'en font pas partie pour lui, parce qu'elles se vendent
comme leur propre objet. Ses ducats le confirment (145 = 45 + 100). Le
comparatif était donc COHÉRENT avec ce modèle — et malgré tout un mauvais
conseil.

Mesuré sur `/o/akbronco-prime-set` :

    plan 2 p + lien 4 p = 6 p   contre   set 10 p
    → « acheter les pièces revient moins cher, économie ~4 p »

Le joueur qui suit ce conseil dépense six platine et **n'a pas l'arme** : il lui
faut encore deux Bronco Prime, qui coûtent bien davantage. Sur une page qui
sort dans les moteurs de recherche.

**On n'invente pas les prix manquants — on retire le verdict et on nomme ce qui
manque.** `data/sets_imbriques.json` (quelques centaines d'octets, deux entrées)
vient de la recette de JEU, la seule source qui connaisse ces composants ; il
est produit par le même script que `set_pieces.json` et se régénérera tout seul
le jour où DE sortira une nouvelle arme double. Les pages objet ne le chargent
que lorsqu'un comparatif est présent.

**Ce que la mesure a écarté en chemin**, et qui vaut d'être écrit pour ne pas
être recherché deux fois :

* comparer la somme des **ducats** des pièces à ceux du set ne détecte RIEN
  (145 = 145) — l'écart n'existe pas dans le modèle de warframe.market ;
* comparer `setParts.length` au nombre d'objets renvoyés non plus : les deux
  valent 3. L'API n'est pas tronquée, elle est simplement d'un autre avis que
  le jeu. **Aucun détecteur ne vit dans l'API** : il fallait la recette.

Vérifié : 17 vérifications dans `scripts/verifier_prix_objet.mjs` (5 ajoutées),
dont une qui interdit de dupliquer les 91 sets dans le petit fichier — sinon
3838 pages chargeraient une recette complète pour n'en servir que deux.

### v71 — l'historique réaligné, et une demande d'achat plafonnée par le marché (04/09/2026)

Deux dettes laissées par la correction des rangs (v67–v69), toutes deux
invisibles à l'écran et toutes deux fausses au chiffre.

**1. `market_history.json` était resté sur l'ancien rang.** Le prix courant
avait basculé sur le rang retenu, la série des 90 jours non : pour 29 objets à
rangs, `change24h` comparait deux échelles différentes. Sur Arcane Energize,
137 p face à une série écrite à 8 p — `/bons-plans` aurait titré une affaire
fabriquée de toutes pièces. `scripts/reparer_historique_rangs.py` réécrit les
90 points de chaque série sur le rang retenu (29 séries réalignées), et
`scripts/verifier_historique_coherent.py`, câblé dans les invariants, refuse
désormais tout écart supérieur à ×3 entre la série et le prix courant — c'est
le garde-fou qui manquait quand la correction de v67 a été poussée.

**2. « prendre le deuxième ordre » ne suffit pas.** L'heuristique de v67
écartait l'extrême et gardait le suivant. Mesuré le 04/09/2026 sur
Arcane Steadfast, les demandes d'achat étaient :

    900 · 840 · 600 · 150 · 150      médiane 180

**Trois** valeurs absurdes d'affilée avant le vrai marché : le deuxième ordre
valait 840, et le profil débutant annonçait qu'un acheteur donnait déjà
**467 %** de la médiane. Un rang d'ordres ne se nettoie pas en comptant les
ordres — il se plafonne par le marché : personne ne paie durablement plus que
la médiane. `demandeSure()` retient donc `min(2ᵉ demande, médiane)`, appliquée
au flipper et au débutant, et la ligne porte un badge « demande gonflée
ignorée » au lieu de disparaître en silence.

Le plafond ne dépend pas du NOMBRE d'ordres douteux : c'est ce qui le rend
robuste là où le comptage cassait. Vérifié par `scripts/verifier_profils.mjs`
(37 vérifications, deux ajoutées sur le vrai relevé 900/840/600/150/150) et
par les 51 contrôles de `tests/e2e/test_marche_profils.py`.

**Une assertion e2e trop forte est tombée au passage**, et elle méritait de
tomber : elle exigeait qu'aucune ligne de tête ne porte de badge. Un badge est
un avertissement, pas une disqualification — une ligne signalée peut
légitimement être première. Le vrai garde-fou est que la colonne QUI TRIE soit
reconstructible depuis les deux prix prudents affichés (`médiane − 2ᵉ vente`) :
si elle l'est, aucun extrême n'entre dans le classement. C'est ce qui est
vérifié maintenant, sur les 12 premières lignes.

### v72 — le générateur et ses 4130 pages avaient forké, dans les deux sens (04/09/2026)

Parti d'une question simple : la page de profils demandée est-elle **trouvable** ?
Elle est dans le sitemap, dans `/outils`, dans l'index ⌘K **anglais** — et absente
de l'index ⌘K **français**, la langue principale du site.

Le générateur, lui, la déclarait depuis des heures. Le fichier sur le disque ne
l'avait jamais reçue. En cherchant pourquoi :

    node scripts/generer_pages_objets.mjs
    💥 DÉRIVE DÉTECTÉE : 4120 fichier(s) modifiés en dehors de ce script

**Le générateur était gelé.** Son garde-fou de dérive interne fait exactement ce
qu'il doit — il refuse d'écraser des retouches manuelles — mais il ne parle qu'au
moment d'une génération, et une génération devenue impossible ne parle plus du
tout. Résultat : tout ce qu'on ajoutait au gabarit ne partait jamais, et tout ce
qu'on retouchait sur les pages ne remontait jamais. **Personne ne pouvait le voir.**

**LA PREMIÈRE TENTATIVE ÉTAIT UNE RÉGRESSION, ET LA MESURE L'A DIT.** Régénérer
avec `--force` produisait 271 fichiers modifiés — mais dans le mauvais sens :

* le lien « Platinum Path » **disparaissait** de la nav de 251 pages `en/o/` ;
* `/en/platinum-path/` **sortait** de l'index ⌘K anglais ;
* les deux guides écrits à la main `bien-modder` / `modding-guide` **quittaient**
  l'annuaire et le sitemap ;
* les bannières `fam-*.webp` et leurs `og:image` **s'effaçaient** de 15 guides.

Le gabarit était **en retard**, pas en avance. Tout a été remis dans l'autre sens :
les bannières relues **depuis le disque** (la vérité), les deux guides déclarés
dans `GUIDES_FAITS_MAIN`, `og:image` et les liens PWA ajoutés au gabarit, la nav EN
complétée. La règle d'insertion des guides faits main, recopiée en trois endroits,
est devenue une fonction unique (`avecFaitsMain`) qui sait aussi placer **en tête**.

Après quoi la régénération ne perd **rien** et n'ajoute que ce qui manquait :

    sitemap        1584 URLs → 1584, aucune perdue, aucune ajoutée
    index ⌘K FR      51 → 53   (+ /marche-profils, + /guides/bien-modder)
    index ⌘K EN      40 → 41   (+ /en/guides/modding-guide)
    en/o/            1 page    (lien interne vers le guide de modding, mérité)

**Le vrai livrable est le mode `--verifier`.** Il recalcule les 4130 artefacts et
les compare au disque **en 2 secondes, sans rien écrire**, et il est branché dans
`verifier_invariants.sh`. Il est vérifié en le mettant en échec : on retire
`/marche-profils` de l'index, il sort 1 en nommant le fichier. C'est la seule chose
qui empêche le fork de recommencer — le garde-fou de dérive protège les retouches,
celui-ci protège le gabarit, et il fallait les deux.

**Trouvé en chemin** : l'index ⌘K annonçait « les 16 outils gratuits » quand
`/outils` en portait 17. Un chiffre recopié à la main se démode en silence — il est
maintenant **compté sur la page elle-même** et ne peut plus mentir.

Vérifié : `--verifier` sur 4130 fichiers, invariants complets, `test_recherche.py`
(deux vérifications ajoutées : « profils » trouve `/marche-profils`, « modder »
trouve `/guides/bien-modder` — une page qu'aucune recherche ne trouve n'existe pas),
`test_outils_pages.py`.

### v73 — 49 pages se partageaient en lien nu (04/09/2026)

Suite directe de v72 : le générateur redevenu utilisable, la première chose à lui
faire produire était ce qui manquait partout. Mesuré page par page :

    pages outils      og:image sur  3 / 22
    guides anglais    og:image sur  7 / 22
    trade, courses, favoris, digest, marche-complet : AUCUNE balise Open Graph

Un site de fans se diffuse par un lien collé dans un Discord ou un tweet. Sans
`og:image`, ce lien s'affiche **nu** — pas de vignette, pas de titre, une URL
grise que personne ne clique. C'est le canal de diffusion du site entier, et il
était éteint sur 49 pages sans que rien ne casse ni ne s'affiche en rouge.

**Ce qui a été fait, et l'ordre compte** : les pages générées par le gabarit
(guides FR et EN, annuaires) reçoivent leur carte **dans le gabarit**, pas dans le
fichier — sinon v72 recommence. Les pages statiques (outils, mentions légales)
sont patchées une fois. Les guides anglais n'affichent pas de bannière mais ont
un **jumeau français qui en a une** : on emprunte la sienne plutôt que d'en
inventer une, et sans jumeau on ne met **pas** d'image plutôt qu'une image fausse.

`scripts/verifier_cartes_partage.mjs` (branché dans les invariants) exige sur
chaque page publique : `og:title`, `og:description`, `og:image`, `twitter:card`,
et surtout que **l'image référencée existe sur le disque** — une carte qui pointe
vers un fichier absent affiche un cadre vide, ce qui est pire qu'un lien propre.
Vérifié en le mettant en échec : on pointe `/ducats` vers une image inexistante,
il sort 1 en nommant le fichier.

**Le garde-fou a trouvé trois pages que je n'avais pas listées** dès son premier
passage : `a-propos`, `confidentialite`, `mentions-legales`. C'est la raison d'être
d'un garde-fou plutôt que d'une passe manuelle — ma liste était incomplète, et je
ne l'aurais pas su.

Couverture finale : **46 pages publiques, 5 vérifications, zéro lien mort.**

**Correctif v73.1 — mon propre garde-fou a fait rougir la CI, et il avait tort.**
`--verifier` comparait `sitemap.xml` à l'octet. Or son `<lastmod>` ne vient pas du
gabarit : il vient de `git log`. Le job des invariants cloue un clone **superficiel**
(seul `pages-objets.yml` demande `fetch-depth: 0`) et compare un **commit de fusion** —
deux raisons pour que la date sorte différente sans qu'une ligne de gabarit ait bougé.
Mesuré : 1554 URLs portent `2026-08-22` sur le disque, un repli les met toutes au jour
même. Passer le job en `fetch-depth: 0` n'aurait rien réglé — la fusion daterait les
fichiers du jour de la fusion.

Le sitemap est donc comparé sur ce que le gabarit produit **vraiment** — quelles URLs,
dans quel ordre, avec quelles fréquences et priorités — `<lastmod>` exclu. Vérifié dans
les deux sens, en simulant le clone superficiel (`git` rendu muet) : une URL retirée
fait crier le garde-fou, une date changée le laisse silencieux.

### v74 — quatre liens morts sur 198 056 (04/09/2026)

Même méthode que v73 : une fois le générateur utilisable, on mesure. Cette fois
tous les `href` du site, comparés au disque — 198 056 liens sur 5688 pages.

    /rss.xml                  le pied de page de l'accueil annonçait un flux RSS…
                              à une adresse qui n'existe pas. LE VRAI FLUX EXISTE :
                              /data/feed.xml, écrit par update_warframe_news.py,
                              référencé correctement par la balise <link> de la même
                              page. Seul le lien CLIQUABLE était faux.
    /en/o/styanax_prime_set   trois objets cités par le guide « Jade Shadows » anglais
    /en/o/athodai_prime_set   et absents du lot EN restreint (250 objets les plus
    /en/o/afentis_prime_set   échangés) : trois 404 dans un guide publié.

**Le lot EN se répare tout seul, il ne se corrige pas à la main.** Ajouter les trois
slugs dans `data/en_objects_selection.json` n'aurait pas tenu :
`rank_items_by_wm_volume.mjs` **réécrit** ce fichier, l'ajout aurait disparu au
prochain calcul — le fork exact que v72 venait de réparer. La règle vit donc dans le
générateur : **lot EN = sélection mesurée ∪ objets cités par une page anglaise**. Un
objet dont on parle en anglais est un objet dont un lecteur anglais veut le prix, et
la règle se maintient d'elle-même le jour où un guide en cite un nouveau. 250 → 253.

`scripts/verifier_liens_internes.mjs` (branché dans les invariants) vérifie les
198 056 liens **en 0,5 s**, hreflang et canoniques compris. Les `href` construits en
JavaScript (`/o/${slug}`, `/builds/'+esc(x)+'`) sont écartés sur les caractères
qu'une adresse statique de ce site ne contient jamais — pas sur une liste
d'exceptions qui rouillerait. Vérifié en le mettant en échec : on remet `/rss.xml`
dans le pied de page, il sort 1 en nommant l'URL **et la page qui la porte**.

Au passage : `hub.html` pointait vers le flux en **relatif** (`data/feed.xml`). Ça
marche depuis `/hub` et casserait depuis `/hub/`. Rendu absolu, comme partout ailleurs.

**Complété (v74.1) — deux familles mesurées SAINES, gardées quand même.** `src` (77 165
images, scripts et feuilles de style) et `hreflang` (2078 paires) : **zéro défaut**.
Elles sont gardées parce que ce sont les deux endroits où le générateur décide **au cas
par cas** — `hasEn` n'écrit un hreflang que si l'objet fait partie du lot EN — et qu'une
régression de cette condition fabriquerait des milliers de liens morts d'un coup. 0,8 s
de plus.

**Et la première version du contrôle de réciprocité NE POUVAIT PAS ÉCHOUER.** En cassant
la paire pour de vrai — `hreflang="fr"` retiré d'une page EN — le garde-fou restait vert :
il comptait aussi le `x-default`, qui pointe vers la même URL française. `x-default`
désigne la version par défaut, pas un appariement de langue ; le compter masquait
exactement le défaut cherché. Corrigé, puis re-cassé pour vérifier qu'il crie. **Un
garde-fou qu'on n'a pas vu échouer n'est pas un garde-fou.**

**Complété (v74.2) — le service worker.** `cache.addAll()` est **atomique** : une seule
URL absente et l'installation entière échoue, donc **plus de PWA** — ni hors-ligne, ni
arsenal embarqué, ni mise à jour de la coque. Rien ne le signale, le site continue de
s'afficher normalement en ligne. Il suffit de renommer un fichier de `js/` pour le
provoquer, et `js/profil.js` vient précisément d'être ajouté à `SHELL`. Les 30 entrées
`SHELL` + `ARSENAL` sont vérifiées (elles existent toutes) ; prouvé en renommant une.

**Trois familles mesurées propres et laissées telles quelles**, écrites ici pour ne pas
les rechercher deux fois :

* **canonicals** — 4 pages sans canonical (404, offline, widget d'exemple, vérification
  Google) et `warframe.html` qui pointe vers `/outils` parce que c'est un redirecteur :
  correct dans les cinq cas ;
* **titres et descriptions** — 5688 pages, **zéro doublon** ;
* **mods sans effet chiffré** — 264 sur 655, dont le détail confirme la note de v50 :
  accroche murale 15, vol plané 13, parkour 9, recul 7, plus des conditionnels « premier
  tir du chargeur ». Rien qu'on sache chiffrer sans inventer une base que personne ne
  publie.

Mesurer et ne rien changer est un résultat : ça évite de « corriger » ce qui va bien.

### v75 — « tes outils » : le profil sert enfin à quelque chose sur /outils (04/09/2026)

Retour à la demande d'origine — *« que chaque personne se retrouve »*. Mesuré : le
profil ne changeait le comportement d'**aucune** page sauf `/trade` (onglet WTB pour
un acheteur). Partout ailleurs, un bandeau qui **rappelle** le profil sans rien en
faire. Or l'endroit où l'on se perd le plus est l'annuaire : **17 cartes d'outils**,
la même liste pour tout le monde.

`/outils` et `/en/tools` allument désormais les outils du profil choisi, et les
listent en une ligne : le ducatier voit 4 cartes sur 17, le farmeur 7 — et jamais
les 17, sinon le profil ne trie rien.

**La correspondance outil → profils est écrite SUR LA CARTE** (`data-pf="ducatier"`),
pas dans une liste tenue à part dans le JS. Une carte ajoutée demain porte ses profils
avec elle ; il n'y a rien qui puisse se désynchroniser de la page. C'est le même parti
pris que le nombre d'outils, compté sur la page depuis v72 — et la session entière a
montré ce que coûte une liste tenue en double.

**Rien ne bouge à l'écran.** La boîte « tes outils » est posée **vide** pendant
l'analyse de la page (elle réserve sa ligne) et remplie juste après la grille, une
fois les cartes lues ; les cartes retenues prennent un `outline`, qui ne prend aucune
place — un badge à l'intérieur aurait changé leur hauteur, donc la mise en page de
toute la grille. Vérifié : les **quatre** garde-fous de rendu passent (contraste 0/216,
CLS 42 pages, cibles tactiles 110 pages, débordement 112 pages × 2 tailles).

**Trouvé en chemin, encore un nombre recopié** : la page annonçait « **Quinze** outils
Warframe gratuits » alors qu'elle en porte 17. Écrit en chiffres, il est maintenant
vérifiable — et vérifié.

Gardé par 9 contrôles de plus dans `verifier_profils.mjs` (46 au total) : chaque carte
porte `data-pf`, aucun profil inventé, **chaque profil a au moins un outil** (sinon on
renvoie un visiteur sur une page qui l'ignore), aucun profil ne reçoit toutes les
cartes, et le nombre annoncé est celui des cartes présentes. Mis en échec dans les deux
cas avant d'être gardé. Plus 12 vérifications e2e dans `test_marche_profils.py` (63).

### v76 — publication automatique : la file de relecture remplacée, pas supprimée (05/09/2026)

Demande du Chef : *« je veux que la validation se fasse automatiquement sans moi »*.
La file manuelle demandait sa présence, donc en pratique elle aurait tout gelé — un
build publié serait resté invisible indéfiniment. Elle est retirée.

**Mais le commentaire qu'elle portait disait vrai** : sans comptes, personne n'est
responsable de ce qu'il publie, et le site porte un nom et de la publicité. On ne
retire donc pas la file pour la remplacer par rien. Cinq barrières, dont aucune ne
demande une présence humaine :

1. **Le lien ne peut pas sortir du site.** `lienValide()` le faisait déjà : seul un
   lien d'Arsenal VoidRelay portant un build passe. **Le vecteur le plus dangereux
   était donc déjà fermé** — c'est ce qui rend l'automatique envisageable.
2. **Le texte ne peut pas faire de publicité.** `sansPub()` retire toute adresse de
   site du titre, de l'auteur et des notes. Publier ici n'envoie plus personne
   ailleurs : le spam perd son seul intérêt. On **retire** au lieu de refuser — un
   joueur qui écrit « vu sur warframe.market » n'est pas un spammeur.
3. **Chevrons et caractères de contrôle retirés**, affichage échappé (déjà en place).
4. **Une courte liste de mots** refuse les insultes les plus grossières. Elle est
   délibérément courte et se contourne : c'est un filet, pas un mur, et c'est écrit
   comme tel dans le code.
5. **Deux signalements d'empreintes différentes masquent un build**, automatiquement.
   C'est le vrai remplacement de la relecture : le site se nettoie seul.

Le masquage repasse le build en `attente` — il **n'est jamais supprimé**. Un clic de
foule ne doit pas détruire le travail de quelqu'un, et le Chef peut republier ce qui
a été masqué à tort depuis les routes d'administration, qui restent en place.

`sansPub()` s'applique **avant** la coupe de longueur : sinon une adresse tronquée
survivrait en fragment. Vérifié par 11 cas dans `verifier_api_builds.mjs`, dont trois
qui interdisent le contraire — un texte de build normal (« Build crit 60/60 Steel
Path, 2 forma ») doit ressortir **intact**, et « multiplicateur 3.5 » ne doit pas être
pris pour un domaine. Mis en échec en retirant `sansPub` du chemin : le garde-fou crie.

~~**Une table à ajouter dans D1** (`signalements`), sinon le bouton renverra une erreur
500~~ — **plus rien à faire depuis v77** : le schéma se pose tout seul.

### v77 — le schéma D1 se pose tout seul (05/09/2026)

v76 laissait un geste manuel : créer la table `signalements` dans la console SQL
de Cloudflare. Tant qu'elle n'existait pas, le bouton de signalement répondait
**500 avec un message de moteur SQL** — et le signalement est la *cinquième*
barrière de la publication automatique, celle qui remplace la relecture humaine.
Autrement dit : le site ne se nettoyait plus, en silence, en attendant un clic
que seul le Chef pouvait faire. **Une barrière qui dépend d'un geste manuel n'est
pas une barrière** : c'est exactement ce que v76 reprochait à la file de
relecture, reproduit un cran plus bas.

`functions/api/builds.js` porte désormais `SCHEMA` (les 9 ordres du fichier
`.sql`) et `avecSchema()` : quand D1 répond *no such table*, le schéma est posé
et **la requête est rejouée une fois**. `sync.js` passe par le même chemin, donc
ses deux tables aussi. Le geste manuel disparaît pour de bon, y compris pour la
prochaine table.

**Le chemin normal ne coûte rien.** On ne pose pas le schéma à chaque appel — ce
serait 9 ordres SQL inutiles par requête. On ne le pose que sur l'erreur, qui
n'arrive qu'une fois par table ajoutée. Et une seule reprise : une erreur
étrangère au schéma (contrainte d'unicité, base injoignable) remonte telle
quelle, sinon on masquerait un vrai défaut derrière une deuxième tentative.

Le corps de la requête est lu **avant** `avecSchema` : un flux de requête ne se
relit pas, et rejouer le traitement l'aurait vidé.

**Deux sources de vérité, une seule autorisée à diverger.** `builds.schema.sql`
reste la version lisible (commentaires, requêtes d'entretien) ; le garde-fou
compare les deux à la ponctuation près et refuse la moindre différence de
colonne.

Gardés par 6 cas de plus dans `verifier_api_builds.mjs`, dont un qui rejoue le
défaut de production sur une fausse base D1 : signalement sur une base **sans**
la table `signalements` → 200, table créée. Plus un qui vérifie que **toute
table interrogée par le code est posée par le schéma** (l'oubli du 05/09, cette
fois attrapé), et un qui exige qu'une base **vide** se remplisse seule.

Mis en échec dans les trois sens avant d'être gardé : sans `signalements` dans
`SCHEMA` → 3 cas rouges dont le 500 d'origine à l'identique ; `avecSchema`
retiré du chemin → 3 cas rouges ; une colonne changée dans le `.sql` → le
contrôle de divergence crie.

### v78 — le fil d'Ariane : affiché partout, déclaré nulle part (05/09/2026)

Même méthode que v73 et v74 : on mesure une famille entière avant de toucher
quoi que ce soit. Cette fois les fils d'Ariane — **5 690 pages en portent un à
l'écran**, et voici ce qu'elles en disaient à Google :

    1 481 pages GÉNÉRÉES     affichent un fil, n'en déclarent aucun (builds FR+EN, 3 annuaires)
       68 pages À LA MAIN    idem — dont /outils, /trade, /marche, /arsenal, /hub, /faq
      275 pages              en déclarent un FAUX

Les 275 sont le pire des trois : toutes les pages **anglaises** annonçaient la
page d'accueil **française** comme première étape (`item: SITE + "/"` au lieu de
`/en/`), alors que le fil affiché pointe bien vers `/en/`. Une déclaration qui
ment est pire qu'une déclaration absente.

**La déclaration est maintenant DÉRIVÉE du fil affiché.** `scripts/lib_fil_ariane.mjs`
lit le `<nav class="bc">` de la page et en fabrique le `BreadcrumbList` : il n'y a
plus de liste rédigée à côté des gabarits, donc plus rien qui puisse se
désynchroniser. `generer_builds.mjs` l'applique à l'écriture de chacune de ses
1 478 pages — un seul point de passage, tous les gabarits couverts. Le sélecteur
de langue, qui vit *dans* le `<nav>` mais n'est pas une étape du chemin, est
reconnu par son `hreflang` plutôt que par une liste de libellés.

Le bug anglais, lui, se corrige à la source : deux lignes dans
`generer_pages_objets.mjs`, plus le `BreadcrumbList` qui manquait aux trois
annuaires (`/o/`, `/en/o/`, `/en/guides/`).

**`--ecrire` REFUSE DE TOUCHER UNE PAGE GÉNÉRÉE.** Une déclaration posée à la
main dans `/o/` ou `/builds/` disparaîtrait à la génération suivante — le fork
exact que v72 puis v74 ont eu à réparer. Le garde-fou nomme le dossier et
renvoie au générateur au lieu de laisser deviner. Vérifié en retirant la
déclaration d'une page de builds : `--ecrire` ne l'écrit pas et le dit.

Les 8 dernières divergences venaient des guides « faits main » (`GUIDES_FAITS_MAIN`),
que le générateur liste sans les écrire : `--ecrire` réaligne leur déclaration
sur ce qu'elles affichent, en ne remplaçant **que** le bloc `BreadcrumbList` du
tableau JSON-LD — l'`Article` et la `FAQPage` de la même balise sont laissés
intacts. Les 3 350 blocs JSON-LD des 1 824 pages modifiées se parsent tous.

`scripts/verifier_fil_ariane.mjs` (branché dans les invariants) vérifie les
5 690 fils en une passe. **Mis en échec dans les quatre sens avant d'être
gardé** : une page à la main qui perd sa déclaration, une déclaration qui ment
(étape renommée), un générateur qui cesse de déclarer (1 478 pages rouges d'un
coup), et `--ecrire` lâché sur une page générée.

**Le sitemap n'est PAS dans ce commit, et c'est délibéré.** Régénérer les pages
réécrit `sitemap.xml`, dont les `<lastmod>` viennent de `git log` — or ce clone
est **superficiel**, donc ces dates seraient fausses pour 1 500 URLs. C'est
exactement le piège documenté en v73.1. Le sitemap est laissé tel quel ; le
workflow hebdomadaire, qui cloue `fetch-depth: 0`, le réécrira juste.

### Le lien de langue dans le fil : mesuré, tranché, ON NE TOUCHE PAS

Vu en passant : 24 pages mettent un lien 🇫🇷/🇬🇧 **dans** leur `<nav class="bc">`,
et 2 054 pages qui ont pourtant une jumelle déclarée n'en mettent pas. J'ai
recommandé de retirer les 24 « puisque la barre de navigation et le pied de page
portent déjà le basculement ». **C'était faux, et ça aurait coûté cher.**

Cette phrase n'est vraie que des pages GÉNÉRÉES : leur topnav porte un lien
FR/EN, leurs pages objet et builds un « Version française » en pied de page. Sur
les pages écrites à la main, la mesure dit l'inverse :

      6 pages   ont un autre chemin vers leur jumelle → le retirer ne changerait rien
     18 pages   n'en ont AUCUN → le fil d'Ariane est leur SEUL basculeur de langue

Dont `outils`, `trade`, `ducats`, `endo`, `courses`, `favoris`, `arsenal`,
`calc-reliques`, `reliques-ce-soir`, `marche-profils` et 6 guides. Vérifié ligne
à ligne sur trois d'entre elles : aucun lien vers `/en/…` ailleurs dans la page,
et elles ne chargent même pas `js/i18n.js` — il n'y a pas non plus de basculeur
posé côté client.

Le vrai constat n'est donc pas « 24 pages font quelque chose en trop » mais
**toutes les pages ont un basculeur, sa place change**. Décision du Chef
(05/09/2026) : **on garde tout**. L'incohérence est cosmétique, personne n'est
bloqué, et le nettoyer demanderait d'abord de reposer un basculeur ailleurs sur
18 pages — du travail et un risque de rendu pour zéro gain visiteur.

**La leçon, elle, vaut d'être écrite** : « c'est déjà ailleurs » est une
affirmation qui se mesure page par page, pas une intuition. Je l'ai énoncée sur
la foi des gabarits générés, et 18 pages sur 24 disaient le contraire.

### v79 — l'autocomplétion anglaise ne proposait plus rien (05/09/2026)

**Un garde-fou de plus, et il a payé à son premier passage.** Les quatre
garde-fous de rendu chargent déjà chaque page dans un vrai navigateur, mais
chacun ne regarde QUE sa mesure : une exception JavaScript non rattrapée les
laisse **tous verts**. La page s'affiche, sa mise en page est bonne, son
contraste aussi — et ses fonctions ne marchent plus.

`scripts/verifier_exceptions_js.{mjs,sh}` écoute deux familles, aucune n'étant
affaire de goût : une exception non rattrapée (`pageerror`), et une 404 sur un
fichier **du site**. Ce qui vient de l'extérieur (polices, régie, warframestat,
warframe.market) est ignoré — leur indisponibilité est un fait du réseau, pas un
défaut du site, et la compter rendrait le résultat ininterprétable.

**Ce qu'il a trouvé sur 112 pages :** `js/views.js` demandait ses données en
chemin **relatif**. Depuis `/reliques-ce-soir` (racine), `data/items.json`
résout vers `/data/items.json` et marche. Depuis `/en/relics-tonight`, vers
`/en/data/items.json` — **404**. Le fetch vit dans un `try/catch` qui rend une
liste vide : **l'autocomplétion anglaise ne proposait plus rien**, sans message,
sans erreur, sans qu'aucun test ne rougisse. Même piège que le flux RSS de
`hub.html` en v74.

**LE SCAN DE PAGES N'AURAIT JAMAIS COUVERT CETTE FAMILLE, et c'est le vrai
enseignement.** Il n'en a attrapé qu'**un sur trois** : `market.json` et
`market_history.json` sont demandés par le même fichier, cassés à l'identique,
mais sur des vues qu'un scan ne visite pas. Une limite structurelle, pas un
réglage.

La règle vit donc dans `verifier_liens_internes.mjs`, dont c'est le métier — une
adresse que le site nomme doit exister : *« les données chargées par le JS ont
une adresse absolue, et le fichier existe »*, **16 chemins** couverts. Elle sait
que `/api/builds` n'est pas un fichier mais une fonction Cloudflare, vérifiée
dans `functions/`, plutôt qu'inscrite sur une liste d'exceptions qui rouillerait.
Mise en échec dans les trois sens : chemin relatif remis, fichier de données
inexistant, fonction Cloudflare renommée.

**`js/**.js` entre dans les déclencheurs de `garde-rendu.yml`.** Il n'y était
pas — seuls le CSS, le HTML et les scripts de garde-fou l'étaient. Une
modification de `js/` pouvait donc casser toutes les pages sans que ce workflow
ne s'exécute, et le défaut du jour est passé exactement par ce trou.

Second passage après correctif : **112 pages, zéro exception, zéro fichier
manquant.** Le garde-fou affiche désormais sa progression (une ligne toutes les
20 pages) — son scan dure plusieurs minutes et n'affichait rien jusqu'au
verdict, impossible de distinguer « ça travaille » de « c'est bloqué ».

### v80 — le site promettait une fraîcheur deux fois trop belle (05/09/2026)

Mesuré en vérifiant simplement ce que le site sert en production :

    promesse affichée au visiteur    « données actualisées TOUTES LES 2 H »  (12 endroits)
    cron réellement déclaré          17 */4 * * *  →  toutes les 4 h
    livré par GitHub, 4 derniers     3,4 h · 6,2 h · 6,3 h · 8,2 h

Le chiffre affiché était **deux fois** meilleur que ce que le dépôt demande, et
jusqu'à **quatre fois** meilleur que ce qui arrive — GitHub retarde librement les
tâches planifiées des dépôts publics, et le workflow lui-même s'appelle
« data update (4h) ». La promesse vivait sur les deux accueils, sur `/marche`,
dans les pieds de page, dans le parcours platine anglais et dans deux guides.

Les 12 occurrences passent à 4 h — la cadence que le dépôt demande réellement,
la seule qu'il contrôle. On ne promet pas ce que GitHub décide.

**Et surtout, le chiffre est maintenant DÉRIVÉ de sa source.** Le garde-fou lit
le cron de `warframe-hub-update.yml` et refuse toute page qui annonce autre
chose. Même motif que le « Quinze outils » de v75 : un nombre affiché se dérive,
il ne se recopie pas. Mis en échec dans les **deux** sens — remettre « 2 h » sur
l'accueil le fait crier, et changer le cron sans toucher aux pages aussi. C'est
la seconde qui compte : elle attrape le jour où quelqu'un ralentit le pipeline
et oublie les pages.

**Deux familles mesurées SAINES au passage**, écrites ici pour ne pas les
rechercher deux fois :

* **le flux RSS n'est pas périmé** malgré son `lastBuildDate` au 27/08 : il
  reprend la date de la news la plus récente, pas l'heure de génération. Le run
  hebdomadaire du 31/08 n'a rien trouvé de plus récent chez Warframe. Une date
  de build ferait un diff à chaque passage, donc des commits vides à perpétuité ;
* **les `catch` silencieux** — 99 sur 102, mais le chiffre brut ne veut rien
  dire (`try{localStorage…}catch{}` est un idiome où le silence est correct).
  Seuls **7** enveloppent le chargement d'une donnée du site, dont 4 dans
  `search.js` : si un index disparaissait, la recherche ne remonterait plus rien
  sans le moindre message. Les 7 utilisent désormais des chemins absolus vers
  des fichiers dont la règle de v79 vérifie l'existence — la cause ne peut plus
  survenir sans faire rougir le CI. Ajouter des `console.error` partout serait du
  bruit qui ne protège personne.

### v80.1 — mon garde-fou accusait le site de ce que fait la régie (05/09/2026)

Première exécution en CI de la vérification des exceptions JS : **109 pages
fautives sur 112**, toutes avec le même message — « Uncaught (in promise)
undefined ». En local le scan était vert, parce qu'il tournait avec
`VR_BLOQUER_EXTERNE=1` : les ressources tierces ne se chargeaient pas.

**Les 3 rescapées étaient EXACTEMENT les 3 pages de l'échantillon qui ne portent
pas le script publicitaire** (`404`, `embed`, `offline`). Corrélation parfaite :
le rejet vient de la régie, pas du site. Vérifié en comptant, pas en supposant.

Un rejet de promesse dont la valeur n'est pas une `Error` n'a **aucune pile
d'appel** : il est impossible d'en désigner l'auteur. La règle devient donc :
*une exception ne compte que si sa pile mentionne un script servi par le site.*

Ce qu'on perd est assumé et écrit dans le fichier : une erreur du site lancée
comme `throw undefined` passerait entre les mailles. Ce dépôt ne le fait nulle
part, et l'alternative — accuser le site de ce que fait la régie — rend le
garde-fou inutilisable, donc ignoré, donc inutile. Les rejets non attribuables
ne sont pas cachés pour autant : ils sont comptés et affichés en fin de scan.

Prouvé sur quatre pages fabriquées : page saine → rien ; rejet sans pile →
ignoré ; erreur du site en script inline → attrapée ; erreur du site dans un
fichier `/js/` → attrapée.

**La leçon vaut au-delà de ce garde-fou** : un scan local qui coupe les
ressources tierces ne prouve pas qu'un garde-fou est juste — il prouve qu'il
passe *dans des conditions qui ne sont pas celles du visiteur*. C'est
exactement ce que `lib_blocage_externe.mjs` dit en toutes lettres depuis le
03/09 : « le CI reste le juge ». Je l'ai lu, puis j'ai quand même conclu trop
vite sur un scan bloqué.

### v79.3 — rectification : pourquoi v79.2 est juste, mais pas pour la raison écrite

Le message de commit de v79.2 affirme : *« le push qui branchait la vérification
des exceptions JS n'a PAS déclenché le workflow »*. **C'est faux, et il faut le
lire ici plutôt que de le croire là-bas.**

En listant les exécutions réelles de `garde-rendu.yml`, on voit que le workflow
**s'est déclenché à chaque push** (runs 191, 192, 193). Ce que j'ai pris pour
« il ne se déclenche pas » était `cancel-in-progress: true` : chacun de mes
pushes rapprochés annulait le run précédent, qui disparaissait de la liste des
vérifications sans jamais conclure.

**La mécanique que j'avais mal comprise**, écrite pour qu'on ne s'y reprenne
pas : sur un événement `pull_request`, GitHub évalue les filtres de chemins sur
**l'ensemble du diff de la PR** — qui contenait 1 824 fichiers HTML — donc le
workflow partait quoi qu'on touche. Mon raisonnement ne valait que pour un
`push` sur `main`, où les filtres portent sur le seul commit poussé.

**Le correctif de v79.2 reste bon** — pour ce cas-là, précisément : modifier
`garde-rendu.yml` et le pousser sur `main` ne le relancerait pas, donc on ne
saurait jamais qu'on vient de le casser. Il est conservé pour cette raison, pas
pour celle qui est écrite dans son commit.

**La leçon vaut mieux que la ligne de YAML** : quatre runs annulés coup sur coup
ressemblent, dans l'interface des vérifications, à quatre runs qui n'existent
pas. Devant une absence, lister les exécutions du workflow avant de conclure —
une absence n'est pas une preuve.

**Vérification finale du garde-fou d'exceptions, en CI (run 196, vert) :**

    🛡️  Garde-fou exceptions JavaScript — 112 pages
       (109 rejet(s) sans pile d'appel, non imputables au site — régie et scripts tiers)
    🛡️  GARDE-FOU : les 112 pages se chargent sans une seule exception imputable au site — OK.

Les 109 sont **comptés et affichés**, pas silencieusement écartés : le jour où ce
nombre bouge, on le verra.

### v81 — un outil annoncé sur /outils ne disait pas qu'il en était un (05/09/2026)

Même famille que v78, un cran plus haut. `/outils` présente **17 outils** et
`/en/tools` **12**, mais seules **6 pages sur 28** disaient à un moteur de
recherche ce qu'elles sont (`WebApplication`). Les 22 autres — dont `/trade`,
`/marche`, `/arsenal`, `/favoris`, celles qui portent la valeur commerciale du
site — se présentaient comme des pages quelconques.

L'incohérence n'avait aucune raison d'être : trois pages françaises et trois
anglaises le faisaient déjà, **avec une convention nette**, vérifiable sur ses
propres exemples :

    français   « Convertisseur de ducats »  →  « Convertisseur de ducats Warframe »
    anglais    « Ducats converter »         →  « Warframe Ducats Converter »

Le nom du jeu SUIT le libellé en français, le PRÉCÈDE en anglais, où le libellé
passe en casse de titre. La règle reproduit les six déclarations existantes à
l'identique — ce n'est pas une invention, c'est une lecture.

**La déclaration est DÉRIVÉE DE LA CARTE**, qui porte déjà le nom (`<h2>`), la
description (`<p>`) et l'adresse (`href`) de l'outil. Rien n'est rédigé à côté,
donc rien ne peut se désynchroniser — la leçon de v72, v75 et v78. Un outil
ajouté demain porte sa déclaration avec lui. 21 pages posées, 46 blocs JSON-LD
vérifiés, zéro invalide.

**Ce que le garde-fou exige, et ce qu'il n'exige PAS.** Il exige qu'une page
annoncée comme outil se déclare, et que l'URL déclarée soit la sienne : deux
faits vérifiables. Il **n'impose pas le libellé** — le nom est du contenu, il
appartient à qui écrit la page, et six pages avaient déjà le leur. Un garde-fou
qui dicterait la formulation se ferait contourner ou désactiver.

Une carte menant à un DOSSIER (`/en/o/`) est écartée : elle désigne un annuaire,
pas un outil. Mis en échec dans les trois sens — une page qui perd sa
déclaration, une déclaration qui pointe vers une autre page, et une carte
ajoutée vers une page qui n'existe pas.

### Mesuré SAIN, et donc laissé tel quel : la performance

Cherché le même jour, rien à corriger — écrit ici pour ne pas le rechercher :

    /                10 Ko transférés     461 nœuds
    /hub             24 Ko                143 nœuds
    /o/              55 Ko              7 772 nœuds   ← le plus lourd
    /o/abating_link   3 Ko

L'annuaire des objets est le seul volumineux, et ses **3 863 liens sont le
chemin d'exploration de tout le catalogue** : le paginer coûterait plus qu'il ne
rapporterait. L'index de recherche (181 Ko) est chargé **au focus** du champ,
jamais au chargement — le code existant fait déjà ce qu'il faut.

### v82 — les redirections mènent quelque part, et ça se garde (05/09/2026)

Vérifié **en production**, ce qu'aucun garde-fou ne faisait : les **24 règles**
de `_redirects` fonctionnent toutes, et leurs **7 destinations** répondent 200.
Un échantillon de 15 URLs tirées au sort dans le sitemap répond 200 également.
**Rien à corriger.**

Mais rien ne les gardait, et le mode de panne est net : quelqu'un renomme une
page, la règle qui y menait continue de rediriger — vers une 404. Le visiteur
venu d'un ancien lien indexé par Google atterrit dans le vide, et personne ne le
voit jamais : une redirection ne casse aucune page et ne rougit aucun test.

La règle rejoint `verifier_liens_internes.mjs`, dont c'est le métier : *« chaque
redirection de `_redirects` mène à une page qui existe »*, 24 destinations. Seule
la DESTINATION est jugée — la source est par définition une URL qui n'existe
plus, c'est tout l'intérêt de la règle.

Mis en échec dans les deux sens. Le premier cas est instructif : renommer
`guides/farmer-platine-gratuit.html` fait crier **quatre** contrôles à la fois
(deux redirections + les liens internes) — les garde-fous se renforcent au lieu
de se doubler.

### Encore une famille mesurée SAINE : les redirections et le sitemap

Écrit ici pour ne pas le rechercher : les 24 règles marchent, leurs destinations
vivent, le sitemap ne ment pas. Avec la performance (v81) et le flux RSS (v80),
cela fait trois familles cherchées et trouvées correctes le même jour. **Mesurer
et ne rien changer reste un résultat** — ça évite de « corriger » ce qui va bien,
et ça dit à la session suivante où ne pas retourner.

### v83 — la page de modération, et un chiffre de tableau de bord qu'il ne fallait PAS suivre (05/09/2026)

> Renumérotée de v78 en v83 à la fusion : un second agent travaillait en parallèle
> et avait déjà pris v78. Cinq numéros entraient en collision (v78 à v82) — deux
> journaux valent mieux qu'un journal ambigu. Livrée par la PR portant « v78 ».

> Renumérotée de v77 en v83 : un second agent travaillait en parallèle et sa v77
> (le schéma D1 qui se pose tout seul) est la suite directe de v76 — même sujet,
> les barrières de la publication automatique. Celle-ci est une fonctionnalité à
> part, elle passe donc derrière.

**D'abord ce qui n'a PAS été fait, et pourquoi.** Le taux de cache Cloudflare était à
10,41 %, et la mesure explique pourquoi : `Cache-Control: max-age=0, must-revalidate`
sur **tout** le HTML, y compris les 3838 pages objet. Un `s-maxage` dans `_headers`
aurait fait monter le chiffre.

Sauf que la mesure suivante a coupé court : TTFB **140–200 ms sur tout**, cachés
comme non cachés (`pandaahh.css` 141 ms, une image 148 ms, `/o/soma_prime_set`
140 ms). Le plancher vient du réseau de ce conteneur, pas de Cloudflare — donc
**aucune preuve d'un gain**, et Pages sert déjà depuis son propre réseau. Contre un
risque réel de HTML périmé après déploiement. **Chiffre laid, problème inexistant :
on ne touche pas.** Écrit ici pour que personne ne le « corrige » dans six mois.

**Ce qui a été fait : `/moderation`.** v76 a rendu la publication automatique, mais
deux signalements masquent un build — et il n'existait alors aucun moyen de le revoir
ou de le republier sans `curl`. Sur téléphone, aucun moyen du tout. **Une fonction de
secours qu'on ne peut pas actionner n'est pas une fonction.**

La page liste la file, montre le lien d'arsenal cliquable, et offre deux boutons par
build (republier / refuser définitivement). Le jeton est saisi une fois, rangé dans
`localStorage`, envoyé uniquement en en-tête `X-VR-Admin` vers le même domaine —
**jamais dans l'URL, jamais dans le dépôt** — et « Oublier le jeton » l'efface.
`noindex`, hors navigation, hors sitemap, hors index ⌘K.

**Deux défauts trouvés en testant, aucun à la relecture :**

* le message « Build republié » était **écrasé** par le rechargement de la file : on
  cliquait, rien ne semblait se passer. Le message est maintenant passé à `charger()` ;
* les liens de nav sortaient à **19 px de haut**, sous le minimum WCAG de 24. Cause :
  j'avais repris le header `.vrnav`, stylé dans `style.css`, alors que la page charge
  `pandaahh.css`. Attrapé par `verifier_cibles_tactiles.mjs`, pas à l'œil.

`tests/e2e/test_moderation.py` (12 vérifications) rejoue l'API en local : mauvais
jeton refusé, jeton **jamais** présent dans l'URL, titre de build **échappé** et non
interprété, champ vidé après usage, oubli effectif du jeton.
### v84 — la bibliothèque de builds a enfin une adresse (05/09/2026)

> Renumérotée de v79 en v84 à la fusion : un second agent travaillait en parallèle
> et avait déjà pris v79. Cinq numéros entraient en collision (v78 à v82) — deux
> journaux valent mieux qu'un journal ambigu. Livrée par la PR portant « v79 ».

La bibliothèque communautaire existait déjà, mais **on ne pouvait pas y envoyer
quelqu'un** : elle ne s'ouvrait que par le bouton d'Arsenal, et seulement filtrée sur
l'objet équipé. Un joueur arrivant sans savoir quoi équiper ne la voyait jamais, et
aucun lien — message, réseau social, carte d'`/outils` — ne pouvait y mener.

`/arsenal#biblio` l'ouvre maintenant en **mode global** : tous les objets confondus,
triés par votes. C'est une adresse, donc partageable. Une 18ᵉ carte sur `/outils` y
mène (le sous-titre « 18 outils » a été recompté, il disait 17).

En mode global, chaque ligne devait afficher **le nom** de l'objet, pas son
`uniqueName` : `nomDeUn()` le résout dans les warframes, toutes les familles d'armes
et les compagnons. Écrit sciemment sur une liste concaténée à la volée plutôt qu'un
index : la bibliothèque affiche vingt lignes, pas trois mille.

**Deux pièges rencontrés, tous deux gardés :**

1. `btn.addEventListener("click", ouvreBiblio)` passe l'**Event** en premier
   argument. `tout` valait donc l'objet Event — toujours vrai — et le bouton d'une
   arme aurait ouvert la vue globale. Enveloppé dans une fonction ; un test l'affirme.
2. **Mon propre test passait par accident.** Le jeu d'essai portait le titre « Rhino
   tanky » sur un `uniqueName` qui n'est pas celui de Rhino, et l'assertion
   `"Rhino" in txt` réussissait sur le **titre** pendant que la page affichait, à
   raison, un autre nom. Mesure faite :
   `/Lotus/Powersuits/IronFrame/IronFrame` est **Hildryn**, pas Rhino. Le jeu d'essai
   utilise désormais de vrais `uniqueName` (`/Lotus/Powersuits/Rhino/Rhino`,
   `.../PrimeBoltor/PrimeBoltor`) et des titres qui **ne contiennent aucun nom
   d'objet** : l'assertion ne peut plus réussir sans que `nomDeUn()` ait travaillé.
   Prouvé en neutralisant `nomDeUn()` — les deux contrôles crient.

**Deux culs-de-sac trouvés en regardant l'état RÉEL, pas le code :** en production
l'API ne renvoie qu'un build, donc le mode global pouvait être vide — et il annonçait
alors « Aucun build publié **pour cette arme** », phrase qui n'a aucun sens quand on
n'a pas d'arme. Et sans objet équipé, le bloc de publication disait « Équipe une arme »
sans donner le moyen de le faire : la fenêtre couvre justement l'arsenal. Un bouton
« Choisir un objet » la ferme, ce qui découvre l'arsenal — l'action demandée devient
faisable. Ce bouton est aussi branché sur le **chemin d'erreur** de l'API, qui ne
passait pas par `brancherPublier()` : un bouton mort est pire que pas de bouton.

Suite `tests/e2e/test_biblio_url.py` (11 contrôles), inscrite au banc d'essai (12
suites). Le contrôle du message de vide a été mis en échec avant d'être gardé. Le test
navigue vers `/arsenal?v=2#biblio` et non deux fois vers la même ancre : re-naviguer
vers une URL identique à l'ancre près est une navigation « même document », la page ne
se recharge pas et on relit la fenêtre précédente — mesuré, le contrôle passait au vert
à tort. `sw.js` → v132.
### v85 — le garde-fou protégeait le mauvais fichier (05/09/2026)

> Renumérotée de v80 en v85 à la fusion : un second agent travaillait en parallèle
> et avait déjà pris v80. Cinq numéros entraient en collision (v78 à v82) — deux
> journaux valent mieux qu'un journal ambigu. Livrée par la PR portant « v80 ».

Trouvé en mesurant la fraîcheur des données en production, pas en lisant le code.
`data/cycles.json` avait plus d'une heure de retard (Cetus expirait à 06h01, il était
07h20). En cherchant qui l'affichait : **personne**. Les cycles de `/monde` viennent
de WarframeStat en direct, et `/hub` recalcule les siens côté client depuis
`summary.json`, avec rollover — c'est pour ça que le retard ne se voyait nulle part.

Le vrai défaut était à côté. Le garde-fou vérifiait `data/market.json` et
`data/cycles.json` sous le commentaire « le dashboard a besoin du marché/cycles ».
C'est faux : le tableau de bord lit **`data/summary.json`**, comme `/digest`, les deux
guides Incarnon, le widget d'exemple et `js/deals.js` — six fichiers. Ce fichier de
111 Ko n'était gardé par rien : il pouvait disparaître, le garde-fou serait resté vert
et le tableau de bord serait parti en production cassé.

`summary.json` est désormais vérifié. Mis en échec avant d'être gardé : fichier
déplacé → « ❌ donnée de base manquante », déploiement bloqué ; remis → tout repasse.
`cycles.json` reste vérifié — le contrôle ne coûte rien — mais sans lui prêter un rôle
qu'il n'a pas, et le commentaire dit maintenant la vérité mesurée.

**Deuxième garde-fou, trouvé en répétant les fusions à blanc.** Sept branches
attendaient d'être fusionnées ; j'ai rejoué la séquence en local pour vérifier l'ordre
annoncé. Trois conflits, tous d'apparence anodine — et une résolution naïve (« prendre
la version de la branche ») faisait **disparaître l'inscription de deux suites e2e**
dans `tout_tester.py`. Les fichiers restaient sur le disque, plus rien ne les lançait,
et **aucun test n'échouait pour le dire** : une suite non inscrite ne garde rien.

Le garde-fou vérifie donc que chaque `tests/e2e/test_*.py` du disque est bien inscrit
au banc d'essai. Mis en échec en désinscrivant `test_langue.py` : « suite(s) e2e
présentes mais NON inscrites », déploiement bloqué.

**Il a servi tout de suite.** À la fusion de v83, il a trouvé `test_moderation.py`
sur le disque, jamais inscrite au banc : dix contrôles écrits, vérifiés une fois à la
main, et **plus jamais relancés depuis**. Lancée, elle passe — elle était simplement
invisible. Inscrite. Le banc compte 13 suites.

**Règles de résolution pour ces fusions**, mesurées et non devinées :
`sw.js` → garder la version la PLUS HAUTE ; `scripts/.generated-manifest.json` et
`data/arsenal/meta.json` → **régénérer**, jamais choisir un côté ;
`scripts/verifier_invariants.sh` et `tests/e2e/tout_tester.py` → **union** des deux
ajouts, jamais l'un ou l'autre.

**Une exception, découverte en appliquant la règle.** `data/arsenal/warframes.json` ne
se régénère PAS à la légère : `enrichir_stats_capacites.mjs` lit des pages du wiki en
direct et en rate quelques-unes à chaque passage (« pages illisibles : 11 »). Une
régénération de fusion a ainsi **perdu les statistiques d'une capacité de Kullervo**.
Pour ce fichier, garder la version la plus RICHE (celle qui compte 454 capacités
enrichies) et ne régénérer que si l'on compare le résultat avant de le garder.
### v86 — l'arsenal affichait des chiffres faux sur 25 warframes (05/09/2026)

> Renumérotée de v81 en v86 à la fusion : un second agent travaillait en parallèle
> et avait déjà pris v81. Cinq numéros entraient en collision (v78 à v82) — deux
> journaux valent mieux qu'un journal ambigu. Livrée par la PR portant « v81 ».

Le pire genre de défaut : **plausible**. Personne ne pouvait le voir, parce qu'un
bouclier de 1380 au lieu de 1780 ressemble à un bouclier.

`generer_arsenal_data.mjs` découpait `Module:Warframes/data` sur `\n\t\t[`. Or ce
module indexe **sans crochets** (`\t\tAsh = {`), contrairement à `Module:Ability/data`
(`\t\t["Accelerant"] = {`) — sur lequel le même découpage, lui, est correct. Résultat :
**59 blocs lus sur 126**, et les champs d'une entrée rattachés à une autre.

**Le premier correctif a été jeté, et c'est la leçon du jour.** J'avais écrit un
découpage « corrigé », toujours à l'expression régulière. Il marchait. Puis, en
vérifiant si d'AUTRES modules souffraient du même mal, j'ai trouvé
`scripts/lib_lua.mjs` — un vrai analyseur Lua, déjà utilisé pour les quatre modules
d'armes. Mesuré contre lui, ma regex ratait encore **trois frames entières** (Gauss
Prime, Grendel Prime, Gyre Prime), tronquait **neuf passifs**, ramassait les Archwings
au passage — et surtout **cassait Grendel Prime**, dont les valeurs étaient justes par
accident. Le module est désormais lu par l'analyseur du dépôt, section `Warframes`
seulement. Ne pas réécrire à la main ce que le dépôt sait déjà faire.

Ce que ça donnait à l'écran, mesuré avant/après sur les 119 frames :

| Warframe | affiché | réel |
|---|---|---|
| Hydroid Prime | 2310 PV *(ceux d'Inaros)*, 0 bouclier | 370 / 650 |
| Gauss Prime | 1295 PV *(ceux de Grendel)*, 95 bouclier | 370 / 650 |
| Khora Prime | 1205 PV *(ceux de Kullervo)*, 0 bouclier | 465 / 465 |
| Harrow Prime | 1780 bouclier *(celui de Hildryn)*, 0 énergie | 740 / 210 |
| Hildryn | 1380 bouclier | 1780 |
| Grendel | 1195 PV / 195 bouclier | 1295 / 95 |

**25 frames** affichaient au moins un chiffre faux, et l'erreur se propageait à tout ce
qui en dépend — les PV effectifs les premiers. Six Prime portaient aussi une polarité
Exilus empruntée à l'entrée voisine ; cinq frames de base perdaient la leur.

Hildryn et Grendel sont les cas qui prouvent la correction : la formule générale
(+100 PV / +100 bouclier / ×1,5 énergie) leur donne 1380 et 1195/195, quand le wiki
dit **1780** (+500 de bouclier) et **1295/95** (+200 PV, pas de bouclier). Ce sont
précisément les exceptions que le commentaire d'origine annonçait — et que le
découpage cassé empêchait d'appliquer depuis le début. Recoupé avec
`api.warframestat.us`, indépendant du wiki.

**Au passage, les passifs.** Le panneau « Passif » montrait, sur 88 frames sur 119,
le texte brut de l'API : `de |DAMAGE|% qui durent |DURATION|%`, et les balises de
couleur du jeu (`<DT_SLASH_COLOR>Tranchants`). Les marqueurs ne sont résolus **ni en
français ni en anglais** chez WarframeStat — mais le wiki porte la phrase avec ses
chiffres. On substitue donc dans l'ordre, **seulement si les deux comptes coïncident**,
et après avoir retiré le nom de la frame du texte : sans ça, le « 09 » de Cyte-09
passerait pour une valeur. Quand la preuve manque, **on ne touche à rien** — un
marqueur visible vaut mieux qu'un chiffre inventé. 88 → **4** frames, résidu gardé.

Gardé par `scripts/verifier_arsenal_wiki.mjs` (branché dans la porte d'entrée, sans
réseau, quelques millisecondes) : six exceptions de rang 30 vérifiées nommément, aucun
PV/bouclier de rang 30 à zéro quand la base est positive — c'était la *forme* de la
contamination —, zéro balise du jeu, et un plafond sur le résidu de marqueurs. **Mis en
échec sur les données d'avant : 15 échecs.** Plus `tests/e2e/test_arsenal_wiki.py`
(6 contrôles) qui ouvre la vraie page, parce qu'un garde-fou qui lit un fichier ne dit
rien de ce que voit le joueur. `sw.js` → v133.
### v87 — les mods de lien du compagnon, que le site conseillait sans savoir les montrer (05/09/2026)

> Renumérotée de v82 en v87 à la fusion : un second agent travaillait en parallèle
> et avait déjà pris v82. Cinq numéros entraient en collision (v78 à v82) — deux
> journaux valent mieux qu'un journal ambigu. Livrée par la PR portant « v82 ».

Choisi par la mesure, pas par intuition. Parmi les 264 mods sans effet simulé, quinze
touchent une statistique **affichée**. Treize sont conditionnels ou visent l'ennemi :
les chiffrer en permanence serait faux. Restaient deux candidats, et c'est le dépôt
lui-même qui a tranché : `generer_builds.mjs` recommande **Link Vitality et Link Fiber
dans les builds de compagnon de TOUS les niveaux** — débutant, milieu, expert. Le site
disait donc de les équiper, et le simulateur répondait « effet non simulé ».

`Lien-Vitalité`, `Lien-Redirection`, `Lien-Fibre` : +125 % de la santé, du bouclier ou
de l'armure **de la Warframe**, ajoutés au compagnon.

Trois décisions, chacune pour une raison :

1. **L'effet vient du générateur, pas d'une table en dur** dans le front. Trois motifs
   dans `PATTERNS` produisent `lnkhp` / `lnksh` / `lnkar` depuis le texte du mod
   (391 → **394** effets simulés). Une valeur codée à la main dans `arsenal.js` aurait
   survécu à la prochaine régénération sans que personne ne sache d'où elle sort.
2. **Clefs distinctes de `hp` / `sh` / `ar`.** Les confondre appliquerait +125 % aux PV
   **du compagnon** : un compagnon fragile paraîtrait solide, et une frame tank ne
   servirait à rien. Le libellé le dit aussi à l'écran — « Santé (de la Warframe) ».
3. **Bonus PLAT, ajouté APRÈS le pourcentage des mods du compagnon**, jamais multiplié
   par lui : exactement la règle déjà retenue pour l'aura Berger (v56), et elle est
   écrite **sous le tableau**, pas seulement en commentaire — le joueur doit pouvoir
   refaire le calcul.

`tests/e2e/test_liens_compagnon.py` (9 contrôles) ne se contente pas de constater que
le chiffre bouge — ça passerait au vert avec une formule fausse. Il **calcule** :
940 + 1,25 × 370 = 1403, vérifié à l'unité. Puis il pose Vitalité sur la frame
(370 → 740 PV) et exige que le compagnon suive à 1865 : c'est ce contrôle-là qui
distingue « statistiques moddées » de « statistiques de base ».

Deux pièges rencontrés, écrits dans le test : le mod **quitte la collection** une fois
équipé, donc son libellé se lit avant la pose ; et `round()` de Python arrondit au pair
(1402,5 → 1402) là où `Math.round` de JavaScript va au supérieur — le test échouait sur
un code juste. `sw.js` → v134.

### v88 — deux journaux qui se marchaient dessus, et un garde-fou qui accusait à tort (05/09/2026)

Fusion des sept branches en attente, à la demande du Chef. Deux choses ne se voient
qu'en fusionnant pour de vrai, et aucune n'aurait été trouvée en lisant les PR.

**1. Cinq numéros de version en double.** Deux agents travaillaient en parallèle sans
se voir : v78, v79, v80, v81 et v82 existaient chacun **deux fois**. Un journal dont
les numéros sont ambigus ne sert plus à rien — et `CLAUDE.md` dit d'y renvoyer. Mes
cinq entrées sont renumérotées **v83 → v87**, chacune portant une note qui dit son
ancien numéro et la PR qui l'a livrée. Le précédent existait déjà dans ce fichier
(v77 renumérotée en v78 le matin même) ; on le suit plutôt que d'en inventer un autre.

**2. `verifier_outils_declares.mjs` accusait une carte valide.** Il résolvait l'URL
d'une carte vers un fichier **sans retirer l'ancre** : `/arsenal#biblio` le faisait
chercher `arsenal#biblio.html`, puis comparer une déclaration `/arsenal` à une carte
`/arsenal#biblio`. Deux faux positifs pour la même raison — une ancre n'a jamais
désigné un fichier, et deux cartes peuvent mener à la même page par des ancres
différentes. Corrigé aux deux endroits ; **remis en échec dans les deux sens** (carte
vers une page absente, déclaration pointant ailleurs) pour vérifier que le corriger ne
l'avait pas désarmé.

Ce défaut ne pouvait apparaître qu'ici : le garde-fou est né dans une branche, la
carte à ancre dans une autre, et aucune des deux CI ne voyait l'autre. **Une CI verte
sur chaque branche ne dit rien de leur somme.**

### Pistes suivantes (par valeur décroissante, toutes concrètes)
1. **Les conditionnels sont traités** : Adaptation (v53), le compteur de combo
   (v51), Pouvoir Grandissant (v65). La famille du saignement est CLOSE :
   Munitions du Chasseur (v58), la durée de statut (v63), Hémorragie et
   Hémorragie Interne (v64). Ce qui reste demande une donnée que le moteur
   n'a pas : **Récupération du Chasseur** (« Warframe soignée de 30 % des
   dégâts du compagnon ») attend un DPS de compagnon, qui n'est pas modélisé.
2. ~~**Suites e2e jamais relancées**~~ — faites le 04/09/2026 :
   `test_recherche`, `test_outils_pages` et `test_cwv` passent toutes les
   trois, y compris sur `/trade` et `/estimateur` où le bandeau de profil a
   été injecté.
2. **Anciennes pistes, déjà traitées** — pour mémoire : `+N% Heavy Attack Efficiency`, `+Ns Combo
   Duration`, `+N% Finisher Damage` sont lus en texte mais pas chiffrés — il
   manque surtout un modèle d'attaque lourde côté `statsArme`.
3. **Champs du wiki encore inexploités**, mesurés le 04/09/2026 sur
   `Module:Weapons/data/primary` : `AmmoPickup` (196 armes — la base des mods
   de mutation de munitions), `MinSpread`/`MaxSpread` sur `Attacks[]` (la base
   des mods de PRÉCISION), `Family`, `IncarnonChargeGain`. `ExilusPolarity` est
   traitée en v68. **Le recul n'existe dans AUCUN champ du module** — la note
   de v50 qui le disait « sans base publiée » est confirmée par la mesure, et
   les 7 mods de recul restent donc honnêtement non simulés.
4. **Armure / boucliers / surgarde** : volontairement hors du tableau de
   factions (annoncé sous le tableau). Si le besoin revient, le faire comme une
   colonne de plus par faction, jamais comme un formulaire de réglages.

### v89 — trois automates en panne silencieuse depuis des jours (26/09/2026)

Aucun garde-fou local ne rougissait : `verifier_invariants.sh` passait au vert. Les
pannes n'étaient visibles que dans l'historique des Actions.

**1. Données gelées depuis le 22/09 19:46Z.** Les 14 runs de `warframe-hub-update.yml`
suivants échouent en 3 s, `runner_id: 0`, aucune étape exécutée : **quota de minutes
Actions épuisé** (même symptôme que le 15/07). Rien à corriger dans le code — il faut
soit attendre la remise à zéro du 1er octobre, soit que le Chef relève la limite de
dépense dans les réglages GitHub (Billing → Actions). Le 22/09, deux PR ont chacune
consommé ~17 min de `garde-rendu.yml` ; c'est ce workflow le plus gourmand.

**2. `social.yml` échouait chaque jour.** L'étape de commit **effaçait**
`package.json` et `package-lock.json`, qui sont suivis par git ; `git pull --rebase`
refusait alors de tourner (« You have unstaged changes »). Le post était généré puis
jamais poussé. On restaure les deux fichiers (`git checkout --`) au lieu de les effacer —
simulé : deux changements avant, arbre propre après.

**3. `pages-objets.yml` refusait de régénérer (270 « dérives »).** L'empreinte
`scripts/.generated-manifest.json` datait d'une branche d'avant la régénération v78 ;
la fusion v88 l'a gardée telle quelle. Les 270 fichiers étaient pourtant **identiques**
à la sortie du gabarit (`--verifier` le confirmait). `assertNoDrift` ne compte plus
comme dérive un fichier dont le contenu sur disque est exactement celui qu'on va écrire —
rien ne serait écrasé. Remis en échec sur un vrai défaut : une retouche committée de
`en/guides/kuva-lich.html` est toujours détectée (1 dérive, la seule vraie).

**4. La cause du gel, chiffrée, et coupée.** Minutes facturées du 01 au 22/09 (385 runs,
arrondi à la minute supérieure comme GitHub) : **2 046**, pour un quota de 2 000.
`garde-rendu.yml` seul : **1 469 (72 %)**, dont 1 309 sur `pull_request` (97 runs de
13–18 min). La mise à jour des données : 315 (15 %). Le déclencheur `pull_request` de
`garde-rendu.yml` est retiré — ce garde-fou n'a jamais bloqué un déploiement, il reste
sur `push` vers main et au bouton « Run workflow ». Estimation au même rythme :
~740 min/mois, soit un tiers de marge au lieu d'un dépassement. Le script de données a
été relancé en local le 26/09 : il fonctionne (6 min 47 s, marché et worldstate OK).

### v90 — l'en-tête, mesuré sur toutes les largeurs d'écran (26/09/2026)

Aucun garde-fou ne pouvait le voir : rien ne débordait, aucune cible n'était trop
petite, aucun contraste n'était faux. L'en-tête était simplement mal rangé, partout.

**1. Ordinateur : la recherche mesurait 4 px.** De 1024 à 1920 px, les 14 liens FR
(1 451 px) se disputaient une seule rangée flexible de 1 166 px avec la marque, la
recherche et les boutons. C'est la recherche qui cédait : champ de saisie de **4 px**,
en-tête de 150 px (194 à 1024). Rangée 1 = marque + recherche + boutons, rangée 2 = le
menu compacté ; « Accueil » masqué au-dessus de 900 px (la marque y mène déjà).
Mesuré après : recherche **335 px**, en-tête **104 px** de 1280 à 1920 (139 à 1024).

**2. Mobile : deux rangées et un ☰ qui se promenait.** De 320 à 414 px, l'en-tête
passait sur deux rangées (112–116 px) et le bouton menu changeait de place selon la
largeur. Écarts resserrés, marque réduite, ◈ masqué (il mène à /outils, déjà dans le
menu) : **56 px**, une rangée, ☰ toujours à droite, de 320 à 414 px.

Tout est dans `css/pandaahh.css`, donc sur les ~815 pages qui portent `.topbar`.
`sw.js` → v135.

### v91 — mesurer ce que font les visiteurs, pas seulement combien ils sont (26/09/2026)

Cloudflare Web Analytics comptait déjà les pages vues (balise sur 5 692 pages). Rien ne
disait ce qui se passe SUR les pages — et donc aucune piste ne pouvait être classée.

**Ce qui est compté** (`js/warp.js`, bloc indépendant en fin de fichier — chargé sur
5 688 pages, aucune page à régénérer) : départ vers un autre site (`sortie`, détail =
domaine — warframe.market est la conversion d'un site de trading), résultat de
recherche ouvert (clic OU Entrée), favori, comparateur, « copier le nom », partage
(détail = réseau), changement de langue. Les boutons de `js/objet.js` portent un
`data-evt` : favori et comparateur partageaient la même classe `favbtn`.

**Ce qui est stocké** (`functions/api/evt.js`, table `evt` dans la base D1 `BUILDS`
déjà liée en production) : un compteur par (jour, geste, détail, page). Ni IP, ni
cookie, ni identifiant, ni heure — impossible de suivre une personne, par construction.
Liste d'événements fermée, même origine seulement, 512 octets max. La table se pose
seule au premier appel : **aucun réglage Cloudflare à faire.**

**Où lire** : `/stats` (privée, noindex, même jeton `VR_ADMIN_TOKEN` et même clé de
navigateur que `/moderation`).

**Ce qui n'envoie rien** : tout hôte autre que voidrelay.fr — ni les tests locaux ni
les aperçus de branche ne salissent les chiffres.

Garde-fous, **chacun mis en échec sur un vrai défaut avant d'être branché** :
- `scripts/verifier_api_evt.mjs` (dans `verifier_invariants.sh`) appelle le vrai
  `onRequest` sur une vraie SQLite (`node:sqlite`, Node 22+) ; base simulée sous
  Node 20 (CI), forçable avec `VR_SANS_SQLITE=1`. Échoue si l'on retire le contrôle
  d'origine (4 cas) ou si `ON CONFLICT … n = n + 1` devient `DO NOTHING` (2 cas).
- `tests/e2e/test_mesure.py` : voidrelay.fr résolu vers le serveur local
  (`--host-resolver-rules`), envois interceptés. Les 7 gestes arrivent avec leur
  page ; en local, zéro envoi (échoue si l'on retire la restriction d'hôte : 2 envois
  partis de localhost). `/stats` lit avec le jeton en en-tête, jamais dans l'URL.

`sw.js` → v136.

### v92 — le titre des pages objet était blanc sur fond clair (26/09/2026)

En thème clair, le `h1` des 3 838 pages `/o/` (et des pages `/en/o/`) gardait le dégradé
**blanc → bleu pâle** du thème sombre : **1,12:1** sur le fond clair, titre quasi
invisible. Le commentaire de `css/style.css` annonçait pourtant « h1 navy uni » en
`[data-theme="light"]` — aucune règle ne le posait. Correctif : une ligne, texte uni
`var(--ink)` (17,5:1). `body.light h1` (ex-SPA, plus spécifique) reste prioritaire là où
la classe est posée : le Codex et les pages-outils ne bougent pas.

**Pourquoi `verifier_contraste` restait vert — trois angles morts cumulés :**
1. il basculait les pages `style.css` par `body.light` (le clair de l'ex-SPA, qui donne
   un h1 marine lisible) alors que le site réel pose `data-theme` sur `<html>` depuis le
   16/07 : il testait un thème que plus aucun visiteur ne voit ;
2. il ne lit que les éléments SANS enfant — ce h1 contient les boutons injectés
   « Copier le nom », « Favoris », « Comparer » ;
3. il lit `color`, qui vaut « transparent » pour un texte peint par dégradé, et saute
   tout texte posé sur un fond en dégradé (le body clair en est un).

Corrigé : bascule par `data-theme` ; contrôle dédié des textes en dégradé
(`background-clip:text`) qui mesure le PIRE arrêt du dégradé contre le fond du parent
(ramené à `--bg` quand ce fond est lui-même un dégradé). **Mis en échec avant le
correctif CSS : 18 échecs** (pages /o/ et /en/o/ en clair, 1,12:1) ; après : 0 sur 218
chargements. Les 8 pages-outils qu'il signalait aussi sont lisibles en vrai (leur script
pose `body.light`) — la nouvelle règle les couvre de toute façon.

`sw.js` → v137 (branche empilée sur la PR #29, qui porte v136).

### v93 — l'en-tête mobile des pages objet mangeait un tiers de l'écran (26/09/2026)

Les 3 838 pages `/o/` (+ `/en/o/`) sont les pages d'arrivée depuis Google. Mesuré de 360 à
390 px : leur en-tête `.vrtop` faisait **240 à 286 px**, et il était **collant** — un tiers
de l'écran perdu pendant toute la lecture. Le prix, raison de la visite, restait sous la
ligne de flottaison. Le menu passait sur deux lignes, les boutons EN/thème/Favoris/
Comparateur faisaient une rangée à part, et une réserve anti-CLS de 232 px figeait le tout.

Correctif CSS seul (`css/style.css`, aucune page à régénérer), sous 640 px : trois rangées
d'une ligne — marque … EN + thème ; menu **défilable horizontalement** ; recherche +
Favoris + Comparateur côte à côte. Les boutons injectés par `js/objet.js` arrivent dans des
rangées déjà présentes, donc la réserve de 232 px disparaît sans rouvrir le CLS. Sur mobile
l'en-tête défile avec la page (collant, même compact, il reprendrait l'écran à chaque ligne).

Mesuré après : **143 px** de 360 à 640 px (186 à 320 px, où « Comparateur » passe à la
ligne), zéro débordement horizontal. Tablette et ordinateur (≥ 641 px) inchangés, toujours
collants. `sw.js` → v138.

Vérifié (`VR_BLOQUER_EXTERNE=1`) : CLS médian < 0,1 sur 44 pages malgré le retrait de la
réserve · 0 débordement sur 114 pages × 2 tailles · 0 cible tactile < 24 px sur 112 pages ·
0 échec de contraste sur 220 chargements · e2e `test_recherche`, `test_mesure`, `test_warp`,
`test_langue`, `test_cwv` au vert.

### v94 — Arsenal : précision, munitions par ramassage, Incarnon, famille (26/09/2026)

Piste 1 de la liste « Champs du wiki encore inexploités » (v88). Les quatre champs
mesurés le 04/09 dans `Module:Weapons/data/primary|secondary` sont désormais cuits dans
`armes.json` par `generer_arsenal_data.mjs` (dans `statsTir`, pas dans un script à part :
un enrichissement séparé serait écrasé à la prochaine cuisson — le piège des capacités).

| Champ wiki | Clef | Ce qu'il débloque |
|---|---|---|
| `AmmoPickup` (+ défaut du module : 80 / 40) | `pick` | ligne « Munitions par ramassage », Récupérateurs, mutations |
| `Attacks[1].MinSpread/MaxSpread` | `smin`/`smax` | ligne « Précision », mods de précision |
| `Family` | `fam` | « Même famille » : change de variante EN GARDANT le build |
| `IncarnonChargeGain` + `IncarnonCharges` | `incg`/`incc` | coups au point faible pour une jauge pleine |

**Précision** — règle du wiki (page Accuracy, 26/09) :
`100 / [ (min + max) / 2 × (1 + % de dispersion) + dispersion plate ]`.
Un « +77 % Accuracy » retire 77 % de dispersion. **Piège** : Gros Calibre et Force Magnum
affichent « −55 % » mais ajoutent en réalité des degrés **plats** (+2,97° / +5,5° au rang
max) et **davantage** sur certaines armes (Ogris +55°, Acrid +56,65°…). Ces valeurs ne
vivent que dans les tableaux de leurs pages : la cuisson les **lit** (`m.spp` par rang,
`w.spx` par arme), elle ne les recopie pas, et **s'arrête** si le format change.
Sans dispersion (ou 0), la moyenne vaut 1 pour les mods (wiki) → précision 100.

**Incarnon** — la jauge se remplit par coups au POINT FAIBLE ; pleine en
`IncarnonCharges ÷ IncarnonChargeGain` coups. Formule **vérifiée sur les trois armes dont
la page publie le résultat** : Felarx 60/2 = 30, Phenmor 408/34 = 12, Laetum 216/18 = 12.

**Munitions** — Rifle Scavenger vaut pour TOUTES les principales (wiki : « Applies to all
primary weapons ») ; Shotgun / Sniper Scavenger pour leur classe ; la mutation convertit
une part du ramassage de l'autre munition, récupérateur compris.

Mods simulés : **394 → 406**. `tests/e2e/test_arsenal_tir.py` (12 contrôles, tous
ARITHMÉTIQUES : Soma Prime 28,6 → 15,5 avec Gros Calibre, Boar Prime 5 → 21,7 avec Obus
Corrompu, 80 → 200 avec Rifle Scavenger, mutation 37, Incarnon 20 coups, variante qui
garde son build). **Mis en échec** : sans la dispersion plate, Gros Calibre donne 18,4.

Recuisson complète au passage (dernière : 05/09) : 2 armes, 2 arcanes et 9 Warframes
changent à la source ; **454 capacités avec stats avant comme après** (vérifié : aucune
perte, Banshee en gagne). `sw.js` → v139.

**Trouvé en chemin, PAS corrigé ici (PR suivante)** : les malus des mods corrompus ne
sont pas lus — 40 mods ont une ligne « −N % » ignorée. Blind Rage compte +99 % de
puissance sans son −55 % d'efficacité ; Narrow Minded, Transient Fortitude, Fleeting
Expertise, Critical Delay… affichent des builds trop beaux.

### v95 — Arsenal : les malus des mods corrompus étaient ignorés (26/09/2026)

Trouvé en faisant v94. Les motifs du parseur sont écrits pour « +N% … » : une ligne
« −N% … » ne correspondait à rien et le mod passait pour « partiellement simulé » — en
gardant son bonus. **Blind Rage comptait +99 % de puissance sans son −55 % d'efficacité**,
Narrow Minded +99 % de durée sans −66 % de portée, Critical Delay +200 % de critique sans
−20 % de cadence… Tous les builds qui les portent — une grande part des builds de frame —
affichaient des chiffres trop beaux, sans la moindre erreur.

Correctif (`parseEffects`) : une ligne négative qu'aucun motif ne prend telle quelle est
relue en « + », et la valeur en tête est inversée. **18 mods** corrigés, tous vérifiés un
à un (Blind Rage, Transient Fortitude, Narrow Minded, Fleeting Expertise, Overextended,
Critical Delay/Deceleration, Creeping Bullseye, Spoiled Strike, Anemic Agility, Frail
Momentum, Vile Acceleration, Hollow Point, Burdened Magazine, Tainted Clip, Depleted
Reload, Tainted Shell, Vile Precision). Les 22 autres lignes négatives (recul, gravité,
précision ennemie, friction…) restent illisibles **exprès** : aucune base ne permet de
les chiffrer. Mods simulés : 406 → 407.

Le moteur n'avait jamais eu à borner l'efficacité par le bas : plancher **25 %** posé
(wiki Ability_Efficiency : « abilities cannot consume more than 175% or less than 25% of
their base costs »). Aucun plancher n'est publié pour durée, portée ou puissance — rien
d'inventé.

`tests/e2e/test_arsenal_malus.py` (6 contrôles) : Colère Aveugle 199 % / 45 %, Étroit
d'Esprit 199 % / 34 %, Délai Critique 15 → 12. **Mis en échec sur les données d'avant :
3 échecs** (efficacité 100, portée 100, cadence 15). `sw.js` → v140.

### v96 — Arsenal : attaque lourde, combo et finishers (26/09/2026)

Piste 2 de la demande « modèle d'attaque lourde côté statsArme ». Mesure d'abord : sur
les mods de mêlée, **7 mods** avaient une ligne de combo ou de finisher que le parseur ne
lisait pas — ils passaient pour « partiellement simulés » en gardant leur autre bonus.
Charge Corrompue comptait ses +40 % de vitesse de charge sans son −50 % de durée de combo,
Véritable Punition idem, Coup de Grâce (Prime) ne comptait rien du tout.

Nouvelles clés lues par le cuiseur (`generer_arsenal_data.mjs`) :
- `cdurp` : durée de combo **en %**. Le wiki (Melee_Combo) l'applique à la **BASE** de
  l'arme, pas au total : Nikana Prime 5 s + Charge Corrompue = 2,5 s, puis + Décompte des
  Morts (+12 s plats) = 14,5 s — pas 8,5.
- `accc` : chance de combo supplémentaire. Multiplie la montée du combo dans le bloc
  posture (« dont +X % de combo supplémentaire »).
- `fin` : dégâts de finisher, affichés en % du finisher de base (Coup de Grâce Prime 265 %).
- Assistance en Mêlée (aura, « You lose Xs Melee Combo Duration ») : −6 s sur TA mêlée.
  Plancher **0,1 s** (le moteur ne descend jamais à 0 ni en négatif).

Efficacité d'attaque lourde : déjà lue et affichée depuis v52 (« Combo consommé »),
mais **sans plafond** — Bobine Réflexe Prime (+110 %) affichait 0 % de combo consommé,
donc des lourdes gratuites à l'infini. Le wiki (Melee_Combo) plafonne l'efficacité à
**90 %** : une lourde coûte toujours au moins 10 % du combo. Corrigé. Le doublon « Pressure Point » (`WeaponMeleeDamageOnHeavyKillMod`) vient de
WFCD, laissé tel quel. Mods simulés : 407 → 411.

`tests/e2e/test_arsenal_combo.py` (11 contrôles arithmétiques). **Mis en échec sur
l'état d'avant : 7 échecs** (durée 5 au lieu de 2,5/14,5/12, combo supp. absent, montée
en 30 s au lieu de 15, finisher absent, plancher non appliqué), puis 1 échec sur le
plafond seul (0 % au lieu de 10 %). `sw.js` → v141.

### v97 — Arsenal : griffes des bêtes et Récupération du Chasseur (26/09/2026)

Piste 3 de la demande. Pour chiffrer « la Warframe récupère 30 % des dégâts du
compagnon » (wiki Hunter_Recovery), il fallait des dégâts de compagnon, or le
simulateur n'en avait **aucun** pour les bêtes : PV, bouclier et armure seulement.

Mesure : depuis la mise à jour 37, les bêtes (Kubrow, Kavat, Vulpaphyla, Prédasite)
ont une **arme à part**, leurs griffes, moddée par ses propres mods (Mâchoire,
Morsure, griffes élémentaires…). WFCD ne les a pas ; le wiki les publie dans
`Module:Weapons/data/companion` (Slot = "Beast"). Le cuiseur les lit : **17 griffes**,
toutes les 15 bêtes du simulateur couvertes. Le lien griffe → bête passe par `Link`,
pas `Users` (faute de frappe « Cresent Vulpaphyla » dans le module). Le cuiseur
**s'arrête** si une bête perd sa griffe : sans ça, le soin tomberait à 0 en silence.

- Les griffes entrent dans l'emplacement « Arme compagnon » et passent par le MÊME
  `statsArme` que toutes les armes (dégâts, critique, DPS). Une bête ne se voit
  proposer QUE ses griffes, un robot jamais de griffes — comme en jeu.
- Mods « Claws » ajoutés au cuiseur (21) ; les 6 postures de compagnon
  (« Posture Mod ») en sont exclues : emplacement à part, rien de chiffrable.
  Mods : 655 → 676 ; simulés : 411 → 428.
- Bloc « Soin de la Warframe » sur le compagnon : 30 % × DPS moddé des griffes.
  Smeeta : 80 × 1,2 = 96 DPS → 29 PV/s ; avec Mâchoire, 412,8 DPS → 124 PV/s.
  Sans griffes équipées, **aucun chiffre** : une phrase invite à les équiper.

Limites écrites sous le chiffre : cadence de la fiche wiki (1 attaque/s), alors que
la cadence réelle dépend de l'IA de la bête ; cible sans armure ; dégâts de statut non
comptés. Pas modélisé : bonus de set du Chasseur, Synergie du Chasseur, conversions
des « Conditioning » (le +385 % est lu, la conversion non).

`tests/e2e/test_arsenal_chasseur.py` (8 contrôles). **Mis en échec sur l'état
d'avant** : pas de griffe, et 24 armes robotiques proposées à une Smeeta. `sw.js` → v142.

### v98 — Arsenal : rechoisir l'objet équipé effaçait son build (27/09/2026)

Trouvé en écrivant le test v97 : dans le sélecteur, cliquer l'objet DÉJÀ équipé
(la même Nikana Prime, le même compagnon) remplaçait la case par `{ un }` —
mods, formas et arcanes disparaissaient sans avertissement. Rien ne rougissait :
c'est un geste naturel (« je vérifie que c'est bien celle-là ») qui détruisait le
travail. Correctif (`pickItem`) : même objet → rien ne change ; un AUTRE objet
repart toujours d'un build vide, comme en jeu (chaque arme a sa configuration).

`tests/e2e/test_arsenal_rechoix.py` (4 contrôles). **Mis en échec sur le code
d'avant** : le mod posé disparaît au rechoix. `sw.js` → v143.

### v99 — Arsenal : Perforation et Tranchant inversés sur 430 armes (27/09/2026)

Trouvé en relançant la cuisson pour v98 : `armes.json` changeait sur 430 armes alors
que rien n'y touchait. Mesure contre les modules de données du wiki officiel
(`Module:Weapons/data/primary|secondary|melee`, première attaque) : **401 armes sur
425 comparables avaient Perforation et Tranchant INVERSÉS** dans les données en
ligne (Boltor Prime : 41,4 de Tranchant au lieu de Perforation ; Rubico Prime
28,1 / 9,3 à l'envers). La source (WFCD) s'était trompée puis corrigée ; la
nouvelle cuisson donne **0 inversion**. Tout ce qui dépend du Tranchant était faux
sans le moindre signe : saignements, Munitions du Chasseur, répartition des types,
bonus de faction par type.

Garde-fou (`scripts/lib_ips.mjs`, appelé par le cuiseur) : compte les armes dont
Perforation et Tranchant sont échangés par rapport au wiki, et **arrête la cuisson**
au-delà de 5 (ou si moins de 300 armes sont comparables : format changé). Il compte
les INVERSIONS, pas les écarts : 24 arcs n'ont pas la même « première attaque » (tir
chargé) des deux côtés, désaccord légitime mesuré. **Mis en échec sur les données
d'avant : 401 inversions.** `sw.js` → v144 (les données d'arsenal sont en cache
stale-while-revalidate : sans bump, un habitué garderait les mauvais types).

### v100 — Arsenal : 71 mods fantômes retirés (27/09/2026)

Les fichiers du jeu contiennent, sous `/Expert/`, des **doublons inobtenables** de
mods ordinaires : Intensify +55 %, True Steel +220 %, Split Chamber +165 %,
Flame Repellent 100 %… Le cuiseur leur ajoutait « Prime » au nom français
(« Intensité Prime », « Acier Véritable Prime »), le simulateur les proposait, et le
build auto pouvait les choisir. Preuve : le wiki n'a **aucune** page « Primed
Intensify », « Primed True Steel », « Primed Flame Repellent », « Primed Finishing
Touch », « Primed Reflex Coil », « Primed Berserker Fury » (vérifié une à une).

Signature retenue (`generer_arsenal_data.mjs`) : un `/Expert/` dont le nom ANGLAIS
ne commence pas par « Primed » **et** qui a un jumeau ordinaire du même nom. Les
3 vrais Galvanisés (Acier, Élémentaliste, Réflexe) vivent aussi sous `/Expert/` sans
jumeau : ils restent — mais perdent le « Prime » inventé (« Acier Galvanisé Prime »
n'existe pas) : le suffixe n'est plus ajouté que si le nom anglais dit « Primed ».
Mods : 676 → 605 ; simulés 428 → 371 (`meta.modsFantomesEcartes` = 71). Un build
sauvegardé qui contenait un fantôme se recharge sans erreur : le mod est ignoré.

Garde-fou (`verifier_invariants.sh`) : aucun fantôme ni faux « Prime » dans
`mods.json`. **Mis en échec sur les données d'avant** (71 fantômes).

**Correction de mes propres versions précédentes** : trois tests reposaient sur des
fantômes, dont deux que j'avais écrits en v96.
- « Coup de Grâce Prime : finishers à 265 % » (v96) : mod inexistant. Le vrai Coup
  de Grâce (+60 %) donne **160 %**.
- Plafond d'efficacité lourde à 90 % (v96) démontré avec « Bobine Réflexe Prime
  +110 % » : inexistant. Démontré maintenant avec le duo que cite le wiki, **Bobine
  Réflexe (+60 %) + Concentration d'Énergie (+40 %)** = 100 % → 10 % consommé.
- v46/v51 : Acier Véritable réel (+120 %) → 61,6 % et 95,2 % (au lieu de 89,6 et
  123,2). v57 : aucun vrai mod n'atteint 100 % de résistance ; le contrôle
  « immunisé » vérifie désormais l'Ignifugé réel (60 %).
- `STACK_MAX` : l'entrée de la « Furie du Berserker Prime » (2 × 64,2 %) est retirée.

`sw.js` → v145.

### Quota Actions — il se débloque tout seul, hors de ce dépôt (27/09/2026)

v89 avait chiffré le gel (2 046/2 000 min) et coupé la cause (`garde-rendu.yml` retiré
de `pull_request`). Il restait un angle mort : si le quota se remplit quand même un
mois donné, plus aucun run ne peut se lancer — y compris un run qui essaierait de
corriger le problème. Un correctif dans ce dépôt ne peut pas se réparer lui-même une
fois le quota à zéro.

**La seule limite qui s'applique est celle des dépôts privés** — un dépôt public a des
minutes GitHub-hosted illimitées et gratuites (confirmé par le support GitHub, aucune
mention contraire dans les conditions d'utilisation Actions). D'où le principe : détecter
un vrai blocage, basculer public le temps que les runs bloqués se terminent, revenir en
privé, vérifier. Jamais par précaution — uniquement sur blocage constaté.

**Pourquoi ce n'est PAS un GitHub Actions workflow de ce dépôt** : un workflow déclenché
par `schedule` consomme lui-même des minutes Actions. Si le quota est déjà à zéro, ce
workflow de réparation ne se déclenche pas non plus — circularité totale. Il fallait un
exécuteur hors de l'écosystème Actions.

**Pourquoi ce n'est pas non plus commité dans ce dépôt** : le classifieur de sécurité de
la session Claude a refusé le commit (catégorie « Create Public Surface » — le code
expose un endpoint HTTP public et manipule la visibilité du dépôt). Deux tentatives
antérieures ont aussi été refusées : créer le token GitHub via automatisation navigateur
(« Unauthorized Persistence ») et faire transiter le token par une tâche planifiée
Claude (« Credential Leakage »). Conclusion : un secret d'admin dépôt ne doit passer que
par les mains de l'admin, jamais par un outil Claude qui le persisterait quelque part.

**Ce qui existe réellement** : un Cloudflare Worker `voidrelay-quota-guard`
(https://voidrelay-quota-guard.oziasetienne.workers.dev), Cron Trigger quotidien
7 6 * * * UTC (8h07 Paris), déployé et maintenu par l'admin via `wrangler` depuis son Mac.
Le secret `GH_PAT` (fine-grained PAT scopé uniquement sur ce dépôt, permissions
Administration + Actions en lecture/écriture) vit uniquement dans le secret store
Cloudflare du Worker — jamais dans ce dépôt, jamais vu par un outil Claude. Testé en
direct le 27/09/2026 : `RAS, pas de blocage detecte aujourd'hui.` (comportement attendu
un jour sans blocage — ne touche à rien).

Rien à modifier dans ce dépôt pour ce chantier. Si le quota bloque encore malgré ce
garde-fou, regarder d'abord les logs Cloudflare du Worker (`wrangler tail` ou dashboard)
avant de suspecter autre chose.

### v101 — Plus aucune page ne défile de côté sur téléphone ni tablette (28/09/2026)

Balayage Playwright de toutes les pages publiques (+ un échantillon par gabarit
généré) à 320, 375 et 768 px, requêtes externes coupées — donc police de repli,
comme une 1re visite (`display=optional`). Zéro erreur JS sur les pages ; en
revanche **six pages glissaient horizontalement sous le doigt**, sans erreur ni
test rouge :

| Page | Débord | Cause | Correctif |
|---|---|---|---|
| /hub | +10 px à 375, +64 à 320 | tableau marché 7 colonnes = 353 px min | `#marketTable{overflow-x:auto}` (`css/hub.css`) : le tableau défile seul dans sa carte |
| /marche | +40 px à **768**, +54 à 320 | pistes `1fr` = `minmax(auto,1fr)`, élargies par les noms en `nowrap` | `minmax(0,1fr)` : `.mk-name` retrouve son « … » |
| /taches | +28 px à 320 | `.cols-2` piste fixe `minmax(330px,1fr)` | `minmax(min(330px,100%),1fr)` (`css/style.css`, toutes pages) |
| /compagnon | +36 px à 320 | champ texte à largeur intrinsèque dans un flex | `.field input[type=text]{min-width:0}` |
| /faq-en | +2 px à 320 | lien long en `.tool a{white-space:nowrap}` | `normal` sous 360 px |
| /confidentialite | +4 px à 320 | « CONFIDENTIALITÉ » en police de repli | `h1{overflow-wrap:break-word;hyphens:auto}` (`css/pandaahh.css`) |
| /en/guides/tennocon-2026-announcements | +11 px à 320 | titre long, même cause | même correctif (trouvée après coup par le garde-fou étendu, ci-dessous) |

Garde-fou : `tests/e2e/test_debordement_mobile.py` (inscrite dans `SUITES`, ~1 min) —
`scrollWidth ≤ clientWidth` sur 48 pages à 320 et 768 px. **Mis en échec sur le CSS
d'avant** : elle nomme exactement les six pages et les débords ci-dessus.
**Pourquoi le garde-fou existant ne l'a pas vu** : `scripts/verifier_overflow.mjs` (114 pages)
ne mesurait qu'à 1440 et **390 px** — largeur où ces pages tiennent. Il mesure désormais aussi
**768 et 320 px**. Mis en échec sur l'état d'avant v101 : 7 débordements, dont la page
TennoCon EN que l'échantillon de la suite e2e (un guide par gabarit) ne couvrait pas.
Les quatre autres garde-fous de rendu (contraste AA, cibles tactiles, CLS, exceptions JS)
ont été repassés le même jour, en local : tous verts. Rappel : ils ne tournent plus sur les PR
depuis v89 (quota), seulement via `garde-rendu.yml` (push sur `main` et planifié). Donc à
lancer à la main (`VR_BLOQUER_EXTERNE=1`) avant une PR qui touche le CSS.
Hors périmètre : `hub-widget.example.html` (exemple de code non lié, exclu).
`sw.js` → v146 (`style.css` et `pandaahh.css` sont dans `SHELL`).

**Même vague — accueil plus léger** : les 4 portraits de l'accueil FR/EN (Excalibur, Mesa,
Rhino, Saryn, 512 px) passent de PNG à WebP qualité 82 (300 → 148 Ko, même définition :
ils servent aussi aux cartes de 352×180 px, pas seulement aux vignettes 48 px). Accueil
mobile mesuré 635 → 524 Ko au chargement. Les PNG restent sur le disque (le reste du site,
`/builds/…`, les utilise encore). CLS et `test_cwv` inchangés.

### v102 — Builds : dérive du générateur bouchée, portraits 3× plus légers (28/09/2026)

**Dérive trouvée** : relancer `generer_builds.mjs` modifiait 728 pages. Seule différence :
le lien « Feedback » du pied de page (PR #26) avait été collé **à la main** dans les
727 pages FR + l'index, pas dans le gabarit. La prochaine régénération (nouvelle arme,
correction de build…) l'aurait retiré sans bruit — exactement le piège 1 de `CLAUDE.md`,
côté builds cette fois. Le lien est maintenant dans `FOOTER` du générateur.
Les pages EN n'ont jamais eu ce lien (PR #26 = FR seulement) : inchangé.

Garde-fou : `node scripts/generer_builds.mjs --verifier` (n'écrit rien, liste les fichiers
qui changeraient), branché dans `verifier_invariants.sh`. **Mis en échec** : 728 fichiers
sur le gabarit d'avant, et de nouveau quand on retire le lien du gabarit.

**Portraits** : l'en-tête des 1 476 pages de builds générées affichait en 132 px (84 px
mobile) un PNG de 512 px. `scripts/generer_vignettes.py` (Pillow) produit
`assets/{frames,weapons,companions}/v/<Nom>.webp` en 264 px (×2 haute densité) :
808 vignettes, 32 Mo de PNG → 11 Mo de WebP ; image d'en-tête moyenne **39 → 13 Ko**
par page. `og:image` reste le PNG (aperçus de partage). Sans vignette, le générateur
retombe sur le PNG. Nouvelle image → `python3 scripts/generer_vignettes.py` puis
`node scripts/generer_builds.mjs`.

**Même vague — cartes de mods** : `assets/wfimg/` (217 images de 256–512 px, affichées en
120 px) passe aussi par `generer_vignettes.py` (plafond 240 px). Une vignette **plus lourde
que l'original est supprimée** et la page garde l'original : les petites icônes PNG de
compétences grossissaient en WebP (page Rhino mesurée 8 → 10 Ko avant cette règle ; 64
vignettes écartées sur 1 025). Pages générées via le gabarit ; les 22 builds ★ faits main
retouchés à la main (légitime : le générateur ne les touche pas), seulement là où une
vignette existe. Mesuré à l'ouverture, mobile : Acceltra 148 → 111 Ko d'images de mods,
Ash Prime EN 70 → 51, Rhino et Mesa inchangés (8 Ko). 0 image absente sur les 1 498 pages.

### v103 — Mise à jour 44 « Iceblade of Narin » intégrée (28/09/2026)

Sortie le 23/09/2026 ; le site en parlait encore au futur (FAQ, guides TennoCon, notes
de builds Banshee/Citrine/Qorvex) et ne connaissait ni Narin, ni Citrine Prime, ni leurs
armes. Source unique : les notes de mise à jour officielles (via le wiki, page « Update 44:
Iceblade of Narin », + hotfix 44.0.1). Rien d'inventé ; ce qui n'est pas dans les notes
n'est pas écrit.

**Catalogues des builds** — `data/warframes.json`, `weapons.json`, `companions.json` n'avaient
**aucun script producteur** (figés au 13/09). Nouveau `scripts/maj_catalogue_wfcd.py` : ajoute
les objets absents depuis WFCD (GitHub, à jour) avec la correspondance de champs des entrées
existantes — vérifiée : 71/117 Warframes et 611/658 armes reproduites à l'identique, le reste
étant des espaces ou de vraies évolutions. Il **ne réécrit pas** l'existant, sauf entrée
nommée (`--rafraichir`). Ajouts : Narin, Citrine Prime ; Nunchasa, Aksondol, Steflos Prime,
Corufell Prime… et **Haalvu** (sortie en juillet, jamais ajoutée). Rafraîchis : Banshee et
Banshee Prime (nouveau passif). Images téléchargées depuis cdn.warframestat.us.
Moas et Hounds (modulaires) n'ont pas de PV dans WFCD : le script ne les voit pas.

**Hydroid** — WFCD, le wiki et le site se contredisent. Seules les valeurs APRÈS changement
des notes officielles sont appliquées : Hydroid 240 boucliers / 365 armure, Prime 290 / 650.
Les PV restent ceux du site (WFCD donne 365/550, le module du wiki 550 pour Prime : non tranché).

**Pages** — 14 pages de builds (7 FR + 7 EN) ; catalogue warframe.market rafraîchi avec le
script du workflow hebdo (bloqué par le quota depuis le 22/09) : 3 837 → 3 892 objets
(pièces Citrine/Steflos/Corufell Prime, 26 reliques, augments…). Guide fait main
`guides/iceblade-de-narin.html` + `en/guides/iceblade-of-narin.html` (gabarit du guide maj 43,
inscrits dans `GUIDES_FAITS_MAIN{,_EN}`). Notes d'actualité (`SLUG_NOTES_MAJ44`) sur Narin,
Citrine Prime et les 4 armes ; notes Banshee/Citrine/Qorvex passées au passé. FAQ FR/EN,
guides TennoCon (encadré + réponse « quand sort »), `llms.txt`.

**Pas fait, et pourquoi** — le simulateur d'arsenal lit `api.warframestat.us`, qui sert encore
les données d'avant la maj 44 (pas de Narin), alors que le GitHub de WFCD est à jour. Recuire
maintenant ne change rien. **À faire quand l'API aura Narin : `npm run arsenal:data`** (les
garde-fous du cuiseur s'appliquent). Le guide le dit aux lecteurs.

### v104 — Audit de couverture + ressources : où, combien, à quelle rareté, quel taux (28/09/2026)

**Audit** (comparaison avec WFCD / wiki, le 28/09) :
| Catégorie | Site | Constat |
|---|---|---|
| Warframes, armes, compagnons | 119 · 663 · 39 | complets après v103 (Moas/Hounds saisis à la main) |
| Arcanes (`/arcanes/`) | 168 | aucune absente de WFCD |
| Mods — pages prix `/o/` | 1 380 | 43 mods échangeables sans page : absents de warframe.market ou nommés autrement (Sonic Siphon/Gaseous Quake y gardent leurs anciens noms, qui ont leur page) — pas de prix, pas de page |
| Mods — simulateur | 605 | sous-ensemble voulu (mods de Warframe/armes simulables) |
| Objets échangeables `/o/` | 3 892 | = catalogue warframe.market du 28/09 |
| **Ressources `/ressources/`** | 241 → **356** | **il manquait ~115 ressources, dont les plus farmées** |

**Le trou des ressources** : la page avait été bâtie sur `Resources.json` de WFCD seul, qui range
Ferrite, Rubedo, Cellule Orokin, Cristal d'Argon, Nitain, Kuva, Vitus, Traces du Néant, fragments
d'Eidolon, Fergolyte, Vosfor… dans `Misc.json`. Référence désormais : le module
`Module:Resources/data` du wiki (Type Resource/Gem/Ore/Plant, moins objets, lentilles, Forma,
syandanas, catégories Helminth, pigments — liste `EXCLUS`).

**Nouveau `scripts/enrichir_ressources.py`** — ajoute par ressource : rareté (wiki, 89),
quantité par ramassage (135), lieux (203, planètes traduites), compatibilité boosters, et les
**meilleures sources avec leur taux officiel** (156 : tables de drop de DE via WFCD, meilleur taux
par lieu, 8 affichées + le total). Piège évité : la liste de drops d'« Eidolon Shard » contient des
« Synthetic Eidolon Shard » — seules les lignes dont l'objet EST la ressource comptent. Les
ressources de base qui tombent des ennemis/conteneurs n'ont pas de taux publié : on affiche
lieux + rareté + quantité, **jamais un pourcentage inventé** (la page le dit).

**Page** : badges rareté/quantité, 📍 lieux, 🎯 meilleur taux, volet « N sources officielles »
(la carte s'étend sur toute la grille une fois dépliée), cartes à 260 px min au lieu de 150.
0 erreur JS, 0 débordement à 320/390/1280. Relancer le script après chaque mise à jour du jeu.
