#!/usr/bin/env bash
# ============================================================================
#  🛡️  GARDE-FOU VoidRelay — CLS / Cumulative Layout Shift (bloque une
#  régression déjà vécue : swap de police web sur 65 pages puis sections
#  JS-remplies sans espace réservé sur hub.html/marche.html, CLS jusqu'à
#  1.03. Mesure la médiane de 3 essais réels — un pic isolé de bruit pub ne
#  fait pas échouer, un vrai bug de layout, constant, si).
#  Usage : bash scripts/verifier_cls.sh   (depuis n'importe où)
#  Sortie: 0 = 0 échec confirmé · 1 = au moins un échec (bloque) · 2 = playwright absent.
#  Dépendance : node + playwright (voir scripts/verifier_contraste.sh, même setup).
#  Plus lent que les autres garde-fous (mesure CLS = attente réelle par page,
#  répétée 3×) — échantillon volontairement réduit, voir l'en-tête de
#  verifier_cls.mjs pour la justification.
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
  python3 -m http.server "$PORT" >/tmp/vr-cls-srv.log 2>&1 &
  SRV_PID=$!
  STARTED_SERVER=1
  for i in 1 2 3 4 5 6 7 8; do
    curl -s -o /dev/null --max-time 2 "$BASE/index.html" 2>/dev/null && break
    sleep 1
  done
fi

node scripts/verifier_cls.mjs "$BASE"
code=$?

if [ "$STARTED_SERVER" -eq 1 ]; then
  kill "$SRV_PID" 2>/dev/null
fi

exit "$code"
