#!/usr/bin/env bash
# ============================================================================
#  🛡️  GARDE-FOU VoidRelay — exceptions JavaScript.
#  Les quatre garde-fous de rendu chargent déjà chaque page dans un vrai
#  navigateur, mais chacun ne regarde QUE sa mesure : une exception JS non
#  rattrapée les laisse tous verts (la page s'affiche, sa mise en page est
#  bonne… et ses fonctions ne marchent plus). Celui-ci écoute `pageerror` et
#  les 404 sur des fichiers DU SITE. Ce qui vient de l'extérieur (polices,
#  publicité, warframestat, warframe.market) est ignoré : c'est un fait du
#  réseau, pas un défaut du site.
#  Usage : bash scripts/verifier_exceptions_js.sh   (depuis n'importe où)
#  Sortie: 0 = aucune page fautive · 1 = au moins une (bloque) · 2 = playwright absent.
#  Dépendance : node + playwright (même setup que verifier_overflow.sh).
# ============================================================================
set -uo pipefail
cd "$(dirname "$0")/.."   # racine du repo

if ! node -e "require.resolve('playwright')" >/dev/null 2>&1; then
  echo "❌ playwright introuvable (npm i -D playwright && npx playwright install chromium)"
  exit 2
fi

PORT=8903
BASE="http://localhost:$PORT"
STARTED_SERVER=0

if ! curl -s -o /dev/null -w "" --max-time 2 "$BASE/index.html" 2>/dev/null; then
  python3 -m http.server "$PORT" >/tmp/vr-exceptions-srv.log 2>&1 &
  SRV_PID=$!
  STARTED_SERVER=1
  for i in 1 2 3 4 5 6 7 8; do
    curl -s -o /dev/null --max-time 2 "$BASE/index.html" 2>/dev/null && break
    sleep 1
  done
fi

node scripts/verifier_exceptions_js.mjs "$BASE"
code=$?

if [ "$STARTED_SERVER" -eq 1 ]; then
  kill "$SRV_PID" 2>/dev/null
fi

exit "$code"
