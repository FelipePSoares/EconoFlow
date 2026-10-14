# WhiteLabel → PostgreSQL: the cutover in hindsight

Everything learned doing this migration for real, twice (BFS and Gelosorio), on a
live cluster. Written so the **next** migration is routine.

This is the *operational* record. It sits alongside:

| Document | Answers |
|---|---|
| [`DATABASE_MIGRATION.md`](DATABASE_MIGRATION.md) | how the tool works, the pitfalls in depth |
| [`MIGRATION_TEMPLATE.md`](MIGRATION_TEMPLATE.md) | the generic per-project order of work |
| [`WHITELABEL_NOTES.md`](WHITELABEL_NOTES.md) | what is different about *this* repo |
| **`CUTOVER_LESSONS.md`** (this file) | **what actually happened, and what to do differently** |

---

## 1. The one-page order of work

Follow this literally. Every step earned its place by something going wrong.

```
A. ACCOUNTS (no downtime)
     - PostgreSQL role + database, and the role must OWN both
     - citext extension, `Admin` schema owned by the role
     - SQL Server read-only migrator login
     - seal credentials into the site's SealedSecret
     - VERIFY the role owns the db: expect `site|site`, not `postgres|site`

B. FREEZE (no downtime) — BEFORE any image is published
     - comment out the Image Updater entry for THIS site
     - remove syncPolicy.automated from the site's Argo Application
     - MERGE it  ← the freeze is not real until it is on main
     - force Argo to reconcile, then VERIFY IN THE CLUSTER
         kubectl -n shared-services get application <site> -o jsonpath='{.spec.syncPolicy}'

C. IMAGE (no downtime)
     - build/publish from the branch that carries the engine version you need
     - VERIFY BY RUNNING IT, not by reading a tag
     - pin the migration Job to that digest

D. SCHEMA (no downtime)
     - run each host's --migrate-only
     - confirm --check-schema PASSES for both hosts

E. THE OUTAGE (minutes)
     - announce it
     - scale to 0, confirm ZERO SQL Server connections
     - copy + verify each host; both must print MIGRATION VERIFIED
     - repoint the secret's DefaultConnection at PostgreSQL
     - scale to 1

F. VERIFY
     - every page 200, both health endpoints
     - orphan checks = 0
     - the ambiguity check (see §4)
     - SQL Server connections = 0, PostgreSQL > 0

G. RE-ENABLE (one commit, both halves)
     - restore the Image Updater entry AND syncPolicy.automated TOGETHER
     - merge, force reconcile, verify in the cluster
```

---

## 2. The five things that actually bit us

### 2.1 `localhost:5432` was PRODUCTION

**The worst one.** A rehearsal intended for a local container copied 24,532 rows
into the **cluster's** database.

Port 5432 on the workstation was held by **Headlamp**, port-forwarding the cluster's
PostgreSQL. So `Host=localhost;Port=5432` never reached Docker — it reached
production. The tool reported `MIGRATION VERIFIED` and the local database stayed
**empty**, which is how it was eventually noticed.

**Fix:** the rehearsal PostgreSQL publishes on **host port 5433**
(`compose.yaml`), and both migration profiles default to 5433.

**Rule:** before any rehearsal run, prove which database you are talking to —
they are distinguishable by content:

```bash
docker run --rm -e PGPASSWORD=postgres postgres:17-alpine \
  psql -h host.docker.internal -p 5432 -U postgres -d postgres -tAc \
  "SELECT string_agg(datname, ',' ORDER BY datname) FROM pg_database WHERE datname NOT LIKE 'template%';"
```

```
5432 -> bfs,cesarbarbosa,gelosorio,stalwart   <- THE CLUSTER
5433 -> construtorabfs,gelosorio               <- local
```

### 2.2 A committed freeze is not an applied freeze

Twice.

**BFS:** after merging the freeze, the live Application still had
`automated: {prune: true, selfHeal: true}`. Argo reconciles every **600s** and had
last polled days earlier. It took a forced refresh.

**Gelosorio:** the freeze sat on an *unmerged branch*, so `selfHeal` was still on —
and it silently reverted a newly applied 5-key Secret within seconds. The controller
log said `Unsealed successfully` followed by `update suppressed, no changes in spec`,
and `apply` reported conflicts with `argocd-controller`.

**Rule:** after merging a freeze, force a refresh and **check the cluster**:

```bash
kubectl -n shared-services patch application root-app --type merge \
  -p '{"metadata":{"annotations":{"argocd.argoproj.io/refresh":"hard"}}}'
kubectl -n shared-services get application <site> -o jsonpath='{.spec.syncPolicy}'
# expect: {"syncOptions":["CreateNamespace=true"]}   — no "automated"
```

### 2.3 The image decided what ran, not the pipeline

The Image Updater writes the new digest straight into `kustomization.yaml` on main.
It did so **during the Gelosorio cutover** (`build: automatic update of gelosorio`),
and before the BFS freeze it deployed a new image that crash-looped against the
still-SQL-Server database — because the migrated image **always selects Npgsql** and
therefore *cannot* start against the old database.

**Rule:** freeze the updater before publishing anything. And when re-enabling,
compare the running digest against `:latest` **by running both** — advancing a pin
should be deliberate, not a side effect (see §3).

### 2.4 Npgsql needs Kerberos libs the aspnet image lacks

`Cannot load library libgssapi_krb5.so.2` appears on every connection. It is
**cosmetic** — Npgsql probes for optional GSSAPI support and continues. Connections
succeed. It would only matter for integrated authentication, which needs
`libgssapi-krb5-2`. Do not chase it.

### 2.5 `.NET string literals are UTF-16` — grep accordingly

Used three times to "prove" something was missing from an image when it was present.

```bash
tr -d '\000' < /app/WhiteLabel.dll | grep -c SCHEMA_NAME    # correct
grep -c SCHEMA_NAME /app/WhiteLabel.dll                     # WRONG: always 0
```

This nearly caused an unnecessary image rebuild.

---

## 3. Verify by RUNNING, never by reading

Tags move. Two digests existed for the same code and there was no way to tell from
the tag which was which.

**To compare two images**, run each and hash the assemblies:

```bash
md5sum /app/WhiteLabel.dll /app/migrator/admin/WhiteLabel.AdminDataMigration.dll
tr -d '\000' < /app/migrator/admin/FpsSoftware.DataMigration.dll \
  | grep -oE '1[.][0-9]+[.][0-9]+' | sort -u
```

**To confirm a migrator can do its job**, run `--check-schema` from inside the
cluster against the live source. It is read-only and it is the real gate.

---

## 4. The check that catches the worst failure

`Products` exists in **both** `dbo` (the site catalogue) and `Admin` (the ordering
module's list) as two unrelated tables.

If a copy resolves the wrong one it **still reports MIGRATION VERIFIED** — because
the digest compares the target against whatever the source query returned. A wrong
answer that passes its own check.

So after every migration, assert that two same-named tables have **different** counts:

```sql
SELECT 'public.Products' AS t, COUNT(*) FROM "public"."Products"
UNION ALL SELECT 'Admin.Products', COUNT(*) FROM "Admin"."Products";
-- 15 vs 32 — if equal, the copy read the wrong table
```

This is why the engine now **refuses** to resolve an ambiguous bare name rather than
guessing.

---

## 5. Engine versions, and why there were three

The shared engine was written for a single-schema application (the pilot). WhiteLabel
is the first consumer with a second schema, and it took three fixes — each exposed by
running against **real** data, not by reading code:

| Version | What was broken |
|---|---|
| 1.1.0 | `Quote` wrapped the whole table name, so `Admin.Orders` became the single identifier `"Admin.Orders"` — a name containing a dot. `42P01: relation does not exist`. |
| 1.1.1 | The catalog reader returned bare `t.name`, so `--check-schema` reported all 7 Admin tables as `MISSING TABLE`. |
| 1.1.2 | 1.1.1 **broke the public plan**: it spelled tables bare (`Users`) while the catalog now said `dbo.Users`. Fixed by accepting a bare name when exactly one catalog table has it — and refusing when two do. |

**The lesson:** an empty test database cannot find these. BFS had zero Admin rows, so
it passed; Gelosorio's 24,532 rows exposed all three. **Always rehearse against a
copy of the real database.**

---

## 6. Findings that were NOT bugs

| Symptom | Reality |
|---|---|
| `Cannot load library libgssapi_krb5.so.2` | cosmetic; Npgsql probing GSSAPI |
| `Admin.__EFMigrationsHistory does not exist` | EF keeps ONE history table in the default schema; `HasDefaultSchema` does not move it. Assert two rows in the public table. |
| Two contexts, one history table | both baselines share `public.__EFMigrationsHistory`. Normal. |
| `--check-schema` reports `__EFMigrationsHistory` as not migrated | it is not supposed to be; the plan excludes it |
| Engine reports a bare name as `MISSING TABLE` | correct when the name is ambiguous — qualify the plan |
| Argo reverted an applied manifest | `selfHeal`, working as designed. Commit it. |

---

## 7. Checklist

**Before the window**
- [ ] role owns the database (`site|site`), `citext` present, `Admin` schema owned
- [ ] migrator login exists — verify `exists=1`, and that UPDATE is **denied**
- [ ] secret has all keys; decoded and eyeballed
- [ ] freeze merged **and verified in the cluster**
- [ ] **the APPLICATION starts against a real PostgreSQL** and reaches
      `/api/health/ready` 200 — not `dotnet ef`, not the migration tool (§9.1). If the
      project has more than one `DbContext`, confirm **both** migration sets are applied
- [ ] **`MigrationsAssembly` is set in the RUNTIME registration** (not only in the
      design-time factories) **and** the start-up project references that assembly, so it
      ships in the image (§9.3)
- [ ] image verified **by running it**; **resolve and record the digest**; Job pinned to it
- [ ] `--check-schema` PASSES for every host
- [ ] rehearsed against a copy of the real database, on an isolated port
- [ ] pre-window row counts recorded

**During**
- [ ] app at 0 replicas, **zero SQL Server connections** — query `sys.dm_exec_sessions` and
      confirm the only session is your own; anything written to the source during the copy
      is lost silently (§9.5)
- [ ] every host: copy → `MIGRATION VERIFIED`
- [ ] ambiguity check: same-named tables differ
- [ ] secret repointed; **image digest applied explicitly** (a frozen Argo will not do it)
- [ ] app starts and logs `Schema verified` (or manages it)
- [ ] every page 200, both health endpoints

**After**
- [ ] orphan checks = 0
- [ ] SQL Server connections 0; PostgreSQL > 0
- [ ] **cluster matches `kustomize build`** before restoring automation (else `selfHeal` reverts your fix)
- [ ] automation restored — **both halves, one commit** — and verified in the cluster
- [ ] **`kubectl apply` the restored `Application` and `ImageUpdater`** — Argo does not
      manage its own Application resource, so a committed restore is not an applied one,
      and the app stays frozen silently until the next release discovers it (§9.4)
- [ ] re-checked after reconcile: digest, secret and pod health **unchanged**
- [ ] **databases added to the backup schedule** (most commonly forgotten) — and if the
      schedule already exists, **trigger a run** rather than trust it: a schedule that has
      not fired since the cutover has not backed up the cutover (§9.6)
- [ ] SQL Server kept read-only for a rollback window, then retired separately
- [ ] **rotate the migrator and app passwords** — they pass through chat and shell history

---

## 8. Move — the second completed cutover (2026-10-12)

Move is the second project through this procedure after the pilot, and the first to
migrate on a **single schema** with a **single `DbContext`**. It completed successfully:
216 rows across 12 tables, verified by digest, ~4 minutes of downtime of which the copy
took **9 seconds**.

Its full record is [`MOVE_CUTOVER.md`](MOVE_CUTOVER.md). What the programme should take
from it:

### 8.1 The pin bit us AGAIN — and now we know exactly how

The pilot's §2.3 says "the image decided what ran, not the pipeline". Move reproduced it
in a *new* shape worth adding to that lesson:

> **When Argo is frozen, YOU must apply the pin.** The freeze removes `selfHeal`, which is
> the mechanism that converges git into the cluster — so a digest you commit while frozen
> is simply not applied. `kubectl scale` makes this worse: it reuses the **existing pod
> template**, so scaling back up faithfully restarts the *old* image. The symptom is a
> crash-loop whose stack trace names `Microsoft.EntityFrameworkCore.SqlServer.*`, i.e. the
> old provider, against a connection string that is perfectly correct.

The two acts, restated because they still get conflated:

1. CI publishes a new build and moves `:latest`.
2. Someone updates the **pin** — or, while frozen, patches the Deployment directly.

**And the rollback story needs updating** (this is new): reverting a cutover is now
**two** steps. Re-sealing the connection string back to SQL Server without also reverting
the **image digest** leaves a pod that only speaks Npgsql crash-looping against SQL
Server. On the pilot the rollback table said "re-seal the old string"; that is no longer
sufficient. Move's §8 records the corrected version.

### 8.2 Verify the digest by RUNNING it, and do it before the window

The one thing that went wrong was survivable **only** because the correct digest had
already been resolved and its contents proven by running it (Npgsql present, `sqlclient`
absent, `/app/migrator/...dll` executes). That turned a mid-outage rebuild into a
one-line patch.

An in-cluster probe is the reliable way — registry credentials are scoped to the node, so
a workstation often cannot pull the private image:

```yaml
# throwaway pod using the app's own pull secret
imagePullSecrets: [{ name: gitea-registry }]
containers:
  - name: probe
    image: <registry>/<app>:latest
    imagePullPolicy: Always
    command: ["sh","-c","ls /app | grep -i npgsql; ls /app | grep -i sqlclient; echo OK"]
# then read the real digest:
kubectl get pod <probe> -o jsonpath='{.status.containerStatuses[0].imageID}'
```

### 8.3 An engine bug that only a widened `date` column could expose

Move had a nullable SQL Server `date` (`Moves.TargetDate`). The copy was **correct** —
the target stored exactly the right dates — but verification reported `MISMATCH` for
identical data, because the engine's normaliser formatted `DateTime`/`DateTimeOffset`
and had **no `DateOnly` branch**, so a DATE rendered as `11/26/2026` on one side and
`2026-11-26T00:00:00.000000` on the other.

**A plan cannot work around this.** A column's declared `NpgsqlDbType` governs only the
binary `COPY` **write**; verification reads raw CLR values. Fixed in
`FpsSoftware.DataMigration` **1.1.3**, which renders a DATE at midnight with the same
pattern as a DateTime.

**The programme lesson:** this was found *only* because Move rehearsed against a real
production snapshot. An empty database has no DATE values and would have passed every
check — exactly as BFS's empty second schema hid the three engine bugs the pilot found.
**Always rehearse against a copy of the real database.**

### 8.4 A regression that a compile-time provider had been hiding

Moving provider selection from `#if DEBUG` to runtime **broke the server tests**, which
had silently relied on the Debug branch to get the in-memory store. They passed on
`main` before the change. This is the migration-template §4 item "move provider
selection from compile time to run time" — and it has a cost that the template did not
mention: **anything depending on the old implicit behaviour breaks, and tests are the
usual casualty.** Expect it and fix the tests to select the provider **explicitly**,
which is more honest anyway.

Relatedly: once search moved to `EF.Functions.ILike`, the in-memory provider **cannot
translate it at all**, so search tests have to run against a **real PostgreSQL**. Move
points them at the compose stack via an env var and *skips* (not fails) when it is
absent, so a checkout without Docker still goes green.

### 8.5 Small things worth copying

| Practice | Why |
|---|---|
| `scripts/postgres-provision.sql` and `scripts/sqlserver-readonly-login.sql` as reviewable artifacts | Section A was prose before; Move made it two idempotent, verifiable scripts. The Postgres one also strips `SUPERUSER`/`CREATEDB`/`CREATEROLE`, because `CREATE ROLE` only ever *adds* attributes — on a container where `POSTGRES_USER=<app>`, the role is already a superuser. |
| `scripts/ci-local.ps1` | Repeats the whole check and **proves port 5433 reaches the local container** before running any test. |
| An `--auto` refuse path exercised deliberately | Verified that "data present, marker absent" exits **3**; and the same-endpoint guard exits **2**. These are the paths that decide whether a half-migrated or self-copied database can ever be served. |
| `.backup/` gitignored in the GitOps repo | The plaintext Secret being sealed was stageable. Seal only the output. |
| Sealing verified by applying to a **throwaway namespace** and comparing values byte-for-byte | Passwords containing `% * @ ! $ # ^ &` must round-trip **verbatim**; doubling them breaks authentication. |
| Every `secretKeyRef` cross-checked against the sealed keys | A missing key stops a pod at `CreateContainerConfigError` and *looks* like bad credentials. |

### 8.6 Timings, for sizing the next one

| Step | Move |
|---|---|
| Data copy + verification (12 tables, 216 rows) | **9 seconds** |
| `--check-schema` against live production | seconds |
| The whole outage | ~**4 minutes**, almost all of it the image pin |
| The whole real work | the application-side port, done beforehand |

Confirms the pilot: **for databases this size the migration is trivially fast and the
risk is entirely in the plumbing** — images, digests, secrets, automation. Budget
attention accordingly, and treat the data copy as the easy part.

---

## 9. EconoFlow — the third completed cutover (2026-10-14)

EconoFlow is the first project in the programme with **two `DbContext`s and therefore two
migration sets**: `EasyFinanceDatabaseContext` and `MyKeysContext` (the Data Protection
key ring). Everything before it had one of each.

5,242 rows across 23 tables, verified by digest. Full record in
[`ECONOFLOW_PREFLIGHT.md`](ECONOFLOW_PREFLIGHT.md).

Its data copy was as fast as every other project's. Its **outage was not**, and every
minute of it came from the same source: *the application's own start-up path was the one
path rehearsal never exercised.* Three separate defects lived there, and they were found
one at a time, in production, in sequence.

### 9.1 The trap that cost the most: prototyping on `dotnet ef` instead of on the app

This is the single most transferable lesson in this document.

The rehearsal used `dotnet ef database update` to apply the schema, and used the
migration tool (`EconoFlow.DataMigration`) to copy. **Both worked.** The application did
not. Three defects were invisible to both:

| # | Defect | Why `dotnet ef` and the tool missed it |
|---|---|---|
| 1 | `MyKeysContext`'s migration was never applied | The engine migrates **one context per profile** — `MigrationProfile` exposes a single `CreateContext` hook and nothing else. The rehearsal applied the second context **by hand**, so the gap existed only in the tool's own path. |
| 2 | `MigrationsAssembly` was never set at **runtime** | Both design-time factories set it. Only `PersistenceServiceRegistration` did not. |
| 3 | The migrations assembly was not **shipped** in the app image | The Dockerfile copies it for `/app/migrator`. Nothing referenced it from `EasyFinance.Server`, so it never reached `/app`. |

Each surfaced only after the previous one was fixed, which is why the outage was long:
the app was a CrashLoop and every fix revealed the next wall.

**The rule this establishes:**

> **Rehearse through the application's own start-up, not through the tooling that
> surrounds it.** `dotnet ef`, a migration CLI, and a design-time factory are all
> *conveniences that paper over the runtime wiring*. If the production entry point is
> `dotnet EasyFinance.Server.dll`, then that is what the rehearsal must run — against a
> real PostgreSQL, with production provider selection.

A concrete check that would have caught all three in one shot, and belongs in every
project's pre-flight:

```bash
EasyFinanceDB="Host=…;Database=probe" ASPNETCORE_ENVIRONMENT=Production \
  dotnet run --project ./EasyFinance.Server          # must reach /api/health/ready 200
```

Defect 1 fails it at the copy. Defects 2 and 3 fail it at start-up. It takes a minute and
it needs no cluster at all.

### 9.2 Two contexts is not twice the work — it is a different shape of work

Everything in [`WHITELABEL_NOTES.md`](WHITELABEL_NOTES.md) about multiple *schemas* still
applies, but EconoFlow is the **multiple-contexts** case, which behaves differently:

- **Migration history is per context.** Both sets here share the default
  `__EFMigrationsHistory` because the migration IDs differ. Two contexts that ever
  generate the *same* ID would collide — give the second one
  `MigrationsHistoryTable` before it becomes a problem, not after.
- **The engine applies ONE context.** This is a property of the shared package, not a
  bug in EconoFlow. Any project with two contexts must apply the second one itself, from
  `CreateContext`, and the failure mode if you forget is
  `42P01: relation "X" does not exist` **at copy time** — after the schema step has
  already reported success.
- **A copied table implies a created table.** If `MigrationPlan` maps a table, some
  context's migration must create it. Nothing enforces that pairing; a test asserting
  "every planned source table exists in the target model" is the cheap guard.

### 9.3 Runtime provider selection needs THREE things, not one

The pilot's §2.3 says the image decides what runs. EconoFlow adds a subtler variant: when
the provider is chosen at **runtime** rather than compile time, selecting it is not enough.
Three independent wirings must agree, and only one of them is obvious:

1. **The provider** — `UseNpgsql` vs `UseSqlServer`.
2. **The migrations assembly** — `npgsqlOptions.MigrationsAssembly("…Persistence.Postgres")`.
   Unset, EF defaults to *the assembly containing the `DbContext`*, which is the **SQL
   Server** migration set sitting right beside it. The symptom is a lie:
   `PendingModelChangesWarning: The model … has pending changes`, when in fact the model is
   fine and EF is reading the wrong migrations.
3. **The assembly's presence in the image** — a `ProjectReference` from the start-up
   project. *Naming an assembly does not load it.* Without the reference the build
   succeeds and start-up dies with `FileNotFoundException: Could not load file or
   assembly`.

A compile-time `#if` provider hides all three, because the linker resolves them for you.
That is the real cost of moving to runtime selection, and it is worth paying — but pay it
with a test that asserts the **configured options**, not just the provider:

```csharp
context.GetService<IDbContextOptions>().Extensions
    .OfType<RelationalOptionsExtension>().First()
    .MigrationsAssembly.Should().Be("EasyFinance.Persistence.Postgres");
```

### 9.4 Applying the restore is a separate act from committing it

The pilot's §2.2 ("a committed freeze is not an applied freeze") has a mirror image that
this cutover discovered the hard way, **at the very end, after the site was already
healthy**:

> **A committed RESTORE is not an applied restore either.** Argo CD does not manage its
> own `Application` resource, and ImageUpdater does not manage its own CR. Committing
> `syncPolicy.automated` and the `namePattern` entry back to git changes **nothing** in a
> cluster that is still waiting for something to apply it.

The symptom is nasty because it is silent and looks like success: the site is up, the
tests pass, git is correct — and the app is still frozen, so the *next* CI publish will
never deploy. It would be discovered during an unrelated release, weeks later.

```bash
# Restoring needs BOTH, and neither is automatic:
kubectl apply -f apps/<app>.yaml
kubectl apply -f argocd-image-updater/image-updater.yaml
```

Add the apply to the restore step of the checklist, and verify by reading the **cluster**,
never the file:

```bash
kubectl get application <app> -n shared-services -o jsonpath='{.spec.syncPolicy}'
# expect: {"automated":{"prune":true,"selfHeal":true}, …}
```

### 9.5 The drift window is real, and it is silent

The first attempt at this cutover ran the copy **with the application still serving**. The
reasoning was that the app reads SQL Server and the tool writes PostgreSQL, so "nothing
conflicts".

That reasoning is wrong, and it is worth stating plainly because it is *intuitively*
appealing:

> The copy reads the source table-by-table over several seconds. Anything written to the
> **source** during that window is **silently absent** from the target. There is no error,
> no warning, and the verification step cannot detect it — verification compares source to
> target *at the end*, by which time both look consistent.

The evidence that it was not theoretical: between the two copies, `ExpenseItems` grew from
**2,469 to 2,472**. Three rows written by ordinary use while the site was up. They would
have been lost, and nothing would have said so.

`CUTOVER.md` §0 already says the copy must be "complete by construction rather than by
timing". This cutover is the worked example of why that sentence is load-bearing, and the
reason the sequence is: **scale to 0 → confirm zero source connections → copy**.

The confirmation is not optional and not a formality. Query the source and check *who* is
connected:

```sql
SELECT session_id, login_name, host_name, program_name
FROM sys.dm_exec_sessions WHERE database_id = DB_ID('econoflow');
```

Expect to see **only your own `sqlcmd` session**. An app session still present means a pod
has not finished terminating, and the copy would race it.

### 9.6 Everything else followed the existing playbook

Worth recording so the next project does not mistake these for new work:

| Step | Outcome |
|---|---|
| Freeze, both halves | Verified **in the cluster**, not in git — §2.2 |
| Sealing | The whole secret re-sealed, never just the new keys: applying a SealedSecret **replaces** it, so sealing two additions alone would have deleted the other eighteen |
| Credentials tested before sealing | Both connection strings exercised from **inside the cluster** over the real DNS names, and `UPDATE` confirmed **denied** on the source login |
| `--check-schema` on live production | **PASSED** first time; the plan written against a `.dacpac` matched the live catalog exactly |
| `libgssapi_krb5.so.2` warning | Cosmetic — §2.4. It appears on every connection. Do not chase it |
| Backup schedule | PostgreSQL **already had** a Daily config; the gap was only that the 02:00 run predated the cutover, so `econoflow` was skipped as empty. A manual `php artisan backups:run <schedule-id>` captured it (191 KB) immediately |

On that last row: the docs call the backup schedule "most commonly forgotten", and here it
was already configured — but **a schedule that has not yet run since the cutover has not
backed up the cutover**. Trigger one rather than waiting for the next window; the file is
the proof.

### 9.7 Timings, for sizing the next one

| Step | EconoFlow |
|---|---|
| Data copy + verification (23 tables, 5,242 rows) | **8 seconds** |
| `--check-schema` against live production | seconds |
| The clean outage (scale to 0 → copy → verify → scale up) | **~3 minutes** |
| The outage actually taken | **~50 minutes** — entirely the three start-up defects of §9.1 |
| Where the real work was | the application-side port, and the code review |

The copy is still the easy part. What changed for EconoFlow is that **the risk moved from
the plumbing into the application**, and the plumbing lessons (§2.2, §2.3, §8.1) were
already known and already followed.

> **For the next project: spend your rehearsal on the application's start-up path against
> a real PostgreSQL.** Everything else in this document is now well-trodden, and the
> remaining unknown is in your own `Program.cs`.


