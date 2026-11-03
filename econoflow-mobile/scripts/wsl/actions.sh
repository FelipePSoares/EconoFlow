#!/usr/bin/env bash
# Prints, in order, every Detox action the newest run sent, with its matcher — the timeline of
# what a spec actually did.
#
#   scripts/wsl/actions.sh [case-substring]
#
# Extracts testId/text matchers in the order they appear in detox.log, so a spec's real
# sequence can be compared against the one it was written to perform.
set -u
cd "${WORK_DIR:-$HOME/econoflow}" || exit 1

needle="${1:-}"
newest=$(ls -1dt e2e/artifacts/*/ 2>/dev/null | head -n 1)
run=${newest%/}
log="$run/detox.log"
[ -f "$log" ] || { echo "no detox.log" >&2; exit 1; }

echo "run: $run"
echo
grep -o -E '(matcherForTestId|matcherForText),"args":\["[^"]*"' "$log" \
  | sed -E 's/matcherForTestId,"args":\[/id=/; s/matcherForText,"args":\[/text=/' \
  | uniq -c | head -n "${LINES_MAX:-120}"
