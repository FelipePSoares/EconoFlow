# Move — PostgreSQL cutover runbook

> **THIS IS A WORKED EXAMPLE, NOT ECONOFLOW'S RUNBOOK.**
>
> It documents a **different application** (Move) in a **different repository**. Every
> path below — `tools/Move.DataMigration`, `scripts/postgres-provision.sql`,
> `compose.yaml`, `.backup/dump.dacpac` — refers to the **Move repo**, and none of it
> exists here. Do not copy commands out of this file and run them in EconoFlow.
>
> Read it for the **reasoning and the failure modes**, then write EconoFlow's own plan
> from [`ECONOFLOW_PREFLIGHT.md`](ECONOFLOW_PREFLIGHT.md) and
> [`MIGRATION_TEMPLATE.md`](MIGRATION_TEMPLATE.md).
>
> Two sections are worth reading even if you read nothing else:
> **§5** (an engine bug Move found, fixed in 1.1.3 — and why a plan cannot work around it)
> and **§7.2** (the one thing that went wrong live: the image pin, and how a frozen Argo
> makes it worse).

Move's instance of the programme procedure. Read
[`CUTOVER_LESSONS.md`](CUTOVER_LESSONS.md) first: it is what actually happened on the
pilot, and every step below that looks over-cautious is there because of it.

This document is the **operational** companion. For *how the tool works* see
[`DATABASE_MIGRATION.md`](DATABASE_MIGRATION.md); for the generic per-project order of
work see [`MIGRATION_TEMPLATE.md`](MIGRATION_TEMPLATE.md).

**Status: cutover COMPLETED and verified 2026-10-12.** The record of what happened — the
full run, the one failure, and the evidence gathered — is in §7.

---

## 0. What Move is, for the purposes of this migration

| | |
|---|---|
| Source | SQL Server, database `move` (rehearsed from `.backup/dump.dacpac`) |
| Target | PostgreSQL 17 |
| Application env var | **`MoveDB`** — unchanged, so no deployment key is renamed |
| Schemas | **one** (`public`). The 1.1.x multi-schema fixes are not load-bearing here. |
| Contexts | **one** (`MoveDatabaseContext`) — so **one** migration host, unlike WhiteLabel's two |
| Populated tables | 5 (`AspNetUsers`, `Moves`, `Boxes`, `BoxItems`, `MoveMembers`) |
| Rows in the production snapshot | **212** across 12 tables (5 populated, 7 empty) |
| Identity columns | `AspNetUserClaims.Id`, `AspNetRoleClaims.Id` — **sequences must be resynced** |
| Object store | **Shared, unchanged.** `BoxImages.S3Key` values are not touched by a database migration. |

Recorded pre-cutover source counts, from the rehearsal load of `dump.dacpac`:

| Table | Rows | | Table | Rows |
|---|---:|---|---|---:|
| AspNetUsers | 4 | | Moves | 3 |
| AspNetRoles | 0 | | Boxes | 39 |
| AspNetUserRoles | 0 | | BoxItems | 162 |
| AspNetUserClaims | 0 | | BoxImages | 0 |
| AspNetRoleClaims | 0 | | MoveMembers | 4 |
| AspNetUserLogins | 0 | | | |
| AspNetUserTokens | 0 | | **Total** | **212** |

---

## 1. The order of work

```
A. ACCOUNTS (no downtime)
     - PostgreSQL role + database, and the role must OWN both
       -> scripts/postgres-provision.sql   (replace the password, run as a superuser)
     - confirm citext + pg_trgm are creatable by the role
       -> the script ends with a check that does exactly this
     - SQL Server read-only migrator login
       -> scripts/sqlserver-readonly-login.sql  (replace the password, run as sa)
     - seal credentials; keep the env var name MoveDB
     - VERIFY the role owns the db: expect `move|move`, not `postgres|move`

B. FREEZE (no downtime) — BEFORE any image is published
     - comment out the Image Updater entry for this site
     - remove syncPolicy.automated from the Argo Application
     - MERGE it  <- the freeze is not real until it is on main
     - force Argo to reconcile, then VERIFY IN THE CLUSTER:
         kubectl -n shared-services get application move -o jsonpath='{.spec.syncPolicy}'
         # expect {"syncOptions":["CreateNamespace=true"]}  — no "automated"

C. IMAGE (no downtime)
     - publish from the branch carrying the Npgsql build
     - VERIFY BY RUNNING IT, not by reading a tag:
         docker run --rm --entrypoint sh <image> -c \
           'ls /app | grep -i npgsql; ls /app | grep -i sqlclient; ls /app/migrator'
         # expect Npgsql.dll + Npgsql.EntityFrameworkCore.PostgreSQL.dll
         # expect NOTHING for sqlclient
         # expect /app/migrator to exist and contain Move.DataMigration.dll
     - if the deployment pins by DIGEST, update the pin deliberately as its own step

D. SCHEMA (no downtime)
     - dotnet run --project tools/Move.DataMigration -- --migrate-only
     - confirm --check-schema PASSES

E. THE OUTAGE (minutes)
     - announce it
     - scale to 0, confirm ZERO SQL Server connections
     - run the copy; it must print MIGRATION VERIFIED
     - repoint the secret's MoveDB at PostgreSQL
     - scale to 1

F. VERIFY
     - every page 200, both health endpoints
     - scripts/postgres-verify.sql: counts, orphans = 0, case parity, sequence state
     - SQL Server connections = 0, PostgreSQL > 0

G. RE-ENABLE (one commit, both halves)
     - restore the Image Updater entry AND syncPolicy.automated TOGETHER
     - merge, force reconcile, verify in the cluster
```

---

## 1a. Creating the database users (section A, in full)

Two scripts, both with a password placeholder to replace before running. Neither
touches application data, so both are safe to run well before the outage window.

### `scripts/postgres-provision.sql` — the PostgreSQL role and database

Run once as a superuser against the target cluster. It is **idempotent**: run it twice
and the second run is a no-op, so it doubles as the password-rotation path.

```bash
psql -h <host> -U postgres -d postgres -v ON_ERROR_STOP=1 -f scripts/postgres-provision.sql
```

What it does, and why each part is there:

| Step | Why |
|---|---|
| `CREATE ROLE move WITH LOGIN` | Not SUPERUSER, not CREATEDB, not CREATEROLE. The application needs none of them. |
| `CREATE DATABASE move OWNER move` | **The load-bearing line.** The EF Core baseline runs `CREATE EXTENSION`, which requires ownership of the database. A role with only CONNECT/CREATE fails *part-way* through the first `database update`, leaving a half-built schema. |
| `ALTER ROLE ... NOSUPERUSER NOCREATEDB ...` | `CREATE ROLE` only ever *adds* attributes. On a container where `POSTGRES_USER=move`, the role is already a SUPERUSER, so a script that only set the password would leave the application holding cluster-wide power. This drops it. |
| `GRANT ALL ON SCHEMA public` + `ALTER SCHEMA public OWNER` | PostgreSQL 15+ removed the implicit CREATE on `public` for non-owners; this is required on 15/16+ and harmless below. |
| `CREATE EXTENSION citext, pg_trgm` | Declared in the EF model too, so a fresh database is creatable by migrations alone. Creating them here makes a permissions problem obvious **now** rather than mid-`database update`. |

It ends with four checks. **Do not proceed until they are right:**

1. `move | move | move` — the role OWNS the database. `postgres | move` is a failure.
2. `rolsuper=f, rolcreatedb=f, rolcreaterole=f, rolcanlogin=t, rolbypassrls=f`.
   Anything else true is more privilege than this needs.
3. `citext` and `pg_trgm` listed.
4. Zero rows — no other database owned by an unexpected role.

> **The bootstrap-superuser caveat.** On the local Docker stack the `move` role is the
> *bootstrap superuser*, and PostgreSQL refuses to strip SUPERUSER from it ("The
> bootstrap superuser must have the SUPERUSER attribute"). The script warns and
> continues rather than aborting, and check 2 still reports the truth. On a real cluster
> where an administrator creates the role, this never arises — but if check 2 shows
> `rolsuper=t` in production, stop and fix it.

### `scripts/sqlserver-readonly-login.sql` — the source login

Run once against the instance hosting `move`, as an administrator.

```bash
sqlcmd -S <host> -U sa -C -d master -i scripts/sqlserver-readonly-login.sql
```

It grants `SELECT` **on schema `dbo` only** — deliberately not `db_datareader`, which is
database-wide and easy to widen by accident. The migrator only ever issues `SELECT`, so
a login that cannot write means a bug in the migrator cannot damage the system of record
while it is still serving production.

> **`CREATE LOGIN` is not idempotent, and the script guards it with `IF NOT EXISTS`.**
> `CHECK_POLICY` is ON, so SQL Server rejects a weak password — and if `CREATE LOGIN`
> fails, every later statement still *"succeeds"* against a login that does not exist.
> That is why the script's first verification reports `login_created`; **if it returns 0
> rows, nothing after it is meaningful.**

The script carries its own closing test: connect *as* the new login and confirm
`SELECT COUNT(*) FROM Boxes` succeeds (expect 39) while `UPDATE` and `SELECT ... INTO`
are **denied**. If either write succeeds, do not use that login for the cutover.

> Passwords: prefer the `SQLCMDPASSWORD` environment variable over `-P`, which writes the
> password to shell history and the process list. Rotate both credentials once the
> rollback window closes — the read-only login should not outlive the migration.

---


---

## 2. Two things to get right before anything else

### 2.1 Never rehearse against `localhost:5432`

On a workstation 5432 is frequently a cluster port-forward, so it reaches
**production**, not your container. This copied 24,532 rows into a live database during
the pilot **while reporting `MIGRATION VERIFIED`**.

`compose.yaml` publishes the rehearsal PostgreSQL on **5433** and both the profile default
and the design-time factory use 5433. Proven before every rehearsal run:

```powershell
docker run --rm -e PGPASSWORD=move postgres:17-alpine psql \
  -h host.docker.internal -p 5433 -U move -d move -tAc "SELECT current_database();"
# -> move        (and 5432 refused, i.e. nothing of ours is listening there)
```

### 2.2 Rehearse against a copy of the real database

An empty database cannot find schema problems. Move's rehearsal loads the production
snapshot from `.backup/dump.dacpac`, which is where the `TargetDate` engine bug (§5) was
found — an empty database would have passed every check.

---

## 3. Local rehearsal, end to end

```powershell
# 1. Bring up the rehearsal stack (Postgres on 5433, SQL Server on 14330).
docker compose --profile rehearsal up -d --wait

# 2. Materialise the production snapshot into the SQL Server container.
sqlpackage /Action:Publish /SourceFile:.backup\dump.dacpac `
  /TargetConnectionString:"Server=localhost,14330;Database=MoveDacpac;User Id=sa;Password=Move!Rehearsal#2026;TrustServerCertificate=True;Encrypt=True"

# 3. Validate the plan against the LIVE source catalog. Read-only, cheap, and it is
#    what makes the cutover itself uneventful.
dotnet run --project tools/Move.DataMigration -- --check-schema
#    -> SCHEMA CHECK PASSED

# 4. Apply the schema, copy every row, verify counts AND per-table SHA-256 digests.
dotnet run --project tools/Move.DataMigration -- --migrate --truncate
#    -> MIGRATION VERIFIED

# 5. Referential integrity, case parity, sequence state, index usage.
docker exec -i move-postgres psql -U move -d move -v ON_ERROR_STOP=1 < scripts/postgres-verify.sql
```

Useful variants:

| Command | Effect |
|---|---|
| `--verify-only` | Compare without copying |
| `--migrate-only` | Apply schema, copy nothing |
| `--dump <Table>` | Show both engines' normalised rows and mark the first difference |
| `--auto` | initContainer mode: migrate / skip / **refuse** |
| `--help` | Usage |

---

## 4. What was actually verified on the rehearsal

Not a plan — a record of what was run and what it printed.

| Check | Result |
|---|---|
| `--check-schema` against the live source | **PASSED** — 12 planned tables matched; only `__EFMigrationsHistory` noted as intentionally excluded |
| Copy + verify, all 12 tables | **MIGRATION VERIFIED** — every table matching by row count and SHA-256 digest |
| Orphan checks (boxes→moves, items→boxes, images→boxes, members→moves, members→users) | **0** on every check |
| `citext` case-insensitive equality | `brunanahi@icloud.com` / `BRUNANAHI@ICLOUD.COM` / mixed all return the **same 1** row |
| `ILIKE` search case parity | `cozinha` / `CoZiNhA` / `COZINHA` all return the **same 5** boxes |
| Wildcard escaping | literal `%` returns **0** rows, not all 39 |
| Trigram index actually usable | `Bitmap Index Scan on IX_Boxes_Label` (forced plan), `pg_trgm` 1.6, `gin_trgm_ops` present |
| Sequence resync | two consecutive inserts into `AspNetRoleClaims` succeeded and the id advanced 2 → 3 |
| Real application against migrated data | provider `PostgreSql`, version **17.11**, `NpgsqlConnection`; **APP CHECK PASSED** |
| Health endpoints with the migrated database | `/api/health/live` and `/api/health/ready` both **200 Healthy** |
| Full test suite | **127 passed, 0 failed** (60 domain + 46 application + 21 server) |
| Clean-room repeatability | `database update 0` → `database update` → `--truncate` → **MIGRATION VERIFIED** again, identical digests |
| `--auto` with a completion marker | **skips** ("Migration already completed") |
| `--auto` with data and **no** marker | **REFUSES**, exit code **3** |
| Same-endpoint guard (`--target` = source, with `--truncate`) | **REFUSED**, exit code **2** — and the data survived |

The last three matter more than they look: they are the paths that decide whether a
half-migrated database can ever be served, and whether a mis-aimed `--truncate` can empty
the system of record.

---

## 5. The one engine bug this project found

`Moves.TargetDate` (a nullable SQL Server `date`) could not be verified. The copy was
**correct** — the target stored exactly `2026-11-26` and the two NULLs — but the verifier
reported a `MISMATCH`, because its normaliser formatted `DateTime` and `DateTimeOffset`
explicitly and had **no `DateOnly` branch**, so a `DATE` fell through to the invariant
general format (`11/26/2026`) while the other engine produced
`2026-11-26T00:00:00.000000`.

A plan cannot work around it: a column's declared `NpgsqlDbType` governs only the binary
`COPY` **write**; verification reads raw CLR values.

Fixed in the shared engine as **`FpsSoftware.DataMigration` 1.1.3** (a DATE renders at
midnight with the same pattern as a DateTime). This is why Move's tool references 1.1.3
and not 1.1.2, and why the fix lives in the package rather than in this repository — it
would otherwise be re-earned by the next project.

> Also fixed by this migration, as a plain regression: the server tests silently depended
> on the old `#if DEBUG` branch to get the in-memory store. With provider selection moved
> to runtime they now select it **explicitly**, which is both more honest and the reason
> the search tests could be moved onto a real PostgreSQL.

---

## 6. Semantic changes that are invisible but real

These do not fail loudly; they change meaning. All are addressed in code.

| Change | Where | Why it matters |
|---|---|---|
| `LIKE` is case-**sensitive** | `SearchService` now uses inline `EF.Functions.ILike` | SQL Server's `_CI_` collation made `LIKE` case-insensitive. Searching `COZINHA` returned 5 rows before; on a plain `LIKE` it would silently return **0**. |
| `%` and `_` are **wildcards** | `TextSearch.Escape`, passed as `ESCAPE '\'` | A search for `50%` would otherwise match **everything**. Escaping backslash first, then `%`, then `_`. |
| Equality is case-**sensitive** | `MoveMembers.Email` mapped to **`citext`** | A member looked up by email; without it `Bruna@x.com` and `bruna@x.com` become two different people. |
| Leading-wildcard search has no B-tree path | GIN trigram indexes on `Boxes.Label`, `Boxes.Room`, `BoxItems.Description` | `ILIKE '%term%'` cannot use a B-tree index, so search would be a sequential scan of every row. |
| `datetime2(7)` → microseconds | `timestamp with time zone` | 100 ns → 1 µs truncation, formatted to 6 digits on both sides when hashing. |
| UUID ordering differs | the engine orders by **text** on both sides | SQL Server sorts `uniqueidentifier` by its last six bytes; Postgres sorts bytewise. A naive `ORDER BY` reports false mismatches. |

`citext` is for **equality** columns only — it is incompatible with `pg_trgm` operator
classes, so making a searched column `citext` would cost it its trigram index.

---

## 7. Cutover — WHAT ACTUALLY HAPPENED

**Chosen: stop the application.** Scale to zero, migrate, verify, start. This removes the
data-loss window *by construction* — with nothing serving, nothing can write during the
copy. The cost is a bounded outage of minutes; the alternative risks silent data loss.

**Executed 2026-10-12. Completed successfully.** Total outage: roughly **4 minutes**,
most of it spent on the failure in §7.2. The migration itself took **9 seconds**.

### 7.1 The run, in order, with what each step printed

| # | Action | Result |
|---|---|---|
| 0 | Merge the migration MR | CI published the new Npgsql image |
| 1 | **Verify the image by RUNNING it** (in-cluster probe) | `Npgsql.dll` present, **no** `sqlclient`, `/app/migrator/Move.DataMigration.dll` executes |
| 2 | Pre-flight: role owns database | `move` owns `move` ✓ |
| 3 | Pre-flight: role attributes | `move\|f\|f\|f\|t` — no superuser/createdb/createrole ✓ |
| 4 | Pre-flight: extensions | `citext`, `pg_trgm` ✓ |
| 5 | Pre-flight: `move_migrator` reads | returned the row count ✓ |
| 6 | Pre-flight: `move_migrator` writes | **`The UPDATE permission was denied`** ✓ |
| 7 | Record pre-window source counts | Boxes 40, BoxItems 165, Moves 3, Users 4 |
| 8 | `--check-schema` against **live production** | **SCHEMA CHECK PASSED** |
| 9 | **Scale to 0**, wait for pods to terminate | zero pods |
| 10 | Confirm no app connections to SQL Server | only the admin session remained |
| 11 | Run the Job (`--migrate --truncate`) | **MIGRATION VERIFIED** — 12/12 tables |
| 12 | Independent orphan checks | **0** on all 5 relations |
| 13 | `citext` / `ILIKE` / wildcard checks | 1/1, 5/5, and literal `%` → **0** |
| 14 | Re-seal `MoveDB` → PostgreSQL, apply | secret repointed, 10 keys intact |
| 15 | Scale to 1 | **crash-loop — see §7.2** |
| 16 | Fix the image pin, roll out | `successfully rolled out` |
| 17 | Health endpoints | `/api/health/live` and `/ready` → **200 Healthy** |
| 18 | Confirm the switch | SQL Server app connections **0**; PostgreSQL `move` connected, idle |
| 19 | Restore automation (both halves, one commit) | verified in cluster; **nothing reverted** |

The migration Job's own output is the primary evidence — it prints per-table counts and
digests, and exits non-zero on any mismatch:

```
Verification (source vs target)
  table                  source   target  digest             result
  Moves                       3        3  d7ab6a2392f5db1e   ok
  Boxes                      40       40  13c5095c716da5b7   ok
  BoxItems                  166      166  d3ce7cd52a7d500b   ok
  MoveMembers                 4        4 5520310d3e9d9e0f   ok
  ...
MIGRATION VERIFIED: every table matches the SQL Server source row for row.
```

> Note `BoxItems` was **166** at copy time (it had been 165 when the counts were
> recorded minutes earlier). Live data moves under you; the digest is what makes that
> safe to accept — it proves the copy matches whatever the source held at the moment
> of the read, not what you wrote down beforehand.

### 7.2 THE ONE THING THAT WENT WRONG — read this before your next cutover

**Symptom.** After repointing `MoveDB` at PostgreSQL and scaling to 1, the pod
crash-looped with:

```
System.ArgumentException: Keyword not supported: 'host'.
   at Microsoft.Data.SqlClient.SqlConnectionString..ctor(...)
   at Microsoft.EntityFrameworkCore.SqlServer.Storage.Internal.SqlServerConnection.CreateDbConnection()
```

**This is not a bad connection string.** Read the **types** in the stack:
`Microsoft.EntityFrameworkCore.SqlServer.*`. The running binary was the
**pre-migration, SQL-Server-only build**. It was handed a correct PostgreSQL string, and
`Microsoft.Data.SqlClient` does not know the keyword `host`.

**Root cause.** The Deployment was pinned **by digest** in `move/kustomization.yaml`, and
that pin still named the old image (`sha256:fb1a8024…`). The new digest had been pinned in
git — but the **freeze disabled `selfHeal`**, so Argo had not applied it. `kubectl scale`
does not re-resolve a tag or a git pin: it reuses the **existing pod template**, which
still carried the old digest. So scaling back up faithfully restarted the old build.

This is one failure with two independent lessons, both already in
[`CUTOVER_LESSONS.md`](CUTOVER_LESSONS.md) §2.3 and
[`MIGRATION_TEMPLATE.md`](MIGRATION_TEMPLATE.md) §8b — and it still happened, because
knowing the trap is not the same as not walking into it.

| Lesson | What to do instead |
|---|---|
| **The pipeline publishes; a pin decides.** These are two different acts, and a cutover that only does the first looks complete and serves the old code. | Update the pin **as its own step** with its own check. Do not assume CI publishing `:latest` moved anything. |
| **A frozen Argo cannot apply your pin.** With `selfHeal` off, nothing converges git into the cluster — including the fix you just committed. | While frozen, apply the image **explicitly** (`kubectl patch deploy` or `kubectl set image`), then reconcile git afterwards. |

**The fix was one command**, because the correct digest had already been verified by
running it (§7.1 step 1):

```bash
kubectl -n move patch deploy move --type strategic \
  -p '{"spec":{"template":{"spec":{"containers":[{"name":"move","image":"...@sha256:6153f619..."}]}}}}'
```

**A precaution that made restoring automation safe.** Before re-enabling Argo, confirm the
cluster is **not ahead of git** — otherwise `selfHeal` reverts the working cluster back to
git's older state. Checked with:

```bash
kubectl kustomize move | grep image:                # what git would deploy
kubectl -n move get deploy move -o jsonpath='{.spec.template.spec.containers[0].image}'
# both printed sha256:6153f619… -> safe to restore
```

**The general rule this earns.** Verify the image by **running it**, not by reading the
tag — and do that check *before* the window, so that if it goes wrong mid-cutover you
already know which digest is correct and the fix is a one-liner rather than a rebuild.

### 7.3 The 401 that is not a failure

A migrated `PasswordHash` is intact, but the production password is unknown, so login
legitimately returns 401. **Do not conclude the migration failed because login fails.**
Distinguish "hash corrupt" from "password unknown" by testing candidates with
`PasswordHasher<object>()`, then reset through the app's own flow.

On Move this was verified directly: all four hashes decoded as valid ASP.NET Identity
**v3** hashes and none matched common candidates. Nothing was corrupt.

> **Move has no password-reset endpoint** — only `register`, `login`, `refresh`. The
> pilot had `GET api/users/generate-password/{id}`. If a user cannot log in after the
> cutover there is currently **no in-app recovery path**; that is a product gap, not a
> migration defect, and it is worth closing before you need it.

### 7.4 What "verified" meant, concretely

Not "the Job exited 0". The evidence gathered was:

- per-table **row count and SHA-256 digest**, matching on all 12 tables;
- **orphan checks = 0** on every foreign key (counts alone cannot catch a bad copy order);
- **semantic parity on real data**: `citext` equality case-insensitive, `ILIKE` search
  case-insensitive, literal `%` not treated as a wildcard;
- both **health endpoints 200**, with `/ready` including the database probe;
- **SQL Server app connections = 0** and **PostgreSQL connected** — the switch is real,
  not just configured;
- the item count **grew after the copy** (166 → 169), which proves the application is
  *writing* to PostgreSQL, not merely reading it.

---

## 8. Rollback — state the data loss honestly

| Situation | Action | Data loss |
|---|---|---|
| Anything fails before the `MoveDB` switch | none needed; the app still points at SQL Server | none |
| Final copy fails | re-point/replica back; site returns | none |
| Failure after the switch, **before** any content is authored | re-seal the old string **and restore the old image digest** | none |
| Failure after content **was** authored in Postgres | reverting loses it | the writes since the switch |

That last row is the real decision. Write it down before the cutover, not during it.

> **Rollback needs TWO steps, not one.** The pilot's rollback story ("re-seal the old
> string") is incomplete now that the image is pinned by digest: the running binary
> *only speaks Npgsql*, so re-sealing `MoveDB` at SQL Server without also reverting the
> **image digest** leaves a crash-looping pod. Repoint the connection string **and** the
> image together, or neither.

Keep SQL Server **read-only** for a rollback window. Do not drop it as part of this work.
On Move, SQL Server is untouched and still holds the pre-cutover data.

---

## 9. After — the checklist, with Move's status

- [ ] **Add the PostgreSQL database to the backup schedule.** The SQL Server backup no
      longer protects this data — the most commonly forgotten step. **OUTSTANDING.**
- [ ] Rotate the migrator and application passwords; they pass through chat and shell
      history. **OUTSTANDING.**
- [ ] Decommission SQL Server only after the rollback window, after a verified backup, and
      as its own deliberate change.
- [ ] Remove the scaffolding once the rollback window closes and no re-verification is
      planned: `mssql` service + `mssql-data` volume from `compose.yaml`, `.backup/*.dacpac`,
      the read-only SQL Server login.
- [ ] **Do not remove the migrator tool per project** — it is shared. It is removed once,
      when the programme finishes.

Keep the app-side work **permanently**: `citext`, `pg_trgm`, `TextSearch`, the GIN
indexes, and runtime provider selection. None of that is scaffolding.

### What to carry forward to the next project (EconoFlow)

1. **Pre-flight checks are cheap and they all passed** — role ownership, the read-only
   login's *denied* UPDATE, extensions. Do them before the window; each one is a failure
   you do not discover mid-outage.
2. **`--check-schema` against live production first.** Read-only, seconds, and it is what
   makes the copy itself uneventful.
3. **Verify the image by running it, and resolve the digest, BEFORE the window.** The one
   thing that went wrong was survivable *because* this had been done first.
4. **While Argo is frozen, apply image changes explicitly.** A freeze also freezes your
   ability to deploy through git.
5. **After restoring automation, prove nothing reverted** — check the digest, the secret
   and the pod health again, then confirm the cluster matches `kustomize build`.
6. **Record pre-window counts AND accept that they drift.** The digest is the contract.
7. **Budget attention for plumbing, not data.** 216 rows copied in 9 seconds; the outage
   was almost entirely the image pin.

