#!/usr/bin/env bash
# ============================================================================
#  🛡️  GARDE-FOU VoidRelay — invariants du site (bloque un déploiement cassé)
# ----------------------------------------------------------------------------
#  Pourquoi : éviter que des régressions déjà vécues ne reviennent en prod :
#    • 20-06 : l'accueil (app riche SPA) remplacé par une page-portail statique.
#    • cache : service worker bloqué sur une vieille version (coque cache-first).
#  Lancé par sync-main.yml AVANT de pousser sur main → si un invariant est
#  violé, le job échoue, main n'est PAS mis à jour, la prod reste saine, et
#  GitHub envoie un mail d'alerte. Aussi lançable seul (garde-accueil.yml).
#  Usage : bash scripts/verifier_invariants.sh   (depuis la racine du repo)
#  Sortie: 0 = tous les invariants OK · 1 = au moins un violé (bloque).
# ============================================================================
set -uo pipefail
cd "$(dirname "$0")/.."   # racine du repo

err=0
fail(){ echo "❌ $1"; err=1; }
ok(){ echo "✅ $1"; }

# 1) OUTILS PORTÉS (ex-app /warframe, démantelée le 16/07/2026 sur décision de l'admin) +
#    REDIRECTEUR + ACCUEIL WARFRAME. Les outils encore utiles de l'ancienne app vivent
#    comme de vraies pages du site ; /warframe ne fait plus que rediriger les anciens
#    liens (dont les routes #/…) vers elles.
# evaluateur-riven retiré le 16/07/2026 : les API riven de warframe.market ont disparu
# (v1/riven/items 404, v1/riven/attributes 404, v1/auctions/search 400) — outil mort en prod.
for outil in codex.html fonderie.html taches.html calc-reliques.html reliques-ce-soir.html assistant-farm.html; do
  [ -f "$outil" ] || fail "page outil portée absente : $outil"
  grep -q 'js/outil-page.js' "$outil" || fail "$outil : socle js/outil-page.js manquant → outil cassé"
done
# Marché complet (16/07/2026, demande de l'admin « tout le trafic en temps réel ») : page
# autonome (pas le socle SPA) — catalogue items.json + prix live v2/top + flux orders/recent.
[ -f marche-complet.html ] || fail "marche-complet.html absente → tout le marché en direct perdu"
grep -q 'data/items.json' marche-complet.html || fail "marche-complet.html : catalogue items.json non branché"
grep -q 'orders/recent' marche-complet.html || fail "marche-complet.html : flux temps réel orders/recent manquant"
grep -q 'js/api.js' marche-complet.html || fail "marche-complet.html : couche proxy js/api.js manquante"
python3 -c "
import json,sys
d=json.load(open('data/items.json'))
assert len(d)>3000, 'items.json trop court: %d' % len(d)
assert all(k in d[0] for k in ('n','u','i','t')), 'items.json : champs n/u/i/t attendus'
" || fail "data/items.json : catalogue enrichi invalide (champs n/u/i/t)" 
[ -f js/views.js ] || fail "js/views.js absent → les vues des outils portés ont disparu"
[ -f js/outil-page.js ] || fail "js/outil-page.js absent → socle des outils portés manquant"
if [ ! -f warframe.html ]; then
  fail "warframe.html absent → les anciens liens /warframe#/… tomberaient en 404"
else
  grep -q 'warframe-redirect.js' warframe.html || fail "warframe.html : redirecteur js/warframe-redirect.js manquant → anciens liens perdus"
fi
ok "outils portés présents (6 pages + views.js) ; /warframe = redirecteur"
if [ ! -f index.html ]; then
  fail "index.html absent"
else
  grep -qi '<title>' index.html || fail "index.html : <title> manquant"
  grep -q '/outils'   index.html || fail "index.html : lien vers /outils manquant → outils inaccessibles"
  grep -q '/o/'       index.html || fail "index.html : lien vers /o/ (objets) manquant → accueil Warframe incomplet"
  ok "accueil = page d'entrée Warframe"
fi

# 2bis) ACCUEIL ANGLAIS (16/07/2026) : point d'entrée du parcours EN. Sans lui, la nav EN
#       « Home » renvoyait vers l'accueil FRANÇAIS (parcours cassé pour les anglophones).
if [ ! -f en/index.html ]; then
  fail "en/index.html absent → la nav EN « Home » retombe sur l'accueil français"
else
  grep -q 'lang="en"' en/index.html || fail "en/index.html : <html lang=\"en\"> manquant"
  grep -q '/en/builds/' en/index.html || fail "en/index.html : lien vers /en/builds/ manquant"
  grep -q 'hreflang="fr"' en/index.html || fail "en/index.html : hreflang vers l'accueil FR manquant"
  grep -q 'hreflang="en" href="https://voidrelay.fr/en/"' index.html || fail "index.html : hreflang vers l'accueil EN manquant (paire réciproque)"
  # Aucune page EN ne doit renvoyer « Home » vers l'accueil français.
  if grep -rlq '<a href="/">Home</a>' en/ faq-en.html en/price-check.html 2>/dev/null; then
    fail "nav EN : une page renvoie encore « Home » vers / (accueil français) au lieu de /en/"
  fi
  ok "accueil anglais = point d'entrée EN cohérent (nav, hreflang réciproque)"
fi

# 2ter) OUTILS PORTÉS EN (16/07/2026) : coques anglaises des outils reliques. Elles
#       rendent via views.js/i18n.js en imposant la langue par <html data-lang="en">
#       (getLang dans i18n.js). Sans data-lang, elles retomberaient en français.
en_tools_ko=0
for pair in "en/relic-calc.html:renderRelicCalc" "en/relics-tonight.html:renderRelicOptim"; do
  f="${pair%%:*}"; view="${pair##*:}"
  if [ ! -f "$f" ]; then fail "$f absent → outil relique EN perdu"; en_tools_ko=1; continue; fi
  grep -q 'data-lang="en"' "$f" || { fail "$f : <html data-lang=\"en\"> manquant → rendrait en français"; en_tools_ko=1; }
  grep -q "data-view=\"$view\"" "$f" || { fail "$f : data-view=\"$view\" manquant → vue non rendue"; en_tools_ko=1; }
  grep -q 'js/outil-page.js' "$f" || { fail "$f : socle js/outil-page.js manquant"; en_tools_ko=1; }
done
grep -q 'data-lang' js/i18n.js || { fail "js/i18n.js : getLang ne gère plus data-lang → coques EN portées cassées"; en_tools_ko=1; }
[ "$en_tools_ko" -eq 0 ] && ok "outils portés EN (relic-calc, relics-tonight) : data-lang + vue OK"

# 2) SERVICE WORKER = auto-refresh (plus de blocage sur vieille version)
if [ ! -f sw.js ]; then
  fail "sw.js absent"
else
  grep -q 'stale-while-revalidate'        sw.js || fail "sw.js : 'stale-while-revalidate' manquant → risque de blocage sur une vieille version"
  grep -qE 'const CACHE="wf-hub-v[0-9]+"' sw.js || fail "sw.js : version de cache 'wf-hub-vN' manquante"
  [ "$err" -eq 0 ] && ok "service worker auto-refresh présent"
fi

# 3) PAGES CLÉS présentes
for f in hub.html faq.html faq-en.html compagnon.html 404.html; do
  [ -f "$f" ] || fail "page clé manquante : $f"
done

# 4) COQUE (JS/CSS chargés par l'app riche) présente
# js/app.js et js/alerts.js retirés le 16/07/2026 avec le démantèlement de l'app /warframe —
# la coque des outils portés est désormais js/outil-page.js (vérifié plus haut, section 1).
for j in js/data.js js/views.js js/i18n.js js/api.js css/style.css; do
  [ -f "$j" ] || fail "fichier de coque manquant : $j"
done

# 5) DONNÉES de base présentes.
#    Le commentaire d'origine disait « le dashboard a besoin du marché/cycles ».
#    MESURÉ le 05/09/2026 : c'est FAUX, et le garde-fou protégeait donc le mauvais
#    fichier. Le tableau de bord /hub lit data/summary.json — comme /digest, les
#    deux guides Incarnon, le widget d'exemple et js/deals.js, soit six fichiers.
#    data/cycles.json n'est lu par AUCUN d'entre eux (les cycles de /monde viennent
#    de WarframeStat en direct, et /hub recalcule les siens depuis summary.json).
#    summary.json pouvait donc disparaître sans que rien ne crie, en emportant le
#    tableau de bord. Il est désormais gardé ; cycles.json reste vérifié, le
#    contrôle ne coûte rien, mais sans lui prêter un rôle qu'il n'a pas.
for d in data/market.json data/summary.json data/cycles.json; do
  [ -f "$d" ] || fail "donnée de base manquante : $d"
done

# 5bis) BANC D'ESSAI : toute suite présente sur le disque doit être INSCRITE dans
#    tests/e2e/tout_tester.py. Sans ça, une suite existe, passe quand on la lance
#    à la main, et n'est jamais relancée — c'est-à-dire qu'elle ne garde rien.
#    Vécu le 05/09/2026 en répétant les fusions à blanc : sur sept branches, une
#    résolution naïve de conflit (« prendre la version de la branche ») faisait
#    disparaître l'inscription de DEUX suites. Les fichiers restaient sur le
#    disque, plus rien ne les lançait, et aucun test n'échouait pour le dire.
if [ -f tests/e2e/tout_tester.py ]; then
  non_inscrites=""
  for t in tests/e2e/test_*.py; do
    nom=$(basename "$t")
    grep -q "\"$nom\"" tests/e2e/tout_tester.py || non_inscrites="$non_inscrites $nom"
  done
  if [ -n "$non_inscrites" ]; then
    fail "suite(s) e2e présentes mais NON inscrites au banc d'essai (elles ne tournent jamais) :$non_inscrites"
  else
    ok "banc d'essai : les $(ls tests/e2e/test_*.py | wc -l | tr -d ' ') suites du disque sont toutes inscrites"
  fi
fi

# 6) SEO programmatique présent (pages objet + sitemap) — protège l'investissement
[ -f o/index.html ] || fail "annuaire objets o/index.html manquant"
npages=$(ls o/*.html 2>/dev/null | wc -l | tr -d ' ')
[ "${npages:-0}" -ge 100 ] || fail "pages objet trop peu nombreuses (${npages:-0}) → génération cassée ?"
nurls=$(grep -c '<loc>' sitemap.xml 2>/dev/null || echo 0)
[ "${nurls:-0}" -ge 100 ] || fail "sitemap.xml trop court (${nurls:-0} URLs) → régression SEO ?"
[ "$err" -eq 0 ] && ok "SEO programmatique OK (${npages} pages objet, ${nurls} URLs sitemap)"

# 7) GUIDES : aucune page référencée dans le sitemap ne doit être absente du disque.
#    Vécu le 09/07/2026 : scripts/generer_pages_objets.mjs purgeait tout guides/ et
#    en/guides/ avant de ne réécrire que ce qu'il connaît (guides_content.mjs), ce qui
#    supprimait silencieusement les fiches ajoutées à la main (ex. fragments-archontes.html).
#    Corrigé côté générateur (writeDir ne supprime plus de fichier "étranger") ; ce check
#    protège en plus tout déploiement, même si une régression réapparaît ailleurs.
missing_guides=0
for loc in $(grep -oE '<loc>https://voidrelay\.fr/guides/[^<]+' sitemap.xml 2>/dev/null | sed 's#.*/guides/##'); do
  [ -f "guides/$loc.html" ] || { fail "guide référencé dans sitemap.xml mais absent du disque : guides/$loc.html"; missing_guides=1; }
done
for loc in $(grep -oE '<loc>https://voidrelay\.fr/en/guides/[^<]+' sitemap.xml 2>/dev/null | sed 's#.*/en/guides/##'); do
  [ -f "en/guides/$loc.html" ] || { fail "guide EN référencé dans sitemap.xml mais absent du disque : en/guides/$loc.html"; missing_guides=1; }
done
[ -f guides/fragments-archontes.html ] || fail "guides/fragments-archontes.html manquant (fiche écrite à la main, jamais générée)"
[ "$missing_guides" -eq 0 ] && ok "guides : tous les guides du sitemap existent sur le disque"

# 8) DESIGN DES GUIDES : thème « pandaahh » (clair/doré) obligatoire.
#    Vécu le 09/07/2026 : les templates du générateur (guidePage/guidesIndex) étaient
#    restés sur l'ANCIEN design (css/style.css, header .vrtop) alors que les guides en
#    prod utilisent css/pandaahh.css + header .topwrap — une régénération complète
#    (dont le cron hebdo pages-objets.yml) régressait silencieusement les 16 pages
#    guides FR+EN vers l'ancien design. Templates resynchronisés le même jour ; ce
#    check bloque le déploiement si la dérive réapparaît. NB : les pages /o/ utilisent
#    style.css/.vrtop et c'est VOULU — ce check ne s'applique qu'aux guides.
design_ko=0
for f in guides/*.html en/guides/*.html; do
  [ -f "$f" ] || continue
  grep -q 'css/pandaahh\.css' "$f" || { fail "design guides : $f ne charge pas css/pandaahh.css (régression vers l'ancien design ?)"; design_ko=1; }
  grep -q 'class="vrtop"' "$f" && { fail "design guides : $f contient l'ancien header .vrtop"; design_ko=1; }
  grep -q 'css/style\.css' "$f" && { fail "design guides : $f charge css/style.css (réservé aux pages /o/)"; design_ko=1; }
done
grep -q 'href="/guides/fragments-archontes"' guides/index.html 2>/dev/null \
  || { fail "annuaire guides : carte fragments-archontes absente de guides/index.html (guide fait main perdu à la régénération ?)"; design_ko=1; }
[ "$design_ko" -eq 0 ] && ok "design guides : pandaahh.css partout, ancien design absent, carte fragments-archontes présente"

# 9) ACCESSIBILITÉ/INTÉGRITÉ statique de TOUTES les pages (16/07/2026) : img sans alt,
#    ids en double, aria-* orphelins, h1/title/description, liens et boutons sans nom
#    accessible. État de référence : 5 669 pages, zéro violation (~11 s). Les exceptions
#    par conception sont documentées dans scripts/verifier_a11y.py.
if python3 scripts/verifier_a11y.py; then
  ok "accessibilité : toutes les pages passent (alt, ids, aria, h1, title, description)"
else
  fail "accessibilité : violations détectées (détail ci-dessus) — voir scripts/verifier_a11y.py"
fi

# 10) PACK « NAVIGATION INSTANTANÉE & ORIENTATION » (16/07/2026) : warp.js (préchargement
#     au survol), actions ⌘K (thème/langue) dans search.js, index de pages EN, thème +
#     « vous êtes ici » sur la famille vrtop (4 000+ pages /o/), transitions de vue sur les
#     3 familles CSS, barre de lecture des guides. Une régénération qui perdrait un de ces
#     morceaux (même piège que le design des guides, section 8) échoue ici.
pack_ko=0
[ -f js/warp.js ] || { fail "pack : js/warp.js absent"; pack_ko=1; }
python3 -c "import json,sys; d=json.load(open('data/en_pages_index.json')); sys.exit(0 if len(d)>=25 else 1)" 2>/dev/null \
  || { fail "pack : data/en_pages_index.json absent ou trop court (>=25 entrées attendues)"; pack_ko=1; }
grep -q 'en_pages_index.json' js/search.js || { fail "pack : search.js ne charge plus l'index de pages EN"; pack_ko=1; }
grep -q 'data-act' js/search.js || { fail "pack : actions ⌘K (data-act) absentes de search.js"; pack_ko=1; }
o_ref="o/arcane_energize.html"
grep -q 'vr-theme' "$o_ref" || { fail "pack : boot du thème absent des pages /o/ (régénération sans THEME_BOOT ?)"; pack_ko=1; }
grep -q 'id="themebtn"' "$o_ref" || { fail "pack : bouton thème absent des pages /o/"; pack_ko=1; }
grep -q '<a href="/o/" class="cur">' "$o_ref" || { fail "pack : état actif vrnav absent des pages /o/"; pack_ko=1; }
grep -q '/js/warp.js' "$o_ref" || { fail "pack : warp.js non inclus sur les pages /o/"; pack_ko=1; }
grep -q '<a href="/en/o/" class="cur">' "en/o/arcane_energize.html" || { fail "pack : état actif vrnav absent des pages /en/o/"; pack_ko=1; }
for css in css/pandaahh.css css/style.css css/hub.css; do
  grep -q '@view-transition' "$css" || { fail "pack : @view-transition absent de $css"; pack_ko=1; }
done
grep -q 'vr-lecture' css/pandaahh.css || { fail "pack : barre de lecture des guides absente de pandaahh.css"; pack_ko=1; }
grep -q '\.vrnav a\.cur' css/style.css || { fail "pack : style .vrnav a.cur absent de style.css"; pack_ko=1; }
[ "$pack_ko" -eq 0 ] && ok "pack navigation instantanée & orientation : warp.js, actions ⌘K, index EN, thème/cur /o/, transitions, barre de lecture"

# 11) SIMULATEUR D'ARSENAL (16/07/2026) : la page /arsenal et ses données cuites
#     (data/arsenal/, script generer_arsenal_data.mjs). Données = instantané WFCD ;
#     un déploiement qui perdrait un fichier ou viderait un JSON échoue ici.
ars_ko=0
[ -f arsenal.html ] || { fail "arsenal : arsenal.html absent"; ars_ko=1; }
[ -f js/arsenal.js ] || { fail "arsenal : js/arsenal.js absent"; ars_ko=1; }
grep -q '/js/arsenal.js' arsenal.html || { fail "arsenal : arsenal.html ne charge plus js/arsenal.js"; ars_ko=1; }
python3 -c "
import json,sys
w=json.load(open('data/arsenal/warframes.json')); a=json.load(open('data/arsenal/armes.json'))
m=json.load(open('data/arsenal/mods.json')); c=json.load(open('data/arsenal/compagnons.json'))
p=json.load(open('data/arsenal/postures.json'))
# v48 : postures = classe d'arme + combos (module de données du wiki officiel)
# 03/09/2026 : PIÈGE de la chaîne de données. generer_arsenal_data.mjs réécrit
# warframes.json de zéro et fait disparaître abilities[].st (stats par capacité,
# lues sur le wiki par enrichir_stats_capacites.mjs). Sans la seconde étape, le
# panneau « stats des pouvoirs » se vide EN SILENCE — vécu deux fois le même
# jour. Ce garde-fou le détecte au lieu de compter sur une note du handoff.
avec_st=sum(1 for f in w if any(ab.get('st') for ab in f.get('abilities',[])))
sys.exit(0 if len(w)>=100 and len(a['Primary'])>=150 and len(m)>=400 and len(c['compagnons'])>=20
         and len(p)>=50 and sum(1 for x in a['Melee'] if x.get('stc'))>=200
         and avec_st>=100 else 1)" 2>/dev/null \
  || { fail "arsenal : data/arsenal/*.json absent, anormalement court, ou stats de pouvoirs perdues (relance : npm run arsenal:data)"; ars_ko=1; }
# v100 : MODS FANTÔMES. Les fichiers du jeu doublent 71 mods ordinaires sous /Expert/
# (Intensify +55 %, True Steel +220 %…) : inobtenables, mais le simulateur les
# proposait sous le nom « … Prime » et le build auto pouvait les choisir. Un /Expert/
# sans « Primed » en anglais qui a un jumeau ordinaire = fantôme ; « Prime » dans le
# nom français sans « Primed » en anglais = étiquette inventée (Acier Galvanisé Prime).
python3 -c "
import json,sys
m=json.load(open('data/arsenal/mods.json'))
ordi={x.get('en') for x in m if '/Expert/' not in x['un']}
fant=[x['en'] for x in m if '/Expert/' in x['un'] and x.get('en') and not x['en'].startswith('Primed ') and x['en'] in ordi]
fauxp=[x['n'] for x in m if '/Expert/' in x['un'] and x['n'].endswith(' Prime') and not (x.get('en') or '').startswith('Primed ')]
print('fantomes', fant[:5], 'faux Prime', fauxp[:5]) if fant or fauxp else None
sys.exit(1 if fant or fauxp else 0)" \
  || { fail "arsenal : mods fantômes /Expert/ ou faux « Prime » dans data/arsenal/mods.json (voir HANDOFF v100)"; ars_ko=1; }
grep -q '"/arsenal"' data/pages_index.json || { fail "arsenal : absent de l'index de recherche"; ars_ko=1; }
grep -q 'voidrelay.fr/arsenal' sitemap.xml || { fail "arsenal : absent du sitemap"; ars_ko=1; }
python3 -c "import json,sys; d=json.load(open('data/arsenal_builds.json')); sys.exit(0 if len(d)>=600 else 1)" 2>/dev/null \
  || { fail "arsenal : data/arsenal_builds.json absent ou trop court (>=600 builds attendus)"; ars_ko=1; }
# v20 : build auto + langue globale + piliers d'accueil.
grep -q 'id="ars-auto"' arsenal.html && grep -q 'id="ars-auto"' en/arsenal.html \
  || { fail "arsenal : bouton Build auto absent d'une des deux pages"; ars_ko=1; }
grep -q 'OBJECTIFS' js/arsenal.js || { fail "arsenal : module build auto (OBJECTIFS) absent du moteur"; ars_ko=1; }
grep -q 'Module LANGUE' js/warp.js && grep -q 'langbtn' js/warp.js \
  || { fail "langue : module langue/bouton absent de warp.js"; ars_ko=1; }
grep -q 'id="piliers"' index.html && grep -q 'id="pillars"' en/index.html \
  || { fail "accueil : section des 3 piliers absente (FR ou EN)"; ars_ko=1; }
# v18 : arcanes d'armes — >=30 entrées, et les 6 simulables (Merciless/Deadhead/Dexterity ×2) parsées.
python3 -c "
import json,sys
a=json.load(open('data/arsenal/arcanes_armes.json'))
sim=[x for x in a if x.get('fx')]
sys.exit(0 if len(a)>=30 and len(sim)>=6 and all(abs(x['fx'].get('dmg',0)-3.6)<1e-9 for x in sim) else 1)" 2>/dev/null \
  || { fail "arsenal : arcanes_armes.json absent/court ou fx faux (6 simulables à +360 % attendues)"; ars_ko=1; }
grep -q 'simbtn' builds/chroma-prime.html || { fail "arsenal : bouton « Simuler » absent des pages builds (régénération sans sim ?)"; ars_ko=1; }
# v17 : version anglaise — page jumelle, hreflang croisés, moteur bilingue, maillage EN.
[ -f en/arsenal.html ] || { fail "arsenal EN : en/arsenal.html absent"; ars_ko=1; }
grep -q '<html lang="en"' en/arsenal.html || { fail "arsenal EN : lang != en"; ars_ko=1; }
grep -q 'hreflang="fr" href="https://voidrelay.fr/arsenal"' en/arsenal.html || { fail "arsenal EN : hreflang fr manquant"; ars_ko=1; }
grep -q 'hreflang="en" href="https://voidrelay.fr/en/arsenal"' arsenal.html || { fail "arsenal : hreflang en manquant côté FR"; ars_ko=1; }
grep -q 'EST_EN' js/arsenal.js || { fail "arsenal : moteur bilingue (EST_EN) disparu de js/arsenal.js"; ars_ko=1; }
grep -q 'voidrelay.fr/en/arsenal' sitemap.xml || { fail "arsenal EN : absent du sitemap"; ars_ko=1; }
grep -q '"/en/arsenal"' data/en_pages_index.json || { fail "arsenal EN : absent de l'index de recherche EN"; ars_ko=1; }
grep -q '/en/arsenal?sim=' en/builds/chroma-prime.html || { fail "arsenal EN : bouton « Simulate » ne pointe pas vers /en/arsenal"; ars_ko=1; }
[ "$ars_ko" -eq 0 ] && ok "simulateur d'arsenal : page FR + EN, moteur bilingue, données (120 warframes / 611 armes / 588 mods) et maillage en place"

# LA FRAÎCHEUR ANNONCÉE EST CELLE QUI EST DEMANDÉE (05/09/2026). Le site
# promettait au visiteur des données « toutes les 2 h » — sur les deux accueils,
# sur /marche, dans les pieds de page — alors que le cron du workflow demande
# toutes les 4 h, et que GitHub, qui retarde librement les tâches planifiées des
# dépôts publics, a livré 3,4 h / 6,2 h / 6,3 h / 8,2 h sur les quatre derniers
# passages. Une promesse deux fois trop belle que rien ne rattachait à la
# réalité. Même motif que le « Quinze outils » de v75 : un nombre affiché doit
# être dérivé de sa source, pas recopié.
# 27/09/2026 : cadence passée à 1×/jour (cron « M H * * * » → 24 h). Le motif accepte
# aussi « &nbsp; » et « heures » : « toutes les 2&nbsp;heures » (Voie du platine)
# échappait au garde-fou depuis v80 — mis en échec sur ce texte avant correction.
CRON_LIGNE=$(grep -oE 'cron: *"[^"]+"' .github/workflows/warframe-hub-update.yml | head -1)
if echo "$CRON_LIGNE" | grep -qE '"[0-9]+ \*/[0-9]+ '; then
  CRON=$(echo "$CRON_LIGNE" | grep -oE '\*/[0-9]+' | tr -d '*/')
elif echo "$CRON_LIGNE" | grep -qE '"[0-9]+ [0-9]+ \* \* \*"'; then
  CRON=24
else
  CRON=""
fi
MOTIF_CADENCE="toutes les [0-9]+( |&nbsp;)?h|every [0-9]+ ?h(ours)?"
if [ -z "$CRON" ]; then
  fail "cadence : le cron de warframe-hub-update.yml n'est plus lisible (format changé ?)"
else
  MAUVAIS=$(grep -rlnoE "$MOTIF_CADENCE" --include=*.html . 2>/dev/null \
    | grep -v node_modules \
    | xargs -r grep -ohE "$MOTIF_CADENCE" \
    | grep -oE "[0-9]+" | sort -u | grep -v "^${CRON}$" || true)
  if [ -n "$MAUVAIS" ]; then
    fail "cadence annoncée ≠ cron : le site promet $(echo "$MAUVAIS" | tr '\n' '/' )h alors que le workflow tourne toutes les ${CRON}h"
  else
    ok "fraîcheur annoncée = cadence réellement demandée (${CRON} h, dérivée du cron)"
  fi
fi

# ---------------------------------------------------------------------------
# Les garde-fous « purs » : ni navigateur, ni réseau, quelques secondes chacun.
# Ils vivaient à côté de la CI et ne tournaient donc que quand quelqu'un y
# pensait — c'est-à-dire jamais. Les brancher ici les fait tourner à CHAQUE
# push, ce qui est la seule chose qui distingue un garde-fou d'un fichier de
# tests. Ils couvrent des calculs dont l'erreur ne casse aucune page : un mot de
# passe synchronisé par mégarde, une marge de 660 platine qui n'existe pas, un
# set dont on oublie qu'il demande deux canons.
pur_ko=0
for g in verifier_sync.mjs verifier_api_builds.mjs verifier_api_evt.mjs verifier_profils.mjs verifier_prix_rangs_client.mjs verifier_prix_objet.mjs verifier_cartes_partage.mjs verifier_liens_internes.mjs verifier_site_publie.mjs verifier_fil_ariane.mjs verifier_outils_declares.mjs verifier_arsenal_wiki.mjs; do
  [ -f "scripts/$g" ] || continue
  node "scripts/$g" >/dev/null 2>&1 || { fail "garde-fou $g : au moins une vérification échoue (relance-le pour le détail)"; pur_ko=1; }
done
# Le garde perso lui-même (20/10/2026) : la fusion web de la PR #1 l'a rougi sans fuite
# (committer « GitHub <noreply@github.com> »). Vrais commits dans un dépôt jetable.
if [ -f scripts/verifier_garde_perso.py ]; then
  python3 scripts/verifier_garde_perso.py >/dev/null 2>&1 \
    || { fail "garde-fou verifier_garde_perso.py : le garde perso bloque une fusion GitHub ou laisse passer une adresse perso"; pur_ko=1; }
fi
if [ -f scripts/verifier_prix_rangs.py ]; then
  python3 scripts/verifier_prix_rangs.py >/dev/null 2>&1 \
    || { fail "garde-fou verifier_prix_rangs.py : le calcul de prix ne tient plus (rangs mélangés ?)"; pur_ko=1; }
fi
# Celui-ci travaille sur les DONNÉES, pas sur du code : il attrape le jour où
# la série de prix et le prix courant cessent de décrire le même objet — ce qui
# arrive dès qu'on change le rang retenu sans réaligner l'historique.
if [ -f scripts/verifier_historique_coherent.py ]; then
  python3 scripts/verifier_historique_coherent.py >/dev/null 2>&1 \
    || { fail "garde-fou historique : la série et le prix courant divergent (rang changé sans réparation ? relance scripts/reparer_historique_rangs.py)"; pur_ko=1; }
fi
# Le générateur de pages et ce qu'il a produit peuvent forker en silence : le
# garde-fou de dérive interne ne parle qu'au moment d'une génération, et une
# génération devenue impossible (4120 fichiers retouchés à la main) ne parle
# plus du tout. --verifier recalcule les 4130 artefacts et les compare au
# disque en 2 s, sans rien écrire.
if [ -f scripts/generer_pages_objets.mjs ]; then
  node scripts/generer_pages_objets.mjs --verifier >/dev/null 2>&1 \
    || { fail "garde-fou générateur : les pages/sitemap/index sur le disque ne correspondent plus au gabarit (node scripts/generer_pages_objets.mjs --verifier pour le détail)"; pur_ko=1; }
fi
# Même dérive côté builds (28/09/2026) : le lien « Feedback » avait été collé à la main
# dans 727 pages de builds FR, pas dans generer_builds.mjs. Mis en échec : 728 fichiers.
if [ -f scripts/generer_builds.mjs ]; then
  node scripts/generer_builds.mjs --verifier >/dev/null 2>&1 \
    || { fail "garde-fou générateur de builds : builds/ ou en/builds/ ne correspondent plus au gabarit (node scripts/generer_builds.mjs --verifier pour le détail)"; pur_ko=1; }
fi
# Passifs troués (20/10/2026) : les marqueurs |VAL| de WFCD étaient effacés au lieu d'être
# résolus → « sidearms % faster », « within a m radius » dans 168 pages de builds, sans
# qu'aucun garde-fou ne bouge. Mis en échec sur l'état d'avant : 115 pages détectées (filet
# textuel, il ne voit pas tous les trous ; la vraie correction est en amont).
passifs_troues=$(python3 - <<'PY'
import glob, re
mauvais = re.compile(r"\|[A-Z_0-9]+\||(^|[\s+(x])%|\bwithin a m\b|\s th\b|\s{2,}|\s[.,]|\\[rnt]")
n = 0
for f in glob.glob("builds/*.html") + glob.glob("en/builds/*.html"):
    for t in re.findall(r'class="passive"><b>[^<]*</b>\s*([^<]*)</p>', open(f, encoding="utf-8").read()):
        if mauvais.search(t.strip()):
            n += 1
            break
print(n)
PY
)
[ "$passifs_troues" = "0" ] || { fail "passifs de Warframes troués dans $passifs_troues page(s) de builds (chiffres manquants : relance scripts/maj_passifs_wiki.py puis generer_builds.mjs --force)"; pur_ko=1; }
[ "$pur_ko" -eq 0 ] && ok "garde-fous de calcul : synchro, API builds, classements de marché, prix par rang, gabarit des pages générées (objets et builds), cartes de partage, liens internes, fil d'Ariane, outils déclarés, stats et textes wiki de l'arsenal"

# ÂGE DES DONNÉES (27/09/2026) — AVERTISSEMENT, jamais bloquant. Du 22 au 27/09 les
# prix sont restés figés 5 jours (quota Actions : 30+ runs sans runner) et TOUT ici
# passait au vert : aucun contrôle ne regardait l'âge des données. Non bloquant exprès :
# pendant un gel, bloquer le déploiement empêcherait justement de corriger.
# Seuil 26 h = cadence 1×/jour + 2 h de retard toléré des crons GitHub.
AGE_H=$(python3 - <<'PY' 2>/dev/null
import json,datetime
t=json.load(open("data/last_update.json"))["updated_utc"]
d=datetime.datetime.strptime(t,"%Y-%m-%dT%H:%M:%SZ")
print(int((datetime.datetime.utcnow()-d).total_seconds()//3600))
PY
)
if [ -n "$AGE_H" ] && [ "$AGE_H" -gt 26 ]; then
  echo "⚠️  données vieilles de ${AGE_H} h (data/last_update.json) : la mise à jour quotidienne est bloquée ? Regarder les runs de warframe-hub-update.yml (runner_id 0 = quota). Non bloquant."
fi

echo "----------------------------------------------------------------------"
if [ "$err" -ne 0 ]; then
  echo "💥 GARDE-FOU : invariants VIOLÉS — déploiement BLOQUÉ (prod protégée)."
  exit 1
fi
echo "🛡️  GARDE-FOU : tous les invariants OK — déploiement autorisé."
exit 0
