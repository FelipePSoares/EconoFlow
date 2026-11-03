#!/usr/bin/env bash
# Shows the failing cases and their messages from the newest Detox run.
#
#   scripts/wsl/results.sh            # every failing case, with the start of its message
#   scripts/wsl/results.sh <match>    # only cases whose title contains <match>
#
# The run directory names contain spaces ("android.emu.debug.2026-11-02 20-35-43Z"), so every
# path is quoted here and the run is found with `ls -1dt` instead of a glob expanded inside an
# inline `wsl -- bash -lc '...'` call (that quoting does not survive PowerShell).
set -u
cd "${WORK_DIR:-$HOME/econoflow}" || exit 1

needle="${1:-}"

newest=$(ls -1dt e2e/artifacts/*/ 2>/dev/null | head -n 1)
run=${newest%/}
log="$run/detox.log"

echo "run: $run"
echo

if [ ! -f "$log" ]; then
  echo "no detox.log in that run" >&2
  exit 1
fi

# Jest prints "● <suite> › <case>" for each failing case, followed by the failure text.
# JEST_HEAD_LINES controls how much of each block is shown.
max="${JEST_HEAD_LINES:-12}"

awk -v needle="$needle" -v max="$max" '
  /^[[:space:]]*● / {
    if (inblock) print ""
    if (needle != "" && index($0, needle) == 0) { inblock = 0; next }
    inblock = 1; shown = 0; print; next
  }
  /^Test Suites:|^Tests: / { inblock = 0 }
  inblock { if (shown < max) { print; shown++ } }
' "$log" | head -n 240
