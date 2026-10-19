#!/usr/bin/env bash
# ============================================================================
#  🛡️  GARDE-FOU VoidRelay — débordement horizontal desktop/mobile (bloque
#  une régression déjà vécue : le 09/07/2026, .foot .links — enfant flex sans
#  min-width:0 — faisait déborder 12 pages de 21 à 180px en mobile, scroll
#  horizontal invisible en desktop, cassé partout en dessous de ~420px).
#  Calcule document.documentElement.scrollWidth vs innerWidth RÉELLEMENT rendu
#  (Playwright), pas la mise en page supposée, sur toutes les pages du site
#  (3 systèmes CSS), en desktop ET mobile.
#  Usage : bash scripts/verifier_overflow.sh   (depuis n'importe où)
#  Sortie: 0 = 0 débordement confirmé · 1 = au moins un (bloque) · 2 = playwright absent.
#  Dépendance : node + playwright (même setup que verifier_contraste.sh).
#  N'est PAS câblé seul dans sync-main.yml — voir .github/workflows/
#  garde-contraste.yml qui lance aussi ce script (même cache Chromium,
#  pas de coût supplémentaire).
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

if ! curl -s -o /dev/null -w "" --max-time 2 "$BASE/index.html" 2>/dev/null; then
  python3 -m http.server "$PORT" >/tmp/vr-overflow-srv.log 2>&1 &
  SRV_PID=$!
  STARTED_SERVER=1
  for i in 1 2 3 4 5 6 7 8; do
    curl -s -o /dev/null --max-time 2 "$BASE/index.html" 2>/dev/null && break
    sleep 1
  done
fi

node scripts/verifier_overflow.mjs "$BASE"
code=$?

if [ "$STARTED_SERVER" -eq 1 ]; then
  kill "$SRV_PID" 2>/dev/null
fi

exit "$code"
