#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export JAVA_HOME="${BUILD_JAVA_HOME:-$HOME/.gradle/jdks/eclipse_adoptium-17-amd64-linux.2}"
export ANDROID_HOME="${ANDROID_HOME:-$HOME/Android/Sdk}"
export PATH="$JAVA_HOME/bin:$PATH"
keystore="${ANDROID_KEYSTORE_PATH:-$HOME/.local/share/6mw/android-debug.keystore}"
key_alias="${ANDROID_KEY_ALIAS:-android}"
: "${ANDROID_KEYSTORE_PASSWORD:?set ANDROID_KEYSTORE_PASSWORD}"

build_tools="$(ls -d "$ANDROID_HOME"/build-tools/*/ | sort -V | tail -1)"; build_tools="${build_tools%/}"
out_dir="$root/android/build/output"
unsigned="$root/android/app/build/outputs/apk/release/app-release-unsigned.apk"
aligned="$out_dir/aligned.apk"
apk="$out_dir/6mw-backstage.apk"

if [ ! -f "$keystore" ]; then
  echo "keystore not found: $keystore" >&2
  exit 1
fi

(cd "$root/android" && ./gradlew --console=plain assembleRelease)

mkdir -p "$out_dir"
rm -f "$aligned" "$apk"
"$build_tools/zipalign" -f -p 4 "$unsigned" "$aligned"
"$build_tools/apksigner" sign --ks "$keystore" --ks-key-alias "$key_alias" \
  --ks-pass env:ANDROID_KEYSTORE_PASSWORD --key-pass env:ANDROID_KEYSTORE_PASSWORD \
  --out "$apk" "$aligned"
rm -f "$aligned"

echo "$apk"
