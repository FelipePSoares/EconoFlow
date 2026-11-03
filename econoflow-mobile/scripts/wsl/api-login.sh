#!/usr/bin/env bash
# What the running dev stack answers for the seeded mobile login.
#
# This is the one fact the whole Detox suite rests on: every spec signs in as
# `test1@test.com`. When it answers 401 InvalidCredentials while the row exists, the cause is
# in how the row was written (Identity's NormalizedEmail), not in the app — and on screen it
# shows as "Incorrect login information!", which reads like a wrong password.
#
#   scripts/wsl/api-login.sh
set -u
# shellcheck source=/dev/null
. "$HOME/.android-hosts.env"

echo "=== POST /api/AccessControl/login (what the app sends)"
curl -s -m 20 -w '\nHTTP %{http_code}\n' \
  -H 'Content-Type: application/json' \
  -H 'X-Client-Type: mobile' \
  -d '{"email":"test1@test.com","password":"Passw0rd!"}' \
  http://127.0.0.1:7003/api/AccessControl/login | head -c 700

echo
echo "=== GET /api/health/live"
curl -s -m 10 -o /dev/null -w 'HTTP %{http_code}\n' http://127.0.0.1:7003/api/health/live
