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
- [ ] image verified **by running it**; **resolve and record the digest**; Job pinned to it
- [ ] `--check-schema` PASSES for every host
- [ ] rehearsed against a copy of the real database, on an isolated port
- [ ] pre-window row counts recorded

**During**
- [ ] app at 0 replicas, **zero SQL Server connections**
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
- [ ] re-checked after reconcile: digest, secret and pod health **unchanged**
- [ ] **databases added to the backup schedule** (most commonly forgotten)
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

