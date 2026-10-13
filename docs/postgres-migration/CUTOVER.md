# Cutover runbook — SQL Server → PostgreSQL

How to move CesarBarbosa's data off the shared SQL Server onto the shared PostgreSQL.

This is a *procedural* document and is deliberately separate from
[`DATABASE_MIGRATION.md`](DATABASE_MIGRATION.md):

| Document | Answers |
|---|---|
| `DATABASE_MIGRATION.md` | *How does the migration work, and how do I repeat it on another project?* (the tool, the pitfalls, the generic runbook) |
| **`CUTOVER.md`** (this file) | *How do I actually perform this switch on this cluster, this week?* |

Read the pitfalls section of `DATABASE_MIGRATION.md` (Part 3) before running this. Everything
here assumes that work is already done and merged.

---

## 0. The decision

**Chosen: stop the application, migrate, then start it. An explicit outage of a few minutes.**

The deployment is scaled to **zero**, the migration runs with the site down, and the deployment is
scaled back up. This is the simplest correct design and it removes the data-loss window entirely:
with nothing serving, nothing can write to SQL Server while the copy runs, so the copy is complete
by construction rather than by timing.

### Why this over the initContainer-without-freeze

An earlier draft ran the migration from the Deployment's initContainer with no freeze. That is a
real option and the tool still supports it (`--auto`), but it carries a window — the copy plus the
rollout, likely 1–3 minutes — during which the old pod is still serving and **anything written to
SQL Server is lost**, because it is not in the copy and nothing reads SQL Server afterwards.

Stopping the application trades that risk for a known, bounded outage. For this site the trade is
clearly worth it: the exposure from the no-freeze path is silent data loss, whereas here the cost
is a few minutes of downtime on a low-traffic photography site, announced in advance.

**Both paths use the same tool and the same marker.** The marker still matters: it is what makes a
re-run safe, and it is what stops a *partially* migrated database from ever being served.

| Target state | Action |
|---|---|
| empty, no marker | **migrate**, verify, write the marker |
| marked complete | **skip** (a restart costs seconds, not a re-copy) |
| data present, no marker | **refuse** — the pod fails, and a half-migrated database is never served |

### What this buys, and what it costs

Bought:

1. **No data-loss window.** The comment count cannot differ, because nothing could write.
2. **Unambiguous rollback.** While the site is down, falling back to SQL Server costs nothing —
   there is no Postgres-side content to lose yet. See §6.
3. **A simpler mental model.** No reasoning about two pods racing, no `maxSurge` concern.

Cost:

- **A few minutes of downtime**, which must be announced. The copy itself is small (1,505 rows
  across 15 tables), so the dominant cost is the pod rollout, not the data.

The failure mode to guard against is the reverse of the no-freeze path: **do not scale up before
the migration has been verified.** The migration must report `MIGRATION VERIFIED` before
`replicas: 1` is applied, or the site serves an empty database.

## 0.1. What could still go wrong

Stated because this plan has not been run against production:

- **The plan may not match the live schema.** The tool was verified against a dacpac snapshot that
  is explicitly stale. Step 1 exists to catch this *before* anything is switched, and it is
  read-only.
- **The image has never been built.** The `Dockerfile` (app + migration tool in one image) is built
  by CI **on push to `main`**; the migration branch has been pushed but no image has been produced
  from it. The first CI run is the first build, and it must succeed before step 5 is attempted.
- **No cluster command in this document has been executed.** The manifests are syntax-validated and
  reviewed, not run.

Rejected alternatives, for the record:

- **initContainer with no freeze.** True zero-downtime without dual-write, and genuinely viable —
  but it accepts a silent data-loss window in exchange for avoiding an outage we are willing to
  take. Rejected on consequence, not on complexity. (The tool and the marker still support it,
  which is why `--auto` remains in the tool.)
- **Blue/green with both databases live.** Genuinely zero-downtime, but needs dual-write or a
  sync job, and introduces last-writer-wins conflicts. Complexity is not justified by one admin
  user and 11 posts.
- **`pgloader` straight from SQL Server.** Fewer bespoke pieces, but it would re-derive the type
  mapping that `DATABASE_MIGRATION.md` Part 3 painstakingly verified (`citext` semantics, uuid
  ordering, timestamp precision). Reusing the verified tool is safer than re-earning that trust.

---

## 1. What you are actually migrating

| | Source (today) | Target |
|---|---|---|
| Engine | SQL Server 2022 (shared) | **PostgreSQL 18** (shared) |
| Reached at | `mssql.shared-services.svc.cluster.local:1433` | `postgres.shared-services.svc.cluster.local:5432` |
| Database | `cesarbarbosa` | `cesarbarbosa` |
| Login | app login (currently `sa`-derived) | new `cesarbarbosa` role |
| Connection string env | `CesarBarbosaDB` | `POSTGRES_CONNECTION_STRING` → `CesarBarbosaDB` |
| Images | shared MinIO (bucket per app) | **unchanged — no image work at all** |

Both engines are **cluster-internal only** (no Ingress). This is the constraint that shapes the
mechanics: **the migrator must run as a pod inside the cluster.** A laptop cannot reach either
database, so every data step below is a Kubernetes Job, not a local `dotnet run`.

Images are explicitly out of scope. The application stores them in the shared MinIO through
`Image.StorageKey`, those keys do not change, and the bucket is untouched by this migration. The
migrated `Image` rows continue to resolve to the same objects.

### The live database is the only source of truth

`.backup/dump.dacpac` in the application repo is an **old development sample**. It is **not**
current production data and must never be the migration source. It exists only so the migration
can be rehearsed locally without touching production.

Nothing in this runbook depends on it. Both the data and the schema come from the **live** SQL
Server: data via the copy itself, schema via `--check-schema` (step 3.2). This is deliberate — a
schema dump goes stale as soon as anyone runs a migration, and **the next project will not have one
at all**, so the procedure has to be able to start from the live database alone.

---

## 2. Two properties of the cluster that will trip you up

**Argo CD owns this namespace.** The application is an Argo `Application` with
`syncPolicy.automated: {prune: true, selfHeal: true}`. Any change made with `kubectl` is reverted
on the next reconcile. **Every change below is a git commit**, not a live edit — including the
freeze. Editing the Deployment by hand will appear to work and then silently undo itself.

**A RollingUpdate will serve the empty database if you let it.** The Deployment is
`maxUnavailable: 0, maxSurge: 1`, and readiness only proves "Postgres reachable", not "data
loaded". The chosen design handles this by ordering: the site is scaled to zero, the migration is
run and **verified**, and only then is the app started against PostgreSQL. The marker still matters
as the guard against a *partial* migration — a target with rows but no marker is refused rather
than served.

---

## 2.5 Production execution — the ordered steps

A condensed, copy-pasteable version of Parts 3–5 for the chosen design (**stop the application,
migrate with the site down, start it**). Follow it top to bottom; each step states what to check
before moving on.

**Phase A (steps 1–4) happens with the site still running** and is safe to repeat. **Phase B
(steps 5–8) is the outage.** Everything in Phase B must be done in one sitting; if anything fails,
roll back per §6 rather than improvising.

### Step 0 — Get the image published (do this days before, not during)

**Nothing else can happen until this succeeds**, and it is the one step with a queue behind it.
CI (`.github/workflows/docker-publish.yml`) builds and pushes the image **on push to `main`** — the
migration branch alone produces no image.

Order of operations:

1. Merge `feat/migrate_postgres` into `main` (open the PR GitHub offered when the branch was
   pushed: `https://github.com/FelipePSoares/CesarBarbosa/pull/new/feat/migrate_postgres`).
2. CI runs. **Watch it** — this is the first build of this Dockerfile, ever.
3. Confirm the image exists and contains the migrator:

   ```bash
   docker pull gitea.fpssoftware.uk/fps-software/cesarbarbosa:latest
   docker run --rm --entrypoint ls \
     gitea.fpssoftware.uk/fps-software/cesarbarbosa:latest migrator/CesarBarbosa.DataMigration.dll
   ```

   The `ls` is the point: the Dockerfile publishes the tool to `/app/migrator`, and the app's
   `WORKDIR` is `/app`, so the path is `migrator/...` **relative to `/app`** — not `/app/migrator`.
   Getting this wrong is an initContainer/Job that fails with "no such file".

   > **Verify the image by RUNNING it, not by building it.** An earlier iteration of this tool was
   > built on `dotnet/runtime`, which lacks the `Microsoft.AspNetCore.App` framework the tool
   > transitively needs; the image built perfectly and died at startup. Build success is not
   > evidence.

4. Only then start Phase A.

> **If you would rather not merge to `main` yet:** CI is the only thing that publishes, so there is
> no way to get an image from a feature branch without changing the workflow trigger. Adding
> `workflow_dispatch` is the clean way to allow a manual build from a branch — worth doing if you
> want to rehearse the image before merging.

### Step 1 — Validate the plan against LIVE production (read-only, do this first)

Everything else is wasted effort if this fails, and this step changes nothing.

```powershell
# From the application repo, with network access to production SQL Server.
$env:MIGRATION_SOURCE = "Server=<prod-host>;Database=cesarbarbosa;User Id=sa;Password=<pwd>;TrustServerCertificate=True"
dotnet run --project tools/CesarBarbosa.DataMigration -- --check-schema
```

- **`SCHEMA CHECK PASSED`** → continue.
- **`MISSING TABLE` / `MISSING COLUMN` / `NO KEY COLUMN`** → **stop.** The plan does not match
  production. Update `MigrationPlan.cs` to match, re-verify locally against the Docker stack, and
  merge before going further.
- Note any `NOTE ... is NOT migrated` lines and confirm each is intended.

Record the live row counts now — step 8 compares against them:

```sql
-- on SQL Server
SELECT t.name, SUM(p.rows) AS rows FROM sys.tables t
  JOIN sys.partitions p ON p.object_id = t.object_id AND p.index_id IN (0,1)
 GROUP BY t.name ORDER BY t.name;
```

### Step 2 — Create the read-only SQL Server login

As `sa`, run [`../scripts/sqlserver-readonly-login.sql`](../scripts/sqlserver-readonly-login.sql)
against production. Then confirm the verification queries in that script report a row — if
`CREATE LOGIN` failed (weak password is the usual cause), the rest of the script still "succeeds"
against a login that does not exist.

Do **not** use this login for step 1; `--check-schema` reads the catalog, which `sa` already covers.

### Step 3 — Create the PostgreSQL role and database on the shared instance

```bash
kubectl -n shared-services exec deploy/postgres -c postgres -- psql -U postgres
```

```sql
CREATE ROLE cesarbarbosa LOGIN PASSWORD '<strong-password>';
CREATE DATABASE cesarbarbosa OWNER cesarbarbosa;
```

The `initdb` scripts do **not** help here — they run only on an empty `PGDATA`, so on the live
cluster this is a manual step. (The declarative equivalent in the server repo is for a future
rebuild.)

### Step 4 — Seal the connection strings into the app's secret

One secret, three keys. `CesarBarbosaDB` stays on **SQL Server** for now; it becomes the switch in
step 7.

```bash
# Recover the existing plaintext (never commit this file).
kubectl -n cesarbarbosa get secret cesarbarbosa-credentials -o yaml > cesarbarbosa-credentials.yaml
```

Add, base64-encoded:

| Key | Value |
|---|---|
| `CesarBarbosaDB` | the application's existing SQL Server string — **unchanged**. The app keeps using it until step 7. |
| `SQLSERVER_SOURCE_CONNECTION_STRING` | the **read-only** login from step 2: `Server=mssql.shared-services.svc.cluster.local,1433;Database=cesarbarbosa;User Id=cesarbarbosa_migrator;Password=<pwd>;TrustServerCertificate=True` |
| `POSTGRES_CONNECTION_STRING` | `Host=postgres.shared-services.svc.cluster.local;Port=5432;Database=cesarbarbosa;Username=cesarbarbosa;Password=<pwd>;SSL Mode=Disable` |

If `SQLSERVER_SOURCE_CONNECTION_STRING` is missing or mis-keyed, the migration step fails rather
than silently falling back — the tool has no default for its source. That is deliberate; before the
same guard existed, an unset target could have aimed a truncating copy at the source database.

```bash
pwsh -File ./scripts/seal.ps1 -SecretFile ./cesarbarbosa-credentials.yaml `
  -SealedFile ./cesarbarbosa/cesarbarbosa-credentials-sealed.yaml -Namespace cesarbarbosa
rm cesarbarbosa-credentials.yaml
```

Commit and push the sealed file. Confirm Argo has applied it:

```bash
kubectl -n cesarbarbosa get secret cesarbarbosa-credentials \
  -o jsonpath='{.data.POSTGRES_CONNECTION_STRING}' | base64 -d
```

> **Source login.** The migration Job takes its SQL Server string from a dedicated
> `SQLSERVER_SOURCE_CONNECTION_STRING` key, so the read-only login from step 2 is used for the
> migration and the application's own `CesarBarbosaDB` is left completely untouched. The
> alternative — pointing `CesarBarbosaDB` at the read-only login — also works, but it means a
> second copy of a SQL Server password to keep in step, and it changes the credential the running
> application uses at the same time as everything else.

Three keys, then, all in `cesarbarbosa-credentials`:

| Key | Value | Used by |
|---|---|---|
| `CesarBarbosaDB` | the application's current SQL Server string | the app, until step 7 |
| `SQLSERVER_SOURCE_CONNECTION_STRING` | the **read-only** login from step 2 | the migration Job's source |
| `POSTGRES_CONNECTION_STRING` | the PostgreSQL string | the migration Job's target; becomes `CesarBarbosaDB` at step 7 |

### Step 5 — Stop the application (the outage begins)

Announce the maintenance window first. Then, in `fps-software-server`, on the cutover branch, set
`replicas: 0` in `cesarbarbosa/deployment.yaml` — **as a git commit, not `kubectl scale`**, because
Argo's `selfHeal: true` reverts live edits.

```bash
git commit -am "cutover: scale cesarbarbosa to zero for the database switch"
git push
kubectl -n cesarbarbosa rollout status deploy/cesarbarbosa     # wait for the pod to go
kubectl -n cesarbarbosa get pods                               # must be empty
```

**The site is now down, and that is intended.** Confirm nothing is still writing before continuing:

```sql
-- on SQL Server; expect no connections for the app database
SELECT DB_NAME(dbid) AS db, COUNT(*) AS connections
  FROM sys.sysprocesses WHERE dbid = DB_ID('cesarbarbosa') GROUP BY DB_NAME(dbid);
```

Zero connections is the whole point of this design: with no writers, the copy in step 6 is complete
by construction, so no comment can be lost.

### Step 6 — Apply the schema and migrate the data

Run the migration as a one-shot Job (or by `kubectl exec` into a pod built from the app image).
The committed Job args are `["--migrate", "--truncate"]`, which is the correct first run: apply the
schema, truncate the target, copy, verify — all idempotent.

```bash
kubectl -n cesarbarbosa delete job cesarbarbosa-migrate --ignore-not-found
kubectl -n cesarbarbosa apply -f cesarbarbosa/migrate-job.yaml
kubectl -n cesarbarbosa logs -f job/cesarbarbosa-migrate
```

Success is explicit and must end with:

```
MIGRATION VERIFIED: every table matches the SQL Server source row for row.
```

and exit non-zero on any mismatch (with `backoffLimit: 0` it stays failed rather than half-retrying).

```bash
kubectl -n cesarbarbosa get job cesarbarbosa-migrate -o jsonpath='{.status.succeeded}'   # expect 1
```

> **`--truncate` is correct here and is NOT correct in an initContainer.** The Job runs once, so
> emptying the target first is exactly what makes a re-run safe. An initContainer re-runs on every
> restart, which is why it must use `--auto` instead.

**Do not proceed to step 7 unless this printed `MIGRATION VERIFIED`.** The site is already down, so
walking away and retrying later costs nothing.

### Step 7 — Repoint the application

Re-seal `CesarBarbosaDB` to the **PostgreSQL** string and commit. Also set, in
`cesarbarbosa/deployment.yaml`:

- `replicas: 1`
- `DATABASE_MANAGE_SCHEMA_AT_STARTUP: "false"` — the schema is already applied; the app should
  verify it, not create it. If something was missed, the app now **refuses to start** with
  `The database schema is N migration(s) behind...` rather than serving an empty site.

```bash
pwsh -File ./scripts/seal.ps1 -SecretFile ./cesarbarbosa-credentials.yaml `
  -SealedFile ./cesarbarbosa/cesarbarbosa-credentials-sealed.yaml -Namespace cesarbarbosa
git commit -am "cutover: point CesarBarbosaDB at PostgreSQL; scale back to 1"
git push
kubectl -n cesarbarbosa rollout status deploy/cesarbarbosa
```

If the migration step used the app's own `CesarBarbosaDB` as its source, note that this key now
points at PostgreSQL — the migration is done, so that is correct, but a *re-run* would need the
source key restored first (see §7).

### Step 8 — Verify

```bash
curl -s https://cesarbarbosa.com.br/api/health/ready
curl -s https://cesarbarbosa.com.br/api/infocompany
curl -s 'https://cesarbarbosa.com.br/api/post?page=0&pageSize=5'
curl -s 'https://cesarbarbosa.com.br/api/post/search?searchText=BUENOS'   # must match lower-case
```

Then, on the database:

```bash
kubectl -n shared-services exec -i deploy/postgres -c postgres -- \
  psql -U postgres -d cesarbarbosa -v ON_ERROR_STOP=1 < scripts/postgres-verify.sql
```

and compare the row counts with what step 1 recorded.

**Comment counts must now match exactly** (unlike the no-freeze design, where a difference meant
lost writes). Because the site was stopped before the copy:

```sql
-- SQL Server
SELECT COUNT(*) FROM Comment;
```
```sql
-- PostgreSQL
SELECT COUNT(*) FROM "Comment";
```

Equal counts confirm the outage did its job. A difference here means the site was still writing
when the copy ran — investigate before declaring success.

Finally, **browse the site end to end**: blog list, a post with its gallery and comments, a
portfolio page, and an admin login. **Look at the images** — they come from MinIO and are untouched
by this migration, so a missing image means something unrelated has gone wrong.

**The outage ends here.** Steps 1–4 were done with the site up; only steps 5–8 are downtime.

---

## 3. Prerequisites

### 3.1 A read-only SQL Server login for the migrator

The migrator only ever issues `SELECT`. Give it a login that can do nothing else, so a bug in the
migrator cannot damage the system of record while it is still live.

Run [`../scripts/sqlserver-readonly-login.sql`](../scripts/sqlserver-readonly-login.sql), which
creates `cesarbarbosa_migrator` with `GRANT SELECT ON SCHEMA::dbo` and nothing more. The script's
trailing queries confirm the login exists and sees the expected tables; its header shows the
`sqlcmd` invocations that prove reading succeeds and writing is **denied**.

> The script sets `CHECK_POLICY = ON`, so SQL Server rejects a weak password. If `CREATE LOGIN`
> fails, the statements after it still "succeed" against a login that does not exist — so always
> check the verification query reports a row before trusting the rest.

### 3.2 Validate the plan against the **live** database

The tool ships with a plan describing the schema it expects. That plan was written against a
schema dump taken during development — which **goes stale the moment anyone runs a migration**, and
which the next project will not have at all. The live database is the only source of truth, so the
plan is validated against it, in code, before any data moves:

```bash
# Run from the application repo, reachable to the source. Reads the catalog only.
$env:MIGRATION_SOURCE = "Server=<source>;Database=cesarbarbosa;User Id=cesarbarbosa_migrator;Password=<pwd>;TrustServerCertificate=True"
dotnet run --project tools/CesarBarbosa.DataMigration -- --check-schema
```

It compares the plan with the live `sys.tables` / `sys.columns` and reports **every** discrepancy at
once, rather than letting the copy fail one table at a time inside the cutover window:

| Output | Meaning | Action |
|---|---|---|
| `MISSING TABLE` / `MISSING COLUMN` | The live database has drifted from the plan | Update `MigrationPlan.cs` to match the live schema, then re-run against a rehearsal target |
| `NO KEY COLUMN` | The plan has no deterministic key for a table, so the verification digest is order-dependent | Add that table's key to `Verifier.IsKeyColumn` |
| `NOTE ... is NOT migrated` | Present in the database, absent from the plan | A deliberate decision — confirm it is the one you want |

`SCHEMA CHECK PASSED` is the gate before anything else. Expected note for this application: the
16th table is `__EFMigrationsHistory`, which is correctly not migrated.

> **No schema dump needed — for this project or the next.** Everything above reads the live
> catalog. The dump in `.backup/` is a development convenience for rehearsing locally, nothing
> more. For a project with no plan at all, `--generate-plan` prints a reviewed-draft plan built
> from the live catalog: see `DATABASE_MIGRATION.md` Part 2.

Row counts are expected to differ from any dump; only the **shape** is compared.

### 3.3 Tooling on your workstation

- `kubectl` with access to the cluster (for sealing, applying, and reading logs).
- `kubeseal` (the server repo's `scripts/seal.ps1` wraps it).
- The .NET SDK, **only** if you run `--check-schema` / `--generate-plan` from outside the cluster.
  No database port-forwarding is required for the in-cluster Job.

---

## 4. Prepare (no downtime)

Everything in this section happens while the application is still running against SQL Server and
still serving traffic. It is safe to repeat in full.

### 4.1 Create the PostgreSQL role and database

On the **existing** cluster, `postgres/initdb-configmap.yaml` will not help: those scripts run
only on first boot of an empty `PGDATA`. Create the role by hand, exactly as the server README
documents:

```bash
kubectl -n shared-services exec deploy/postgres -c postgres -- psql -U postgres
```

```sql
CREATE ROLE cesarbarbosa LOGIN PASSWORD '<strong-password>';
CREATE DATABASE cesarbarbosa OWNER cesarbarbosa;
```

`cesarbarbosa/db-bootstrap/30-create-cesarbarbosa-db.sh` in the server repo is the declarative
equivalent, for a future rebuilt cluster. Adding it there keeps a rebuild faithful; it does not
create the role today.

### 4.2 Store the target connection string
The connection string is a credential, so it goes in the app's existing SealedSecret rather than
in the Deployment. **Both** keys live there, so there is exactly one credential secret to manage
through the cutover:

| Key | Engine | When it is used |
|---|---|---|
| `CesarBarbosaDB` | SQL Server (source) | now, and until step 7 |
| `POSTGRES_CONNECTION_STRING` | PostgreSQL (target) | the migrator Job; then becomes `CesarBarbosaDB` |

**You cannot re-seal a SealedSecret without its plaintext**, and the plaintext is not in git — so
read the current values out of the cluster, add the new key, and re-seal:

```bash
# 1. Recover the existing plaintext from the running Secret (do NOT commit this file).
kubectl -n cesarbarbosa get secret cesarbarbosa-credentials -o yaml > cesarbarbosa-credentials.yaml

# 2. Add the new key for the PostgreSQL target. Base64 as Kubernetes expects:
#    Host=postgres.shared-services.svc.cluster.local;Port=5432;Database=cesarbarbosa;Username=cesarbarbosa;Password=<pwd>;SSL Mode=Disable
#    (cluster-internal, so no TLS on this hop)
printf '%s' 'Host=postgres.shared-services.svc.cluster.local;Port=5432;Database=cesarbarbosa;Username=cesarbarbosa;Password=<pwd>;SSL Mode=Disable' | base64 -w0

# 3. Seal it back, then commit ONLY the sealed file.
pwsh -File ./scripts/seal.ps1 `
  -SecretFile ./cesarbarbosa-credentials.yaml `
  -SealedFile ./cesarbarbosa/cesarbarbosa-credentials-sealed.yaml `
  -Namespace cesarbarbosa

# 4. Delete the plaintext.
rm cesarbarbosa-credentials.yaml
```

> **Keep `CesarBarbosaDB` pointing at SQL Server during the cutover.** The migrator reads the
> source string from it, and the application keeps using it until step 7. Repointing that key is
> the *switch*, so it must happen last. Add `POSTGRES_CONNECTION_STRING` alongside it now and
> leave it unused until then.

Commit and push; Argo CD applies the new Secret on its next sync:

```bash
kubectl -n cesarbarbosa get secret cesarbarbosa-credentials \
  -o jsonpath='{.data.POSTGRES_CONNECTION_STRING}' | base64 -d
```

> **Two modes exist; this runbook uses the one-shot Job.** The tool's `--auto` mode inspects the
> target and decides: migrate (empty and unmarked), **skip** (a verified migration already
> completed), or **refuse** (data present but unmarked — a run that died, which must not be served
> half-migrated). That mode exists for an initContainer, which re-runs on every pod start, so
> `--auto` (never `--truncate`) is the correct flag there.
>
> The chosen design here is **stop the application, run the Job once, verify, start the
> application** (see §0 and §2.5). The Job is explicit and read-the-output, which is what a
> maintenance window wants. The completion marker is still written and still meaningful — it is
> what makes a re-run safe and what prevents a partial migration from ever being served.

### 4.3 Apply the schema

The schema is applied **deliberately, in-cluster**, before any data exists. This is what makes the
later pod rollout boring.

```bash
kubectl -n cesarbarbosa apply -f cesarbarbosa/migrate-job.yaml   # committed args: --migrate-only
kubectl -n cesarbarbosa logs -f job/cesarbarbosa-migrate
```

Expected: `Schema: 0 migration(s) applied, 1 pending.` → `Schema: migrations applied.` → 16 tables
in `cesarbarbosa`.

> The committed `args` in the Job are `["--migrate", "--truncate"]`, which is the correct **first
> run** — schema, then copy, then verify, in one idempotent step. For this schema-only step, edit
> `args` to `["--migrate-only"]` (the alternative is already commented in the file) and re-apply.
> See the note on re-running at step 4.4.

> **A Job's pod template is immutable.** Re-applying a manifest over a *finished* Job starts
> nothing. Delete it first:
>
> ```bash
> kubectl -n cesarbarbosa delete job cesarbarbosa-migrate --ignore-not-found
> kubectl -n cesarbarbosa apply -f cesarbarbosa/migrate-job.yaml
> ```
>
> (`kubectl create job --from=...` only accepts a CronJob, not a Job.)

Verify independently:

```bash
kubectl -n shared-services exec deploy/postgres -c postgres -- \
  psql -U postgres -d cesarbarbosa -c '\dt'
# and that the extensions the schema depends on exist:
kubectl -n shared-services exec deploy/postgres -c postgres -- \
  psql -U postgres -d cesarbarbosa -c 'SELECT extname FROM pg_extension ORDER BY 1;'
# expect citext, pg_trgm, plpgsql
```

`citext` matters more here than it would elsewhere: this cluster's PostgreSQL was initialised with
`--locale-provider=builtin --builtin-locale=C.UTF-8` (deliberately, because the Alpine image has no
glibc locales), so string comparison is byte-wise and *nothing* is case-insensitive unless the
column says so.

### 4.4 Bulk copy and verify

First run: `args: ["--migrate", "--truncate"]`. Later runs: `args: ["--truncate"]`.

```bash
kubectl -n cesarbarbosa logs -f job/cesarbarbosa-migrate
```

Success is explicit — the tool prints a per-table digest comparison and ends with:

```
MIGRATION VERIFIED: every table matches the SQL Server source row for row.
```

and exits non-zero on any mismatch (so `kubectl get job` shows `Failed`, and with
`backoffLimit: 0` it stays failed rather than half-retrying).

```bash
kubectl -n cesarbarbosa get job cesarbarbosa-migrate -o jsonpath='{.status.succeeded}'
```

Run the independent checks too:

```bash
kubectl -n shared-services exec -i deploy/postgres -c postgres -- \
  psql -U postgres -d cesarbarbosa -v ON_ERROR_STOP=1 < scripts/postgres-verify.sql
# every orphan count must be 0
```

### 4.5 Rehearse the application against the target

Do **not** skip this. It is the only step that exercises the real app against the real migrated
data before you are committed to it.

```bash
# Temporary port-forward to the real data, from the app's own image, without touching
# the live Deployment. Point the app at PostgreSQL but do NOT expose it via the Service.
kubectl -n cesarbarbosa run cesarbarbosa-rehearse \
  --image=gitea.fpssoftware.uk/fps-software/cesarbarbosa:latest \
  --restart=Never --rm -it --port=8080 \
  --env="CesarBarbosaDB=$(kubectl -n cesarbarbosa get secret cesarbarbosa-credentials -o jsonpath='{.data.POSTGRES_CONNECTION_STRING}' | base64 -d)" \
  --env="DATABASE_MANAGE_SCHEMA_AT_STARTUP=false" \
  --env=JWT_SECRET_KEY=... --env=S3_ENDPOINT=... --env=S3_ACCESS_KEY=... \
  --env=S3_SECRET_KEY=... --env=S3_BUCKET=... --env=ImageStorage__UseSsl=false
```

Then check, in a second shell:

```bash
kubectl -n cesarbarbosa port-forward pod/cesarbarbosa-rehearse 8080:8080
curl -s localhost:8080/api/health/ready
curl -s localhost:8080/api/infocompany
curl -s 'localhost:8080/api/post?page=0&pageSize=5'
curl -s 'localhost:8080/api/post/search?searchText=BUENOS'   # must match the lower-case result
```

The search check is not decorative: SQL Server's collation made `LIKE` case-insensitive and
PostgreSQL does not, so a missed `ILIKE` shows up here as a search that returns nothing.

### 4.6 Reset the admin password

The migrated `PasswordHash` is intact, but the production password is unknown, so **admin login
will fail with 401** even though the migration is correct. Reset it deliberately now, while there
is no time pressure:

```bash
curl -s -X POST localhost:8080/api/auth/login -H 'Content-Type: application/json' \
  -d '{"username":"<admin>","password":"<current>"}'      # expected: 401
# Then set a new one through the admin UI, or:
curl -s localhost:8080/api/users/generate-password/<userId>
```

Leaving this until after the switch turns a known, harmless 401 into an apparent outage.

---

## 5. The cutover window

Target: **a few minutes**, almost all of it the pod rollout — the data itself is small (1,505 rows
across 15 tables).

This section is the authoritative version of the window. §2.5 is the same steps in condensed,
copy-pasteable form with the surrounding preparation.

### 5.1 Stop the application

Commit `replicas: 0` to `cesarbarbosa/deployment.yaml`. This is deliberate over `kubectl scale`:
`selfHeal: true` would revert a live edit.

```bash
git commit -am "cutover: scale cesarbarbosa to zero for the database switch"
git push
kubectl -n cesarbarbosa rollout status deploy/cesarbarbosa   # wait for the pod to go away
kubectl -n cesarbarbosa get pods                             # must be empty
```

The **site is now down** — that is the design, not a problem. Confirm nothing is writing before
continuing:

```sql
-- on SQL Server; expect no active connections for the app database
SELECT DB_NAME(dbid) AS db, COUNT(*) AS connections
  FROM sys.sysprocesses WHERE dbid = DB_ID('cesarbarbosa') GROUP BY DB_NAME(dbid);
```

Zero connections is what makes the copy complete: **no writer can insert a row that the copy
misses.**

### 5.2 Final sync

Run the Job once more (`args: ["--truncate"]`). It truncates and recopies, so it is inherently
idempotent and needs no incremental logic — which is the whole reason an outage this short is
acceptable.

```bash
kubectl -n cesarbarbosa delete job cesarbarbosa-migrate --ignore-not-found
kubectl -n cesarbarbosa apply -f cesarbarbosa/migrate-job.yaml
kubectl -n cesarbarbosa logs -f job/cesarbarbosa-migrate
```

Require `MIGRATION VERIFIED` before proceeding. If it fails, **stop and roll back** (section 7):
the site is already down, so you have lost nothing by walking away and retrying outside the
window.

### 5.3 Switch the connection string

Repoint `CesarBarbosaDB` at PostgreSQL, in the SealedSecret, and commit:

```bash
# plaintext: Host=postgres.shared-services.svc.cluster.local;Port=5432;Database=cesarbarbosa;Username=cesarbarbosa;Password=<pwd>;SSL Mode=Disable
pwsh -File ./scripts/seal.ps1 -SecretFile ./cesarbarbosa-credentials.yaml `
  -SealedFile ./cesarbarbosa/cesarbarbosa-credentials-sealed.yaml -Namespace cesarbarbosa
git commit -am "cutover: point CesarBarbosaDB at PostgreSQL"
```

Also set, in `cesarbarbosa/deployment.yaml`:

- `replicas: 1`
- `DATABASE_MANAGE_SCHEMA_AT_STARTUP: "false"` — the schema is already applied; the app should
  verify it, not create it. If a step was missed, the app now **refuses to start** with
  `The database schema is N migration(s) behind...`, which is far better than silently serving an
  empty site.

### 5.4 Roll out and verify

```bash
git push
kubectl -n cesarbarbosa rollout status deploy/cesarbarbosa
kubectl -n cesarbarbosa logs deploy/cesarbarbosa | grep -i -E 'schema|error'
```

Then run the smoke checks against the real host:

```bash
curl -s https://cesarbarbosa.com.br/api/health/ready
curl -s https://cesarbarbosa.com.br/api/infocompany
curl -s 'https://cesarbarbosa.com.br/api/post?page=0&pageSize=5'
curl -s 'https://cesarbarbosa.com.br/api/post/search?searchText=BUENOS'
```

And browse the site: home/blog list, a post with its gallery and comments, a portfolio page, and a
successful admin login. **The images are the thing to actually look at** — they come from MinIO and
should be entirely unaffected, so any missing image means something unrelated to the database has
gone wrong.

---

## 6. Rollback

Rollback is a **pod restart against the old connection string**. Because the chosen design stops
the application first, rollback is clean at every point *during the window* — the site is already
down, so reverting costs nothing but the time already spent.

| Situation | Action | Data loss |
|---|---|---|
| Step 1–4 fails (still on SQL Server) | None needed — the app was never repointed | none |
| Migration Job fails or verification mismatches | Leave `replicas: 0`, fix, re-run the Job (it is idempotent) | none |
| Job succeeded but the app looks wrong after step 7 | Re-seal `CesarBarbosaDB` back to SQL Server, `replicas: 1` | none |
| Failure **after** content was authored in PostgreSQL | Reverting **loses that content** | the writes since the switch |

The first three rows are the whole reason this design was chosen: with the site stopped, rollback
is free until someone starts editing content in PostgreSQL. That last row is the real decision, and
it is why the rollback window should be closed deliberately rather than by drift.

**The one failure that is not free:** scaling `replicas: 1` *before* the Job verified. That serves
an empty or half-migrated database. The mitigation is procedural — step 6 must print
`MIGRATION VERIFIED` first — and structural: the marker makes a half-migrated target **refuse**
rather than serve.

**Keep the SQL Server `cesarbarbosa` database in place, untouched and read-only, for at least one
backup cycle.** This mirrors what the mail stack did — it kept its pre-migration RocksDB store as a
rollback copy rather than deleting it. Do not drop the SQL Server database as part of this work.

---

## 7. After the cutover

1. **Revisit the migrator Job's source secret.** It reads the source connection string from
   `CesarBarbosaDB`, which now points at PostgreSQL — so the Job can no longer reach SQL Server.
   That is correct: the Job has done its job. If you need a re-run after the switch, restore
   `CesarBarbosaDB` to the SQL Server value first, or repoint the Job at a dedicated
   `SQLSERVER_SOURCE_CONNECTION_STRING` key.
2. **Back up the new database.** Add `cesarbarbosa` as a Databasement target
   (host `postgres.shared-services.svc.cluster.local`, port 5432, database `postgres`, user
   `databasement`), as the server README's PostgreSQL section describes. The SQL Server backups
   that were covering this data no longer do.
3. **Retire the SQL Server database** only when you are confident, and deliberately — after the
   rollback window, after a verified backup of PostgreSQL, and as its own change.
4. **Decide whether to remove `mssql` entirely.** Other applications may still depend on it; this
   migration is one tenant, not the whole instance.

---

## 8. Checklist

**Before (no downtime)**
- [ ] Maintenance window announced to the site's owner
- [ ] Branch merged to `main` and CI published the image (**the first build ever** — watch it)
- [ ] Image verified by **running** it and confirming `migrator/CesarBarbosa.DataMigration.dll`
- [ ] Read-only SQL Server login created and verified (read yes, write denied)
- [ ] Live production schema reconciled against `MigrationPlan.cs` (`SCHEMA CHECK PASSED`)
- [ ] PostgreSQL role + database created; `citext` and `pg_trgm` present
- [ ] `POSTGRES_CONNECTION_STRING` sealed into `cesarbarbosa-credentials`; `CesarBarbosaDB` untouched
- [ ] Migration rehearsed in-cluster against the real target; `MIGRATION VERIFIED`
- [ ] App rehearsed against PostgreSQL, **including case-insensitive search**
- [ ] Admin password reset and login confirmed

**During (the outage)**
- [ ] `replicas: 0` committed and the pods gone
- [ ] Zero active SQL Server connections confirmed
- [ ] Job run; log ends with `MIGRATION VERIFIED`
- [ ] Independent orphan checks return 0 (`scripts/postgres-verify.sql`)
- [ ] Comment counts equal on both engines (proves no writes were lost)
- [ ] `CesarBarbosaDB` repointed, `DATABASE_MANAGE_SCHEMA_AT_STARTUP=false`, `replicas: 1`

**After**
- [ ] `/api/health/ready` green; site browsed end to end; **images render**
- [ ] Admin login works
- [ ] SQL Server database kept, read-only, not dropped
- [ ] PostgreSQL added to the backup schedule
- [ ] Rollback window closed deliberately, then SQL Server retired as its own change
