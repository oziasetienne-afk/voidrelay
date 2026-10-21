#!/usr/bin/env bash
# ============================================================================
#  Construit le dossier publié sur voidrelay.fr — par LISTE BLANCHE.
# ----------------------------------------------------------------------------
#  Pourquoi : jusqu'au 21/10/2026 le workflow publiait « . », c'est-à-dire le
#  dépôt ENTIER. Constaté en prod : /CLAUDE.md, /docs/PASSATION.md,
#  /.github/workflows/garde-rendu.yml et /scripts/garde_perso.py répondaient
#  avec leur contenu. Rien de secret (dépôt public), mais du bruit interne servi
#  et indexable sur le domaine du site.
#
#  Liste blanche plutôt que liste noire : un nouveau fichier interne (un .md de
#  passation, un script, un dossier d'outillage) n'est PAS publié tant que
#  personne ne l'ajoute ici. L'oubli inverse — une page du site absente — est
#  attrapé par scripts/verifier_site_publie.mjs (branché dans les invariants).
#
#  Les fonctions Pages (functions/) ne passent PAS par ici : Wrangler les
#  compile depuis le dossier courant, pas depuis le dossier publié.
#
#  Usage : bash scripts/construire_site.sh [dossier]   (défaut : _site)
# ============================================================================
set -euo pipefail
cd "$(dirname "$0")/.."

SORTIE="${1:-_site}"
# Le dossier est vidé avant copie : jamais la racine du dépôt ni au-dessus.
case "$SORTIE" in ""|.|./|..|../*|/) echo "❌ construire_site : sortie refusée : $SORTIE" >&2; exit 1;; esac

# Fichiers de la racine servis tels quels (en plus de tous les *.html racine).
# Le fichier de clé IndexNow DOIT être servi à la racine : son nom est la clé.
CLE_INDEXNOW="$(tr -d '[:space:]' < .indexnow_key).txt"
FICHIERS=(
  _headers _redirects robots.txt sitemap.xml sitemap_index.xml
  manifest.webmanifest sw.js favicon.ico llms.txt "$CLE_INDEXNOW"
)

# Dossiers du site. refs/ (captures de référence), reports/, proxy/ (code d'un
# Worker séparé), docs/, scripts/, tests/, functions/, .github/, .claude/ : NON.
DOSSIERS=(
  .well-known arcanes armes assets builds compagnons css data embed en guides
  images js o ressources skins social voie-du-platine warframes widget
)

# Seulement des fichiers SUIVIS par git : un data/worldstate.json ou un secret
# ignoré qui traîne sur un poste ne part pas avec une construction locale.
# Et dans ces dossiers, seulement des types web : assets/gen_visuels.py vivait
# dans assets/ et partait en prod avec le reste.
EXTENSIONS='html|css|js|json|png|webp|jpg|jpeg|gif|svg|ico|ics|mp4|webm|txt|xml|webmanifest|woff2?'

liste="$(mktemp)"
trap 'rm -f "$liste"' EXIT

for f in "${FICHIERS[@]}"; do
  [ -n "$(git ls-files -- "$f")" ] || { echo "❌ construire_site : fichier attendu absent de git : $f" >&2; exit 1; }
  echo "$f"
done > "$liste"
git -c core.quotepath=off ls-files -- '*.html' | grep -v / >> "$liste"
for d in "${DOSSIERS[@]}"; do
  [ -d "$d" ] || { echo "❌ construire_site : dossier attendu absent : $d" >&2; exit 1; }
  git -c core.quotepath=off ls-files -- "$d" | grep -E "\.(${EXTENSIONS})$" >> "$liste" || true
done

rm -rf "$SORTIE"
mkdir -p "$SORTIE"
tar -cf - -T "$liste" | tar -xf - -C "$SORTIE"
echo "✅ $(wc -l < "$liste") fichiers publiés dans $SORTIE/"
