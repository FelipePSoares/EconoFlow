#!/usr/bin/env bash
# Repairs the fixture users in the running dev database the way the fixed seeder writes them.
#
# WHY THIS EXISTS: `DevelopmentTestDataSeeder` used to write its two users through the
# DbContext only, leaving `NormalizedEmail`/`NormalizedUserName` NULL (they are what Identity's
# `FindByEmailAsync` — the login path — matches on). The fix sets both in the seeder, but the
# running dev image cannot be rebuilt here (the Gitea NuGet token in `.env` is expired), and the
# rows were seeded before the fix. This applies the same two values to rows that already exist,
# so the suite can be exercised against a correct fixture. It is NOT a substitute for the fix:
# a fresh `docker compose up` seeds correctly without it.
#
#   scripts/wsl/fix-fixture-rows.sh
set -u
cd "$HOME/econoflow-repo" || exit 1

psql_() { docker compose -f docker-compose.dev.yml exec -T postgres \
  psql -U econoflow -d econoflow -X -v ON_ERROR_STOP=1 "$@"; }

echo "before:"
psql_ -c 'SELECT "Email", coalesce("NormalizedEmail", $$<NULL>$$) AS "NormalizedEmail", coalesce("NormalizedUserName", $$<NULL>$$) AS "NormalizedUserName" FROM "AspNetUsers" ORDER BY "Email";'

# Identity's default normalizer is the invariant upper-case of the value, so upper() is the
# same transformation `ILookupNormalizer.NormalizeName/NormalizeEmail` performs.
psql_ -c 'UPDATE "AspNetUsers" SET "NormalizedEmail" = upper("Email"), "NormalizedUserName" = upper("UserName") WHERE "NormalizedEmail" IS NULL OR "NormalizedUserName" IS NULL;'

echo "after:"
psql_ -c 'SELECT "Email", coalesce("NormalizedEmail", $$<NULL>$$) AS "NormalizedEmail", coalesce("NormalizedUserName", $$<NULL>$$) AS "NormalizedUserName" FROM "AspNetUsers" ORDER BY "Email";'
