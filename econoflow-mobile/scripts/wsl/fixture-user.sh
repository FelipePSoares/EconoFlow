#!/usr/bin/env bash
# Prints the fixture users exactly as the database holds them.
#
# This is the check for the failure mode the e2e suite cannot explain by itself: the Login
# screen answers 401 for `test1@test.com` even though the row exists, because Identity's
# `FindByEmailAsync` looks the user up by `NormalizedEmail` and a seeder that writes the row
# through the DbContext leaves that column empty.
#
#   scripts/wsl/fixture-user.sh
set -u
# shellcheck source=/dev/null
cd "$HOME/econoflow-repo" || exit 1

docker compose -f docker-compose.dev.yml exec -T postgres \
  psql -U econoflow -d econoflow -X -P pager=off -c \
  'SELECT "Email", "UserName", coalesce("NormalizedEmail", $$<NULL>$$) AS "NormalizedEmail", coalesce("NormalizedUserName", $$<NULL>$$) AS "NormalizedUserName", "EmailConfirmed", "Enabled" FROM "AspNetUsers" ORDER BY "Email";'
