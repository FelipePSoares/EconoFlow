#!/usr/bin/env bash
# Taps form fields by position taken from the view hierarchy — never from guessed coordinates.
#
#   tap-field.sh <testID-or-text> [text-to-type]
#
# The Login screen moves when the keyboard opens, so fixed y-coordinates land in the wrong
# field (which is how a "login" run silently typed the password into the email box). This
# reads `uiautomator dump`, finds the node whose resource-id ends with the id you asked for
# (React Native exposes `testID` as `resource-id`), and taps the centre of its bounds.
set -u
. "$HOME/.android-hosts.env"

find_field() {
  adb shell uiautomator dump /sdcard/hier.xml >/dev/null 2>&1
  adb shell cat /sdcard/hier.xml 2>/dev/null > /tmp/hier.xml
  adb shell rm -f /sdcard/hier.xml >/dev/null 2>&1
  /usr/bin/python3 - "$1" <<'PY'
import re
import sys

wanted = sys.argv[1]
xml = open('/tmp/hier.xml', encoding='utf-8', errors='replace').read()

for node in re.findall(r'<node [^>]*>', xml):
    rid = re.search(r'resource-id="([^"]*)"', node)
    bounds = re.search(r'bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"', node)
    if not bounds or not rid:
        continue
    if rid.group(1).split('/')[-1] != wanted and wanted not in rid.group(1):
        continue
    x1, y1, x2, y2 = (int(v) for v in bounds.groups())
    print(f'{(x1 + x2) // 2} {(y1 + y2) // 2}')
    break
PY
}

field="${1:?field testID}"
text="${2:-}"

pos="$(find_field "$field")"
if [ -z "$pos" ]; then
  echo "field '$field' not found on screen" >&2
  exit 1
fi

echo "tapping '$field' at $pos"
# shellcheck disable=SC2086
adb shell input tap $pos
sleep 2

if [ -n "$text" ]; then
  adb shell input text "$text"
  sleep 1
fi
