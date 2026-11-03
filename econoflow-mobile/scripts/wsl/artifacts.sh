#!/usr/bin/env bash
# Lists the files of the newest Detox run (screenshots, device logs, result markers).
#
#   scripts/wsl/artifacts.sh
#
# Also reports each screenshot's size: on this emulator a ~20 KB PNG is a blank screen and a
# > 500 KB one is a rendered UI, which is the fastest way to tell "the app drew nothing" from
# "the app was somewhere else".
set -u
cd "${WORK_DIR:-$HOME/econoflow}" || exit 1

newest=$(ls -1dt e2e/artifacts/*/ 2>/dev/null | head -n 1)
run=${newest%/}
echo "run: $run"
echo

find "$run" -maxdepth 2 -type f -printf '%10s  %P\n' | sort -k2 | head -n 80
