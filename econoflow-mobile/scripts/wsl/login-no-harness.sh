#!/usr/bin/env bash
# Signs in by tapping the fields the view hierarchy reports, with no Detox anywhere in the run.
#
#   login-no-harness.sh [seconds]
#
# Why this script exists: every Detox run ends by force-stopping the app ("stop … due to
# finished inst"), and the launcher that replaces it is indistinguishable from the reported
# "blank screen after login" (#1116). Only a run with nothing harnessed onto the app can say
# what the app itself does after a successful sign-in.
#
# Fields are located through `uiautomator dump` — the Login screen moves when the keyboard
# opens, so fixed coordinates silently type the password into the email box.
set -u
. "$HOME/.android-hosts.env"
PACKAGE=pt.econoflow.mobile
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WATCH="${1:-30}"
OUT=/tmp/no-harness
rm -rf "$OUT"; mkdir -p "$OUT"

adb reverse tcp:7003 tcp:7003 >/dev/null
adb reverse tcp:8081 tcp:8081 >/dev/null
adb logcat -c

echo "=== cold start"
adb shell am force-stop "$PACKAGE"
adb shell am start -a android.intent.action.VIEW -d econoflow://e2e/open >/dev/null 2>&1
sleep 25

echo "=== fill the form by testID"
bash "$HERE/tap-field.sh" login-email 'test1@test.com' || exit 1
bash "$HERE/tap-field.sh" login-password 'Passw0rd!' || exit 1

echo "=== sign in"
bash "$HERE/tap-field.sh" login-submit || exit 1

prev=""
for i in $(seq 1 "$WATCH"); do
  sleep 2
  f="$OUT/$(printf '%03d' "$i").png"
  adb exec-out screencap -p > "$f" 2>/dev/null
  size="$(stat -c%s "$f" 2>/dev/null || echo 0)"
  pid="$(adb shell pidof $PACKAGE 2>/dev/null | tr -d '\r')"
  if [ "$size" != "$prev" ]; then
    printf '%02ds size=%-8s pid=%s\n' "$((i * 2))" "$size" "${pid:-DEAD}"
    prev="$size"
  fi
  [ -z "$pid" ] && { echo "the app died"; break; }
done

echo "=== screen now"
adb shell uiautomator dump /sdcard/n.xml >/dev/null 2>&1
adb shell cat /sdcard/n.xml 2>/dev/null | grep -oE 'text="[^"]+"|resource-id="[a-z-]+"' | sort -u | head -20
