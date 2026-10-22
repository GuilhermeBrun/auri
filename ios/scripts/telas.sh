#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
DESTINO=${1:-$(node scripts/simulador.mjs)}
APARELHO=${DESTINO##*id=}
VAZIO=${2:-}
SAIDA=build/telas${VAZIO:+-vazio}
mkdir -p build
pkill -f build/servidor.cjs || true

node scripts/dht.mjs > build/dht.log 2>&1 &
DHT=$!
until grep -q '^bootstrap ' build/dht.log 2>/dev/null; do sleep 1; done
BOOTSTRAP=$(sed -n 's/^bootstrap //p' build/dht.log)
export AURI_BOOTSTRAP="$BOOTSTRAP" TEST_RUNNER_AURI_BOOTSTRAP="$BOOTSTRAP"

if [ -n "$VAZIO" ]; then export AURI_VAZIO=1 TEST_RUNNER_AURI_VAZIO=1; else export AURI_AVISO=1; fi
node scripts/servidor.mjs 47391 > build/servidor.log 2>&1 &
SERVIDOR=$!
trap 'kill $SERVIDOR $DHT ${ROSTO:-} 2>/dev/null || true; pkill -f build/servidor.cjs || true' EXIT
until grep -q '^convite ' build/servidor.log 2>/dev/null; do sleep 1; done
CONVITE=$(grep '^convite ' build/servidor.log | sed 's/^convite //')

xcrun simctl uninstall "$APARELHO" com.auri.ios 2>/dev/null || true
xcrun simctl spawn "$APARELHO" notifyutil -s com.apple.BiometricKit.enrollmentChanged 1
xcrun simctl spawn "$APARELHO" notifyutil -p com.apple.BiometricKit.enrollmentChanged
rm -rf build/resultado.xcresult "$SAIDA"
(
  until grep -q "rosto: ligar" build/teste.log 2>/dev/null; do sleep 1; done
  while true; do
    xcrun simctl spawn "$APARELHO" notifyutil -p com.apple.BiometricKit_Sim.pearl.match > /dev/null 2>&1
    sleep 2
  done
) &
ROSTO=$!
TEST_RUNNER_AURI_QR="$CONVITE" xcodebuild test -project Auri.xcodeproj -scheme Auri \
  -destination "$DESTINO" -derivedDataPath build/xcode -resultBundlePath build/resultado.xcresult \
  ${SO_TESTES:--only-testing:AuriUITests} -collect-test-diagnostics never ${COBERTURA:+-enableCodeCoverage YES} > build/teste.log 2>&1 || STATUS=$?
grep -E "error:|passed|failed|skipped" build/teste.log || true
xcrun xcresulttool export attachments --path build/resultado.xcresult --output-path "$SAIDA" > /dev/null
SAIDA="$SAIDA" node -e '
const fs = require("fs")
const saida = process.env.SAIDA
for (const teste of JSON.parse(fs.readFileSync(`${saida}/manifest.json`))) {
  for (const anexo of teste.attachments ?? []) {
    const nome = anexo.suggestedHumanReadableName.split("_")[0]
    const arquivo = `${saida}/${anexo.exportedFileName}`
    if (/^\d/.test(nome) && arquivo.endsWith(".png")) fs.renameSync(arquivo, `${saida}/${nome}.png`)
    else fs.rmSync(arquivo)
  }
}'
ls "$SAIDA" | grep '^[0-9]' || true
exit ${STATUS:-0}
