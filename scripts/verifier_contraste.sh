#!/usr/bin/env bash
# ============================================================================
#  🛡️  GARDE-FOU VoidRelay — contraste AA clair/sombre (bloque une régression
#  déjà vécue : le 09/07/2026, une couleur de texte fixe pensée pour un fond
#  toujours sombre est devenue invisible dès qu'un thème clair a été rendu
#  possible sur ce même composant — 8+ variantes du même bug trouvées lors
#  d'un sweep exhaustif).
#  Calcule le contraste RÉELLEMENT rendu par le navigateur (Playwright), pas
#  les tokens supposés, sur toutes les pages qui chargent css/pandaahh.css,
#  en clair ET en sombre.
#  Usage : bash scripts/verifier_contraste.sh   (depuis n'importe où)
#  Sortie: 0 = 0 échec AA confirmé · 1 = au moins un échec (bloque) · 2 = playwright absent.
#  Dépendance : node + playwright (npx playwright install chromium au besoin).
#  N'est PAS câblé dans sync-main.yml (coût : téléchargement navigateur Chromium
#  ~100 Mo) — à lancer manuellement avant toute publication qui touche au CSS,
#  ou à câbler en CI si le coût est acceptable pour l'équipe.
# ============================================================================
set -uo pipefail
cd "$(dirname "$0")/.."   # racine du repo

if ! node -e "require.resolve('playwright')" >/dev/null 2>&1; then
  echo "❌ playwright introuvable (npm i -D playwright && npx playwright install chromium)"
  exit 2
fi

PORT=8901
BASE="http://localhost:$PORT"
STARTED_SERVER=0

# réutilise un serveur déjà lancé sur ce port (dev en cours), sinon en démarre un temporaire
if ! curl -s -o /dev/null -w "" --max-time 2 "$BASE/index.html" 2>/dev/null; then
  python3 -m http.server "$PORT" >/tmp/vr-contraste-srv.log 2>&1 &
  SRV_PID=$!
  STARTED_SERVER=1
  for i in 1 2 3 4 5 6 7 8; do
    curl -s -o /dev/null --max-time 2 "$BASE/index.html" 2>/dev/null && break
    sleep 1
  done
fi

node scripts/verifier_contraste.mjs "$BASE"
code=$?

if [ "$STARTED_SERVER" -eq 1 ]; then
  kill "$SRV_PID" 2>/dev/null
fi

exit "$code"
