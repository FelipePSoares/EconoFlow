#!/usr/bin/env bash
# A table of the artifact runs: how many passed/failed, and the first failure — the quickest
# way to see whether a failure is new or has been there all along.
set -u
cd "${1:-$HOME/econoflow/e2e/artifacts}" || exit 0
printf '%-18s %5s %5s  %s\n' run pass fail first-failure
for d in */; do
  log="$(find "$d" -maxdepth 2 -name detox.log | head -1)"
  [ -n "$log" ] || continue
  pass=$(grep -c '\[PASSED\]' "$log")
  fails=$(grep -c '\[FAILED\]' "$log")
  first=$(grep -m1 '\[FAILED\]' "$log" | sed 's/^.* i //; s/ \[FAILED\]//; s/\[FAILED\] //')
  printf '%-18s %5s %5s  %s\n' "$(echo "${d%/}" | sed 's/android.emu.debug.//')" "$pass" "$fails" "$first"
done
