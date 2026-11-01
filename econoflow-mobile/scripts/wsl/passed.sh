#!/usr/bin/env bash
# Which tests of a run passed and failed.
#   passed.sh                       # newest run
#   passed.sh "2026-11-01 14-26-09Z"
set -u
run="${1:-}"
if [ -n "$run" ]; then
  log="$HOME/econoflow/e2e/artifacts/android.emu.debug.$run/detox.log"
else
  log="$(find "$(ls -dt "$HOME"/econoflow/e2e/artifacts/*/ | head -1)" -maxdepth 2 -name detox.log | head -1)"
fi
echo "log: $log"
echo "--- verdict items (the JSON that follows each test)"
grep -oE '"title":"[^"]+","fullName":"[^"]+","status":"[a-z]+"' "$log" | sed 's/"fullName":"[^"]*",//' | sort | uniq -c | sort -rn | head -40
