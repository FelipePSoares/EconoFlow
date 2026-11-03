#!/usr/bin/env bash
# Proves the *device* (not the host) reaches the API stack, and that the app's own login
# request is accepted. A host-side curl proves nothing about the emulator: `localhost` on the
# device is the device, and only `adb reverse` bridges it (RUN-E2E.md §0.1).
#
# This image has neither `wget` nor `curl`, so the device side is proven with the platform's
# own `am`/`toybox` primitives: `nc` (toybox) speaks the HTTP request straight down the
# socket that `adb reverse` maps. If `nc` is missing too, the script says so and falls back to
# reporting the reverse rules, which is the part that actually goes missing.
#
#   scripts/wsl/device-api-check.sh
set -u
# shellcheck source=/dev/null
. "$HOME/.android-hosts.env"
ADB="$ANDROID_HOME/platform-tools/adb"

json_login="{\"email\":\"test1@test.com\",\"password\":\"Passw0rd!\"}"

echo "=== reverse rules (the device's localhost -> host bridge)"
"$ADB" reverse --list

echo
echo "=== what the device has to make requests with"
for tool in curl wget nc toybox; do
  printf '%-7s %s\n' "$tool" "$("$ADB" shell "command -v $tool 2>/dev/null | tr -d '\r'" || true)"
done

echo
echo "=== host side, for reference: is the stack answering at all"
curl -s -m 10 -o /dev/null -w 'host  health=%{http_code}\n' http://127.0.0.1:7003/api/health/live
curl -s -m 20 -w '\nhost  login=%{http_code}\n' \
  -H 'Content-Type: application/json' -H 'X-Client-Type: mobile' \
  -d "$json_login" http://127.0.0.1:7003/api/AccessControl/login | head -c 400
echo

echo
echo "=== the same login, sent from the device over the reverse bridge"
body="POST /api/AccessControl/login HTTP/1.1\r\nHost: localhost:7003\r\nContent-Type: application/json\r\nX-Client-Type: mobile\r\nContent-Length: ${#json_login}\r\nConnection: close\r\n\r\n${json_login}"
printf '%s' "$body" > /tmp/login.req
"$ADB" push /tmp/login.req /data/local/tmp/login.req >/dev/null 2>&1

if "$ADB" shell 'command -v toybox' >/dev/null 2>&1; then
  "$ADB" shell 'toybox nc -w 20 localhost 7003 < /data/local/tmp/login.req' 2>&1 | tr -d '\r' | head -c 900
  echo
else
  echo "no nc on the device; cannot send a request from it"
fi
