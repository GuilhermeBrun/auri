#!/bin/sh
set -eu

VERSAO=v2.5.5
SHA256=fc68740347c8532ba49d45bf61fae9ca1f1040dc7d6c99f2f92dc30c40e84e46

cd "$(dirname "$0")/.."
[ -d App/frameworks/BareKit.xcframework ] && exit 0

TEMP=$(mktemp -d)
trap 'rm -rf "$TEMP"' EXIT

gh release download "$VERSAO" --repo holepunchto/bare-kit --pattern prebuilds.zip --dir "$TEMP"
echo "$SHA256  $TEMP/prebuilds.zip" | shasum -a 256 -c -
unzip -q "$TEMP/prebuilds.zip" "ios/BareKit.xcframework/*" -d "$TEMP"
mkdir -p App/frameworks
mv "$TEMP/ios/BareKit.xcframework" App/frameworks/
