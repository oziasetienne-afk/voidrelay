#!/usr/bin/env bash
# ============================================================================
#  🛡️  GARDE-FOU VoidRelay — cibles tactiles (bloque une régression déjà
#  vécue : le 10/07/2026, mesure réelle sur mobile (bounding box) a trouvé un
#  bouton favori à 21x21px puis 5 composants nav/footer partagés sous 24x24px
#  — le minimum WCAG 2.5.8. Jamais formalisé en garde-fou avant ce jour).
#  Mesure la taille RÉELLEMENT rendue (Playwright, mobile 390px) des liens
#  nav/header/footer et de tout contrôle interactif (bouton, champ…), site entier.
#  Usage : bash scripts/verifier_cibles_tactiles.sh   (depuis n'importe où)
#  Sortie: 0 = 0 échec confirmé · 1 = au moins un échec (bloque) · 2 = playwright absent.
#  Dépendance : node + playwright (voir scripts/verifier_contraste.sh, même setup).
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
  python3 -m http.server "$PORT" >/tmp/vr-cibles-srv.log 2>&1 &
  SRV_PID=$!
  STARTED_SERVER=1
  for i in 1 2 3 4 5 6 7 8; do
    curl -s -o /dev/null --max-time 2 "$BASE/index.html" 2>/dev/null && break
    sleep 1
  done
fi

node scripts/verifier_cibles_tactiles.mjs "$BASE"
code=$?

if [ "$STARTED_SERVER" -eq 1 ]; then
  kill "$SRV_PID" 2>/dev/null
fi

exit "$code"
