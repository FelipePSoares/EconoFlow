#!/usr/bin/env bash
# The mobile login, exactly as the app sends it — and from the device, not the host.
#
#   mobile-login-check.sh
#
# The host reaching the API proves nothing about the emulator: three things sit in between and
# each fails differently.
#
#   1. the base URL baked into the bundle (`EXPO_PUBLIC_API_URL`, read by `src/api/client.ts`);
#   2. `adb reverse tcp:7003` — the app calls `localhost:7003`, which on the device is the
#      device itself;
#   3. the body and headers the app adds (`X-Client-Type: mobile`).
#
# Step 2 is the one that silently disappears: an `adb reverse` rule does not survive an
# emulator restart, an `adb kill-server`, or `adb root`, and without it every request from the
# app reaches nothing at all.
set -u
. "$HOME/.android-hosts.env"
BASE=http://localhost:7003
LOGIN=/api/AccessControl/mobile/login

cd "${WORK_DIR:-$HOME/econoflow}" || exit 1

echo "=== base URL the app compiles in"
grep -n 'EXPO_PUBLIC_API_URL' src/api/client.ts

echo
echo "=== reverse rules (the app's localhost -> host bridge)"
adb reverse --list 2>/dev/null || echo "(none — every device request goes to the device itself)"

echo
echo "=== health, from the device's own loopback"
adb shell "toybox wget -q -O - --timeout=5 $BASE/api/health/live" 2>&1 | head -c 200
echo

echo
echo "=== the login the app makes, from the device"
adb shell "toybox wget -q -O - --timeout=15 \
  --header='Content-Type: application/json' \
  --header='X-Client-Type: mobile' \
  --post-data='{\"email\":\"test1@test.com\",\"password\":\"Passw0rd!\"}' \
  $BASE$LOGIN" 2>&1 | head -c 500
echo
