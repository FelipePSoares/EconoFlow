#!/usr/bin/env bash
# Greps the device (logcat) log of a case from the newest Detox run.
#
#   scripts/wsl/devicelog.sh <case-substring> <pattern>
#
# The device log is where the app's network activity shows up — an HTTP client error, a
# refused connection, or the app's own native trace (`EconoFlowTrace`). The app's JS
# `console.*` never reaches logcat, but the native trail and React Native's error reporter do
# (RUN-E2E.md §0.4).
set -u
cd "${WORK_DIR:-$HOME/econoflow}" || exit 1

needle="${1:?usage: devicelog.sh <case-substring> [pattern]}"
# The app's own native trail, React Native's error reporter, and anything network-ish. A
# pattern with `|` cannot be passed through `wsl -- bash -lc '...'` reliably, so the useful
# default lives here rather than on the command line.
pattern="${2:-EconoFlowTrace|ReactNativeJS|AndroidRuntime|AccessControl|ECONN|Exception|error}"

newest=$(ls -1dt e2e/artifacts/*/ 2>/dev/null | head -n 1)
run=${newest%/}

case_dir=$(find "$run" -maxdepth 1 -type d -name "*${needle}*" | head -n 1)
if [ -z "$case_dir" ]; then
  echo "no case matching '$needle' in $run" >&2
  find "$run" -maxdepth 1 -type d -mindepth 1 -printf '  %f\n' >&2
  exit 1
fi

log="$case_dir/device.log"
[ -f "$log" ] || { echo "no device.log in $case_dir" >&2; exit 1; }

echo "case: $case_dir"
grep -n -i -E -- "$pattern" "$log" | head -n "${LINES_MAX:-60}"
