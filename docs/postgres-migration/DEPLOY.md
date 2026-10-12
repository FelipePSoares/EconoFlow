# Deploy CesarBarbosa to PostgreSQL — the operator's runbook

> ## ⚠️ Read [`CUTOVER_PREFLIGHT.md`](CUTOVER_PREFLIGHT.md) first
>
> **This document's ordering is wrong** and following it as written would break the cutover.
>
> It says "merge to `main`, then let CI publish". But `main` is watched by an Argo CD Image Updater
> that writes the new image digest back into `cesarbarbosa/kustomization.yaml`, and Argo auto-syncs
> with `selfHeal: true`. Merging therefore deploys the **new Npgsql build against the
> still-SQL-Server database** — a crash loop at best, and a pod starting against a half-copied
> database if it lands mid-migration.
>
> `CUTOVER_PREFLIGHT.md` has the corrected order:
>
> ```
> A. Create accounts (SQL Server login + PostgreSQL role)   no downtime
> B. Publish images WITHOUT merging — workflow_dispatch      no downtime
> C. Suspend Argo + Image Updater, stop the app              outage begins
> D. Merge, migrate, verify, repoint, start                  outage ends
> E. Re-enable automation, verify                            after
> ```
>
> The rule: **the branch is how you get an image; `main` is how you get a deployment.** You need one
> without the other, so publishing must come before the merge.
>
> The freeze itself is **already committed** on `fps-software-server`'s
> `feat/cesarbarbosa-postgres-cutover` branch: `syncPolicy.automated` is removed from
> `apps/cesarbarbosa.yaml`, and the `cesarbarbosa` rule is commented out of
> `argocd-image-updater/image-updater.yaml`. It is a git change rather than a `kubectl patch`
> because `root-app` re-applies `apps/*.yaml` and would revert a live patch within seconds.
>
> This document remains useful for the SQL (`--check-schema`, verification queries) and the smoke
> tests. Where the two disagree on **ordering**, `CUTOVER_PREFLIGHT.md` wins.

This is the **execution sheet**: the literal commands, in order, with what to check after each one.
It assumes the reasoning in [`CUTOVER.md`](CUTOVER.md) and applies its *stop-the-application*
design.

**Shape of the work:** Phase 1–2 can be done any time and changes nothing for users. Phase 3 is
the outage — a few minutes. Phase 4–5 is verification and cleanup.

> **Two repos are involved.** `CesarBarbosa` (the app — where you are) and `fps-software-server`
> (the manifests). Commands below say which directory to be in.

---

## Before you start: what was broken and is now fixed

Found by reading the Job against the repos it depends on, not by trusting the docs:

| Problem | Status |
|---|---|
| `migrate-job.yaml` ran `cesarbarbosa-migrator:latest` — an image **nothing built** (CI published only `cesarbarbosa`). The Job would have died with `ImagePullBackOff`. | **Fixed** — `Dockerfile.migrator` restored; CI now builds and pushes both images with the same commit SHA. |
| `POSTGRES_CONNECTION_STRING` is **not in the sealed secret** (it holds only `CesarBarbosaDB`, `JWT_SECRET_KEY`, `S3_*`). The Job reads it for its target, so the pod would fail with `CreateContainerConfigError`. | **Open — you must do this** (Phase 1, step 2). |
| The Job's `:latest` tag can drift from the app's revision. | **Documented** — pin to the same SHA at cutover (Phase 3, step 6). |

---

## Phase 1 — Publish the images (no downtime, do this days ahead)

> **Superseded — see `CUTOVER_PREFLIGHT.md` Phase B.** Do **not** merge to `main` at this point.
> Merging triggers Image Updater → write-back → Argo auto-sync → the new image deployed against the
> old database. Publish from the branch with `workflow_dispatch` instead, and merge in Phase D once
> Argo and the Image Updater are suspended.

### 1. Merge to `main` and let CI publish

CI only runs on push to `main`, and **this is the first build of `Dockerfile.migrator` ever**.

```bash
# CesarBarbosa repo
git checkout main
git merge feat/migrate_postgres
git push origin main
```

Watch the run in GitHub Actions. Two jobs must go green: `build-and-push` and
`build-and-push-migrator`.

**If build-and-push-migrator fails, stop here.** Nothing else matters until both images exist.

### 2. Add the missing secret key and re-seal

`POSTGRES_CONNECTION_STRING` is not in the secret. Without this the Job cannot start.

First, create the PostgreSQL role and database on the shared instance (**once**, if not already
there):

```bash
kubectl -n shared-services exec deploy/postgres -c postgres -- psql -U postgres
```
```sql
CREATE ROLE cesarbarbosa LOGIN PASSWORD '<strong-password>';
CREATE DATABASE cesarbarbosa OWNER cesarbarbosa;
\q
```

Then recover the existing plaintext, add the key, and re-seal:

```bash
# fps-software-server repo
kubectl -n cesarbarbosa get secret cesarbarbosa-credentials -o yaml > cesarbarbosa-credentials.yaml
```

Add this key to the file, base64-encoded (`base64 -w0` on Linux, `[Convert]::ToBase64String` on
Windows):

```
Host=postgres.shared-services.svc.cluster.local;Port=5432;Database=cesarbarbosa;Username=cesarbarbosa;Password=<pwd>;SSL Mode=Disable
```

> Use the **Npgsql keyword form** above, not a `postgresql://` URI.

```bash
pwsh -File ./scripts/seal.ps1 -SecretFile ./cesarbarbosa-credentials.yaml `
  -SealedFile ./cesarbarbosa/cesarbarbosa-credentials-sealed.yaml -Namespace cesarbarbosa
rm cesarbarbosa-credentials.yaml      # never commit this
git add cesarbarbosa/cesarbarbosa-credentials-sealed.yaml
git commit -m "cesarbarbosa: add the PostgreSQL target connection string"
git push
```

Confirm the key arrived:

```bash
kubectl -n cesarbarbosa get secret cesarbarbosa-credentials \
  -o jsonpath='{.data.POSTGRES_CONNECTION_STRING}' | base64 -d
```

### 3. Verify the images by RUNNING them

Not by building — an earlier migrator image built fine and died at startup on a missing framework.

```bash
docker pull gitea.fpssoftware.uk/fps-software/cesarbarbosa-migrator:latest
docker run --rm --entrypoint dotnet \
  gitea.fpssoftware.uk/fps-software/cesarbarbosa-migrator:latest \
  CesarBarbosa.DataMigration.dll --help
```

**Expect the usage text listing `--migrate`, `--truncate`, `--check-schema`, `--auto`, and the new
`--app-env-var`.** If it exits with a framework error instead, the base image regressed — see
`Dockerfile.migrator`'s comment on why it must be `aspnet`, not `runtime`.

### 4. Note the SHA you will pin to

```bash
git -C ../CesarBarbosa rev-parse HEAD     # this is <SHA>
```

Both images are tagged with it. Write it down; Phase 3 needs it.

---

## Phase 2 — Rehearse (no downtime)

Do **not** skip this. It is the only step that exercises the real thing before you commit.

### 5. Validate the plan against the live schema (read-only)

```bash
# From the CesarBarbosa repo, on a machine that can reach production SQL Server.
$env:MIGRATION_SOURCE = "Server=<prod-host>;Database=cesarbarbosa;User Id=sa;Password=<pwd>;TrustServerCertificate=True"
dotnet run --project tools/CesarBarbosa.DataMigration -- --check-schema
```

- `SCHEMA CHECK PASSED` → continue.
- `MISSING TABLE` / `MISSING COLUMN` / `NO KEY COLUMN` → **stop**, fix `MigrationPlan.cs`, re-merge.
- Read the `NOTE ... is NOT migrated` lines and confirm each is intended.

Record the live row counts now — step 12 compares against them:

```sql
SELECT t.name, SUM(p.rows) AS rows FROM sys.tables t
  JOIN sys.partitions p ON p.object_id = t.object_id AND p.index_id IN (0,1)
 GROUP BY t.name ORDER BY t.name;
```

### 6. Rehearse the Job against the real target

Edit `cesarbarbosa/migrate-job.yaml` and set `args:` to `["--verify-only"]` first — a dry run that
compares without copying:

```bash
cd fps-software-server
kubectl -n cesarbarbosa delete job cesarbarbosa-migrate --ignore-not-found
kubectl -n cesarbarbosa apply -f cesarbarbosa/migrate-job.yaml
kubectl -n cesarbarbosa logs -f job/cesarbarbosa-migrate
```

Then set `args:` back to `["--migrate", "--truncate"]` and run it once for real. **This is a
rehearsal** — the final run happens again inside the window, and `--truncate` makes that safe.

Require this line before moving on:

```
MIGRATION VERIFIED: every table matches the SQL Server source row for row.
```

### 7. Rehearse the application against the migrated data

Temporary pod, real data, without touching the live Deployment:

```bash
kubectl -n cesarbarbosa run cesarbarbosa-rehearse \
  --image=gitea.fpssoftware.uk/fps-software/cesarbarbosa:<SHA> \
  --restart=Never --rm -it --port=8080 \
  --env="CesarBarbosaDB=$(kubectl -n cesarbarbosa get secret cesarbarbosa-credentials -o jsonpath='{.data.POSTGRES_CONNECTION_STRING}' | base64 -d)" \
  --env="DATABASE_MANAGE_SCHEMA_AT_STARTUP=false" \
  --env=JWT_SECRET_KEY=... --env=S3_ENDPOINT=... --env=S3_ACCESS_KEY=... \
  --env=S3_SECRET_KEY=... --env=S3_BUCKET=... --env=ImageStorage__UseSsl=false
```

In a second shell:

```bash
kubectl -n cesarbarbosa port-forward pod/cesarbarbosa-rehearse 8080:8080
curl -s localhost:8080/api/health/ready
curl -s localhost:8080/api/infocompany
curl -s 'localhost:8080/api/post?page=0&pageSize=5'
curl -s 'localhost:8080/api/post/search?searchText=BUENOS'   # must match the lower-case result
```

The search check is not decorative — SQL Server's collation made `LIKE` case-insensitive and
PostgreSQL does not, so a missed `ILIKE` shows up as a search returning nothing.

### 8. Reset the admin password now

The migrated hash is intact but the production password is unknown, so login **will** return 401.
That is expected, not a migration failure.

```bash
curl -s localhost:8080/api/users/generate-password/<userId>
```

Leaving this until after the switch turns a known 401 into an apparent outage.

---

## Phase 3 — The cutover (the outage)

Announce the window first. Target: **a few minutes**, almost all of it pod rollout.

### 9. Confirm the SHA is pinned

Edit `cesarbarbosa/migrate-job.yaml`:

```yaml
image: gitea.fpssoftware.uk/fps-software/cesarbarbosa-migrator:<SHA>   # NOT :latest
```

Check it matches the app Deployment:

```bash
kubectl -n cesarbarbosa get deploy cesarbarbosa -o jsonpath='{.spec.template.spec.containers[0].image}'
```

**Both must be the same `<SHA>`.** This is the same-commit guarantee — if they differ, the schema
and the code reading it are different revisions.

### 10. Stop the application

```bash
# fps-software-server repo — edit cesarbarbosa/deployment.yaml: replicas: 0
git commit -am "cutover: scale cesarbarbosa to zero for the database switch"
git push
kubectl -n cesarbarbosa rollout status deploy/cesarbarbosa
kubectl -n cesarbarbosa get pods          # must be empty
```

> Commit it — do **not** `kubectl scale`. Argo has `selfHeal: true` and will revert a live edit.

Confirm nothing is writing before continuing:

```sql
SELECT DB_NAME(dbid) AS db, COUNT(*) AS connections
  FROM sys.sysprocesses WHERE dbid = DB_ID('cesarbarbosa') GROUP BY DB_NAME(dbid);
```

**Zero connections is the point.** With no writers, the copy is complete by construction.

### 11. Run the migration

```bash
kubectl -n cesarbarbosa delete job cesarbarbosa-migrate --ignore-not-found
kubectl -n cesarbarbosa apply -f cesarbarbosa/migrate-job.yaml
kubectl -n cesarbarbosa logs -f job/cesarbarbosa-migrate
```

**Do not proceed until you see `MIGRATION VERIFIED`.** The site is already down, so stopping here
costs nothing. If it fails, go to Rollback.

### 12. Verify independently

```bash
kubectl -n cesarbarbosa get job cesarbarbosa-migrate -o jsonpath='{.status.succeeded}'   # expect 1

kubectl -n shared-services exec -i deploy/postgres -c postgres -- \
  psql -U postgres -d cesarbarbosa -v ON_ERROR_STOP=1 < scripts/postgres-verify.sql
```

Every orphan count must be 0. Then compare row counts against step 5, and **check the comment
count matches exactly**:

```sql
-- SQL Server                          -- PostgreSQL
SELECT COUNT(*) FROM Comment;           SELECT COUNT(*) FROM "Comment";
```

Equal counts prove the outage did its job. A difference means something was still writing.

### 13. Repoint and restart

Re-seal `CesarBarbosaDB` to the **PostgreSQL** string (same procedure as Phase 1 step 2), and in
`cesarbarbosa/deployment.yaml` set:

```yaml
replicas: 1
# and the app container env:
- name: DATABASE_MANAGE_SCHEMA_AT_STARTUP
  value: "false"
```

```bash
git commit -am "cutover: point CesarBarbosaDB at PostgreSQL; scale back to 1"
git push
kubectl -n cesarbarbosa rollout status deploy/cesarbarbosa
```

**The outage ends here.**

> If the app refuses to start with `The database schema is N migration(s) behind...`, that is the
> guard working — a step was missed. Do not set `DATABASE_MANAGE_SCHEMA_AT_STARTUP=true` to get
> past it.

---

## Phase 4 — Verify the live site

### 14. Smoke test

```bash
curl -s https://cesarbarbosa.com.br/api/health/ready
curl -s https://cesarbarbosa.com.br/api/infocompany
curl -s 'https://cesarbarbosa.com.br/api/post?page=0&pageSize=5'
curl -s 'https://cesarbarbosa.com.br/api/post/search?searchText=BUENOS'
```

Then **browse it**: blog list, a post with gallery and comments, a portfolio page, admin login.

**Look at the images.** They come from MinIO and are untouched by this migration — a missing image
means something unrelated went wrong.

---

## Phase 5 — After

- [ ] Add `cesarbarbosa` to the Databasement backup schedule. **The SQL Server backup no longer
      protects this data** — this is the most commonly forgotten step.
- [ ] Keep the SQL Server database, read-only and untouched, for at least one backup cycle.
- [ ] Decide whether `mssql` stays in `compose.yaml`.
- [ ] Retire the SQL Server database only after the rollback window, as its own change.

---

## Rollback

Because the application is stopped before the copy, rollback is **free until someone authors
content in PostgreSQL**.

| Failure | Do this | Loss |
|---|---|---|
| Phase 2 rehearse fails | Nothing — still on SQL Server | none |
| Phase 3 step 11 fails | Leave `replicas: 0`; fix; re-run the Job (idempotent) | none |
| Step 14 looks wrong | Re-seal `CesarBarbosaDB` back to SQL Server, `replicas: 1` | none |
| After content was authored in PostgreSQL | Reverting loses it | the new writes |

**The one unrecoverable mistake:** scaling `replicas: 1` *before* step 11 verified. That serves an
empty or half-migrated database to real users.

---

## If something fails: first checks

```bash
kubectl -n cesarbarbosa get pods
kubectl -n cesarbarbosa describe job cesarbarbosa-migrate
kubectl -n cesarbarbosa logs job/cesarbarbosa-migrate
```

| Symptom | Cause |
|---|---|
| `ImagePullBackOff` | SHA tag not published, or `imagePullSecrets: gitea-registry` missing |
| `CreateContainerConfigError` | A secret key is missing — check `POSTGRES_CONNECTION_STRING` |
| Pod exits with a .NET framework error | Image built on `runtime` instead of `aspnet` base |
| `REFUSING to migrate` (`--auto` only) | Target has rows but no marker — a run died; use `--truncate` |
| `relation does not exist` | Schema not applied — the Job needs `--migrate` on its first run |
