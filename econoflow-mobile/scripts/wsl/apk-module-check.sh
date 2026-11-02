#!/usr/bin/env bash
# Is a local Expo module actually inside the built APK?
#
#   apk-module-check.sh econoflowlog
#
# A module can be present on disk, linked by npm and listed by autolinking, and still not be in
# the APK — an anchored sync exclude, a stale `node_modules` symlink or a Gradle cache are all
# enough. The APK is the only thing that matters, so look inside it.
set -u
. "$HOME/.android-hosts.env"
cd "${WORK_DIR:-$HOME/econoflow}" || exit 1
needle="${1:-econoflowlog}"
apk=android/app/build/outputs/apk/debug/app-debug.apk
dexdir=/tmp/apk-dex
rm -rf "$dexdir"; mkdir -p "$dexdir"

echo "=== autolinking.json"
grep -o "\"[^\"]*econoflow[^\"]*\"" android/build/generated/autolinking/autolinking.json 2>/dev/null | sort -u | head -5

echo "=== classes in the APK (aapt2 names, then dex strings)"
"$ANDROID_HOME/build-tools/35.0.0/aapt2" dump packagename "$apk" 2>/dev/null
unzip -o -q "$apk" 'classes*.dex' -d "$dexdir" 2>/dev/null
found=0
for dex in "$dexdir"/*.dex; do
  [ -e "$dex" ] || continue
  if strings "$dex" | grep -q "$needle"; then
    echo "FOUND '$needle' in $(basename "$dex")"
    found=1
  fi
done
[ "$found" -eq 0 ] && echo "NOT FOUND — the module is not compiled into this APK"
