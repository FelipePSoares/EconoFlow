#!/usr/bin/env bash
# Is the running Metro bundle the *current* source?
#
#   bundle-check.sh
#
# A debug APK carries no JavaScript: it fetches the bundle from Metro. If Metro serves a cached
# or differently-rooted bundle, the app runs old code and every source change is invisible —
# which reads exactly like "my fix does nothing".
#
# This asks for the plain `index.bundle` and looks for a string that only exists in the current
# tree. If it is missing, Metro is the problem, not the app.
set -u
. "$HOME/.android-hosts.env"
cd "${WORK_DIR:-$HOME/econoflow}" || exit 1

OUT=/tmp/bundle.js
echo "=== fetching the bundle the app would load"
curl -s --max-time 180 \
  'http://127.0.0.1:8081/index.bundle?platform=android&dev=true&minify=false' -o "$OUT"
printf 'bundle: %s bytes\n' "$(stat -c%s "$OUT" 2>/dev/null || echo 0)"

echo "=== does it contain the current trail source?"
for needle in 'diagnostics.init' 'EconoFlowTrace' 'sessionEntryScreen'; do
  printf '%-20s %s\n' "$needle" "$(grep -c "$needle" "$OUT" 2>/dev/null || echo 0)"
done

echo
echo "=== first lines (an error message here means the fetch failed)"
head -c 300 "$OUT"
echo
