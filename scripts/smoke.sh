#!/usr/bin/env bash
# Test dymny kiosku: headless Chrome odtwarza wszystkie scenariusze (?test=1, tempo 4×) i wypisuje wynik z data-test.
# Użycie: scripts/smoke.sh [chrome-binary]   (wymaga python3 i Chrome/Chromium; bez sieci - fonty i ikony są lokalne)
set -euo pipefail
cd "$(dirname "$0")/.."
CHROME="${1:-$(command -v google-chrome || command -v chromium || command -v chromium-browser || true)}"
if [ -z "$CHROME" ]; then echo "smoke: nie znaleziono Chrome/Chromium (podaj ścieżkę jako argument)" >&2; exit 2; fi
PORT=8766
if curl -sf "http://127.0.0.1:$PORT/" >/dev/null 2>&1; then echo "smoke: port $PORT jest już zajęty (stary serwer?) - test odpytałby cudze drzewo" >&2; exit 2; fi
python3 -m http.server "$PORT" --bind 127.0.0.1 >/dev/null 2>&1 & SRV=$!
trap 'kill $SRV 2>/dev/null || true' EXIT
for i in 1 2 3 4 5 6 7 8 9 10; do curl -sf "http://127.0.0.1:$PORT/kiosk-core.js" >/dev/null 2>&1 && break; sleep 0.3; done
# serwer podaje ten checkout? (nagłówek kiosk-core.js musi zgadzać się z plikiem lokalnym)
if ! cmp -s <(curl -sf "http://127.0.0.1:$PORT/kiosk-core.js" | head -c 300) <(head -c 300 kiosk-core.js); then echo "smoke: serwer na porcie $PORT nie podaje tego katalogu" >&2; exit 2; fi
# 21 scenariuszy × ~4,2 s przy 4× = ~90 s czasu wirtualnego (timery Chrome idą w czasie wirtualnym; rAF nie, dlatego ticker testu używa setTimeout)
DOM=$("$CHROME" --headless=new --disable-gpu --no-sandbox --window-size=1920,1080 --virtual-time-budget=140000 --dump-dom "http://127.0.0.1:$PORT/index.html?test=1" 2>/dev/null)
RESULT=$(printf '%s' "$DOM" | grep -o 'data-test="[^"]*"' | head -1 || true)
echo "${RESULT:-data-test not found (page did not initialise)}"
case "$RESULT" in *'data-test="ok:'*) exit 0;; *) exit 1;; esac
