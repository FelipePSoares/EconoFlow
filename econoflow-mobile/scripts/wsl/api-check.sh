#!/usr/bin/env bash
# Which API URL wins for the app, and is it reachable?
#
#   api-check.sh
#
# Expo loads `.env` first, then `.env.local`, and the later file wins. The app's base URL is
# inlined into the bundle by Metro — so a stale bundle, a `.env` pointing at production, or a
# missing `adb reverse` all look identical from the app's side: a login that just fails.
set -u
. "$HOME/.android-hosts.env"
cd "${WORK_DIR:-$HOME/econoflow}"
BASE="${EXPO_PUBLIC_API_URL_OVERRIDE:-http://localhost:7003}"

echo "=== the env files, in load order (the last one wins)"
for f in .env .env.local; do
  [ -f "$f" ] && printf '%-12s %s\n' "$f" "$(grep -h 'EXPO_PUBLIC_API_URL' "$f" || echo '(unset)')"
done

echo
echo "=== the server the bundle should be talking to"
printf '%-28s %s\n' "$BASE/api/health/live" "$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 "$BASE/api/health/live" || echo unreachable)"

echo
echo "=== does the seeded account work? (the fact the e2e specs rest on)"
body='{"email":"test1@test.com","password":"Passw0rd!"}'
response="$(curl -s --max-time 15 -X POST "$BASE/api/Auth/Login?useCookies=false&useSessionCookies=false" \
  -H 'Content-Type: application/json' -H 'X-Client-Type: mobile' -d "$body" 2>/dev/null)"
if printf '%s' "$response" | grep -q 'accessToken'; then
  echo "login OK — the seeded account has a token"
else
  echo "login FAILED — first 300 chars of the response:"
  printf '%s\n' "$response" | head -c 300
  echo
fi

echo
echo "=== device -> host plumbing"
adb reverse --list 2>/dev/null || echo "(no reverse rules)"
