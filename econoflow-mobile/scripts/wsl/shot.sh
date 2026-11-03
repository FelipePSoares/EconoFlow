#!/usr/bin/env bash
# Copies a screenshot out of the newest Detox run so it can be opened from the host.
#
#   scripts/wsl/shot.sh <case-substring> [testFnFailure|testDone|testStart] [out-name]
#
# The run directory names contain a space, which is why this is a script: an inline
# `cp e2e/artifacts/<run>/…` inside `wsl -- bash -lc '...'` is split by the shell.
set -u
cd "${WORK_DIR:-$HOME/econoflow}" || exit 1

needle="${1:?usage: shot.sh <case-substring> [testFnFailure|testDone|testStart] [out-name]}"
which="${2:-testFnFailure}"
out="${3:-shot.png}"

newest=$(ls -1dt e2e/artifacts/*/ 2>/dev/null | head -n 1)
run=${newest%/}

# The case directory starts with the ✗/✓ marker and contains the case title.
case_dir=$(find "$run" -maxdepth 1 -type d -name "*${needle}*" | head -n 1)
if [ -z "$case_dir" ]; then
  echo "no case matching '$needle' in $run" >&2
  echo "cases:" >&2
  find "$run" -maxdepth 1 -type d -mindepth 1 -printf '  %f\n' >&2
  exit 1
fi

src="$case_dir/${which}.png"
[ -f "$src" ] || { echo "no ${which}.png in $case_dir" >&2; ls -1 "$case_dir" >&2; exit 1; }

cp "$src" "$HOME/$out"
echo "copied -> $HOME/$out"
echo "windows: \\\\wsl.localhost\\Ubuntu\\home\\$(whoami)\\$out"
