#!/usr/bin/env bash
# Greps the newest Detox run's detox.log for a pattern.
#
#   scripts/wsl/loggrep.sh 'pattern'
#
# Exists because `wsl -- bash -lc 'cd ~/econoflow && grep … e2e/artifacts/*/detox.log'` loses
# the glob: the run directory names contain a space ("android.emu.debug.2026-11-02 20-35-43Z"),
# so the shell collapses them and the grep fails with "cannot access".
set -u
cd "${WORK_DIR:-$HOME/econoflow}" || exit 1

pattern="${1:?usage: loggrep.sh <pattern> [lines-after]}"
after="${2:-0}"

newest=$(ls -1dt e2e/artifacts/*/ 2>/dev/null | head -n 1)
run=${newest%/}
log="$run/detox.log"

echo "run: $run"
grep -n -A"$after" -- "$pattern" "$log"
