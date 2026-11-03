#!/usr/bin/env bash
# Prints a summary of the most recent Detox run under e2e/artifacts/.
#
#   scripts/wsl/latest-run.sh            # summary of the newest run
#   scripts/wsl/latest-run.sh <run-dir>  # summary of one run
#   scripts/wsl/latest-run.sh <run-dir> log  # the raw detox.log
#
# Written as a file on purpose: inline `wsl -- bash -lc '...'` calls mangle quoting and
# globs (see RUN-E2E.md, "How to drive this from an agent").
set -u
cd "${WORK_DIR:-$HOME/econoflow}" || exit 1
artifacts=e2e/artifacts

if [ $# -ge 1 ]; then
  run="$1"
else
  run=$(ls -1d "$artifacts"/*/ 2>/dev/null | sort | tail -n 1)
  run=${run%/}
fi

if [ ! -d "$run" ]; then
  echo "no run at '$run'" >&2
  exit 1
fi

if [ "${2:-}" = "log" ]; then
  cat "$run/detox.log"
  exit 0
fi

printf 'run: %s\n\n' "$run"
printf -- '--- result files (%s) ---\n' "$(ls -1A "$run" | wc -l)"
ls -1A "$run"

if [ -f "$run/detox.log" ]; then
  printf '\n--- report lines ---\n'
  grep -nE '^[[:space:]]*(✗|✓|✓ )' "$run/detox.log" | head -n 80
  printf '\n--- jest totals ---\n'
  grep -nE 'Tests:|Test Suites:|Time:' "$run/detox.log" | head -n 10
fi
