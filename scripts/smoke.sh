#!/usr/bin/env bash
# Test dymny kiosku: headless Chrome odtwarza wszystkie scenariusze (?test=1, tempo 4×) i wypisuje wynik z data-test.
# Użycie: scripts/smoke.sh [chrome-binary]   (wymaga python3 i Chrome/Chromium; bez sieci - fonty i ikony są lokalne)
set -euo pipefail
cd "$(dirname "$0")/.."
CHROME="${1:-$(command -v google-chrome || command -v chromium || command -v chromium-browser)}"
PORT=8766
python3 -m http.server "$PORT" --bind 127.0.0.1 >/dev/null 2>&1 & SRV=$!
trap 'kill $SRV 2>/dev/null || true' EXIT
sleep 0.7
# 21 scenariuszy × ~4,2 s przy 4× = ~90 s czasu wirtualnego (timery Chrome idą w czasie wirtualnym; rAF nie, dlatego ticker testu używa setTimeout)
DOM=$("$CHROME" --headless=new --disable-gpu --no-sandbox --window-size=1920,1080 --virtual-time-budget=140000 --dump-dom "http://127.0.0.1:$PORT/index.html?test=1" 2>/dev/null)
RESULT=$(printf '%s' "$DOM" | grep -o 'data-test="[^"]*"' | head -1 || true)
echo "${RESULT:-data-test not found (page did not initialise)}"
case "$RESULT" in *'data-test="ok:'*) exit 0;; *) exit 1;; esac
