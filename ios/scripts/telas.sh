#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
DESTINO=${1:-platform=iOS Simulator,name=iPhone 18 Pro}
VAZIO=${2:-}
SAIDA=build/telas${VAZIO:+-vazio}
pkill -f build/servidor.cjs || true
if [ -n "$VAZIO" ]; then export AURI_VAZIO=1 TEST_RUNNER_AURI_VAZIO=1; else export AURI_AVISO=1; fi
node scripts/servidor.mjs 47391 > build/servidor.log 2>&1 &
SERVIDOR=$!
trap 'kill $SERVIDOR 2>/dev/null || true; pkill -f build/servidor.cjs || true' EXIT
until grep -q '^convite ' build/servidor.log 2>/dev/null; do sleep 1; done
CONVITE=$(grep '^convite ' build/servidor.log | sed 's/^convite //')
xcrun simctl uninstall booted com.auri.ios 2>/dev/null || true
xcrun simctl spawn booted notifyutil -s com.apple.BiometricKit.enrollmentChanged 1
xcrun simctl spawn booted notifyutil -p com.apple.BiometricKit.enrollmentChanged
rm -rf build/resultado.xcresult "$SAIDA"
TEST_RUNNER_AURI_QR="$CONVITE" xcodebuild test -project Auri.xcodeproj -scheme Auri \
  -destination "$DESTINO" -derivedDataPath build/xcode -resultBundlePath build/resultado.xcresult \
  -collect-test-diagnostics never > build/teste.log 2>&1 || STATUS=$?
grep -E "error:|passed|failed|skipped" build/teste.log || true
xcrun xcresulttool export attachments --path build/resultado.xcresult --output-path "$SAIDA" > /dev/null
SAIDA="$SAIDA" node -e '
const fs = require("fs")
const saida = process.env.SAIDA
for (const teste of JSON.parse(fs.readFileSync(`${saida}/manifest.json`))) {
  for (const anexo of teste.attachments ?? []) {
    const nome = anexo.suggestedHumanReadableName.split("_")[0]
    if (/^\d/.test(nome)) fs.renameSync(`${saida}/${anexo.exportedFileName}`, `${saida}/${nome}.png`)
  }
}'
ls "$SAIDA" | grep '^[0-9]'
exit ${STATUS:-0}
