#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
DESTINO=${1:-$(node scripts/simulador.mjs)}
xcodebuild test -project Auri.xcodeproj -scheme Auri -destination "$DESTINO" \
  -derivedDataPath build/xcode -only-testing:AuriTests -collect-test-diagnostics never \
  > build/testes-swift.log 2>&1 || STATUS=$?
grep -E "error:|Executed|TEST (SUCCEEDED|FAILED)" build/testes-swift.log | sort -u
exit ${STATUS:-0}
