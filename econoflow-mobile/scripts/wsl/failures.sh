#!/usr/bin/env bash
# Prints what went wrong in the most recent Detox run.
#
#   scripts/wsl/failures.sh               # failures of the newest run
#   scripts/wsl/failures.sh <run-dir>     # failures of one run
#
# Written as a file on purpose: inline `wsl -- bash -lc '...'` calls mangle quoting and
# patterns (see RUN-E2E.md, "How to drive this from an agent").
set -u
cd "${WORK_DIR:-$HOME/econoflow}" || exit 1

if [ $# -ge 1 ]; then
  run="$1"
else
  run=$(ls -1d e2e/artifacts/*/ 2>/dev/null | sort | tail -n 1)
  run=${run%/}
fi

log="$run/detox.log"
[ -f "$log" ] || { echo "no detox.log in '$run'" >&2; exit 1; }

echo "=== $run ==="

# Jest writes each failing case as "● suite › case" followed by the thrown error.
awk '
  /^[[:space:]]*●/ { printing = 1; print; next }
  printing && /^[[:space:]]*$/ { blank++; if (blank >= 2) printing = 0; next }
  printing { blank = 0; print }
' "$log" | head -n "${LINES_MAX:-200}"

echo
echo "=== harness errors ==="
grep -n -E ' (E|e) ' "$log" | grep -v -E 'testResults|isPermanentFailure|detected event|received event' | head -n 40
