#!/usr/bin/env bash
# Prints a line range of the newest Detox run's detox.log.
#
#   scripts/wsl/loglines.sh <start> [end]
set -u
cd "${WORK_DIR:-$HOME/econoflow}" || exit 1

start="${1:?usage: loglines.sh <start> [end]}"
end="${2:-$((start + 40))}"

newest=$(ls -1dt e2e/artifacts/*/ 2>/dev/null | head -n 1)
run=${newest%/}
echo "run: $run ($start..$end)"
sed -n "${start},${end}p" "$run/detox.log"
