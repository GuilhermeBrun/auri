#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
DESTINO=${1:-platform=iOS Simulator,name=iPhone 18 Pro}
pkill -f build/servidor.cjs || true
node scripts/servidor.mjs 47391 > build/servidor.log 2>&1 &
SERVIDOR=$!
trap 'kill $SERVIDOR 2>/dev/null || true' EXIT
until grep -q '^convite ' build/servidor.log 2>/dev/null; do sleep 1; done
CONVITE=$(grep '^convite ' build/servidor.log | sed 's/^convite //')
xcrun simctl uninstall booted com.auri.ios 2>/dev/null || true
rm -rf build/resultado.xcresult build/telas
TEST_RUNNER_AURI_QR="$CONVITE" xcodebuild test -project Auri.xcodeproj -scheme Auri \
  -destination "$DESTINO" -derivedDataPath build/xcode -resultBundlePath build/resultado.xcresult -collect-test-diagnostics never \
  > build/teste.log 2>&1 || STATUS=$?
grep -E "error:|passed|failed" build/teste.log || true
xcrun xcresulttool export attachments --path build/resultado.xcresult --output-path build/telas > /dev/null
node -e '
const fs = require("fs")
for (const teste of JSON.parse(fs.readFileSync("build/telas/manifest.json"))) {
  for (const anexo of teste.attachments ?? []) {
    const nome = anexo.suggestedHumanReadableName.split("_")[0]
    if (/^\d/.test(nome)) fs.renameSync(`build/telas/${anexo.exportedFileName}`, `build/telas/${nome}.png`)
  }
}'
ls build/telas | grep '^[0-9]'
exit ${STATUS:-0}
