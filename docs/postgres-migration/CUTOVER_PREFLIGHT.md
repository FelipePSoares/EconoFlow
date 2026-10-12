# Cutover preflight — the two accounts, and why the merge order changed

This covers the two things you asked for (**the SQL Server read-only login** and **the PostgreSQL
role/database**) and corrects a serious ordering flaw in [`DEPLOY.md`](DEPLOY.md).

---

## Why the original plan was wrong

`DEPLOY.md` said "merge to `main`, then let CI publish". That is unsafe here, because of a chain
that is easy to miss:

```
git push origin main
  → GitHub Actions publishes cesarbarbosa:latest with a NEW digest
  → argocd-image-updater sees the digest, does a git write-back
    (argocd-image-updater/image-updater.yaml, namePattern: cesarbarbosa,
     writeBackTarget: kustomization → cesarbarbosa/kustomization.yaml)
  → commits to main
  → Argo CD auto-syncs (automated: {prune: true, selfHeal: true})
  → the cesarbarbosa pod restarts on the new image
  → but CesarBarbosaDB still points at SQL Server
  → the new image speaks Npgsql, SQL Server is not Npgsql   →  CrashLoopBackOff
```

And it gets worse during the outage. There is **one replica**, the app and the migration Job read
the **same secret**, and Image Updater is autonomous:

| Moment | What can go wrong |
|---|---|
| Before the copy | Pod restarts on the new image, dies against SQL Server. Noise, recoverable. |
| **During the copy** | Pod starts against a **half-copied** database. Data corruption risk. |
| **After `--truncate`, before the repoint** | The app writes into PostgreSQL, then you repoint and re-run — those writes are lost. |

`selfHeal: true` also means any `kubectl` fix is reverted within seconds.

**So the merge must happen with the app stopped and Argo automation suspended — not before.** The
mail migration hit exactly this and left the answer: you must suspend **both** the app's
Application *and* `root-app`, because `root-app` re-applies `apps/*.yaml` and restores `selfHeal`.

---

## The corrected order

```
Phase A  create accounts (SQL Server + PostgreSQL)      no downtime, no deploy
Phase B  publish images, but do NOT let Argo pick them  no downtime
Phase C  suspend Argo + Image Updater, stop the app     outage begins
Phase D  migrate, verify, repoint, start                outage ends
Phase E  re-enable automation, verify, clean up
```

The rule for Phase B: **the branch is how you get an image; `main` is how you get a deployment.**
You need the image without the deployment, so you must be able to publish without merging — see
Phase B.

---

## Phase A — Create the accounts (do this first; changes nothing)

### A1. SQL Server — the read-only migrator login

The script already exists: [`../scripts/sqlserver-readonly-login.sql`](../scripts/sqlserver-readonly-login.sql).
It creates `cesarbarbosa_migrator` with `GRANT SELECT ON SCHEMA::dbo` and nothing else.

**Edit the file first** — replace `REPLACE_WITH_A_STRONG_PASSWORD`. `CHECK_POLICY = ON` means SQL
Server enforces complexity (8+ chars, 3 of 4 character classes).

SQL Server is cluster-internal, so run it in-cluster:

```bash
kubectl -n shared-services exec -it deploy/mssql -- \
  /opt/mssql-tools18/bin/sqlcmd -C -S localhost -U sa -P '<sa-password>'
```

Then paste the contents of `scripts/sqlserver-readonly-login.sql`.

> **`CREATE LOGIN` is not idempotent and the script guards it with `IF NOT EXISTS`.** If it fails on
> the password, the statements after it still "succeed" against a login that does not exist. So the
> verification query is the only thing that tells you it worked — **it must return exactly 1 row**:
>
> ```sql
> SELECT name AS login_created, type_desc, is_disabled
>   FROM sys.server_principals WHERE name = 'cesarbarbosa_migrator';
> ```
>
> Then confirm 15 tables are visible (`tables_visible`), and prove it cannot write by connecting as
> the new login and running the three checks in the script's footer.

### A2. PostgreSQL — the `cesarbarbosa` role and database

A bootstrap fragment already exists at
[`fps-software-server/postgres/30-create-cesarbarbosa-db.sh`](../../fps-software-server/postgres/30-create-cesarbarbosa-db.sh).
**It will not run on your cluster** — `/docker-entrypoint-initdb.d` executes only when `PGDATA` is
empty, i.e. on the very first boot of a brand-new cluster. Yours exists. Create them by hand:

```bash
kubectl -n shared-services exec -it deploy/postgres -c postgres -- psql -U postgres
```

Generate a strong password (`openssl rand -hex 32` — hex survives both a SQL literal and a
connection string unchanged), then:

```sql
CREATE ROLE cesarbarbosa LOGIN PASSWORD '<the-generated-password>';
CREATE DATABASE cesarbarbosa OWNER cesarbarbosa;
\q
```

`LOGIN` only — no `SUPERUSER`, no `CREATEDB`. One role owns one database, matching the `stalwart`
role's precedent.

Verify the role owns the database before you rely on it:

```bash
kubectl -n shared-services exec deploy/postgres -c postgres -- \
  psql -U postgres -tAc "SELECT datname, pg_get_userbyid(datdba) AS owner FROM pg_database WHERE datname='cesarbarbosa';"
```

**Expect `cesarbarbosa|cesarbarbosa`.** If the owner is `postgres`, the Job's EF Core migrations may
fail to create objects.

**Write the password down** — Phase D needs it in the connection string, and losing it means
re-rolling the role.

### A3. Confirm the extensions will be available

`citext` and `pg_trgm` are required by the schema and created by the EF Core migration. Your cluster
was initialised with `--locale-provider=builtin --builtin-locale=C.UTF-8`, so **nothing is
case-insensitive unless the column says so** — which is exactly why `citext` matters.

```bash
kubectl -n shared-services exec deploy/postgres -c postgres -- \
  psql -U postgres -d cesarbarbosa -tAc "SELECT extname FROM pg_extension ORDER BY 1;"
```

`plpgsql` only at this point is expected — the migration adds the other two, and `cesarbarbosa` owns
the database so it has the right to.

---

## Phase B — Publish images without deploying them

**Do not merge to `main` yet.** You need an image, not a deployment.

### B1. Allow a manual workflow run

The workflow currently triggers only on push to `main`. Add `workflow_dispatch` so you can build
from the branch:

```yaml
# .github/workflows/docker-publish.yml
on:
  push:
    branches: [ "main" ]
  workflow_dispatch:        # add this
```

Commit and push that to `feat/migrate_postgres`. Then:

GitHub → Actions → **Docker publish** → *Run workflow* → select `feat/migrate_postgres`.

This publishes **both** images tagged with that commit's SHA:

```
gitea.fpssoftware.uk/fps-software/cesarbarbosa:<sha>
gitea.fpssoftware.uk/fps-software/cesarbarbosa-migrator:<sha>
```

> **`:latest` also moves.** Image Updater watches `cesarbarbosa:latest` for the `cesarbarbosa`
> Application. It will only *deploy* it when `main`'s `kustomization.yaml` changes, and a
> branch build does not touch `main` — so this is safe. It is also why Phase C suspends the updater
> anyway: belt and braces.

### B2. Record the SHA and verify the migrator image by RUNNING it

```bash
git rev-parse HEAD        # this is <SHA>, note it down
```

```bash
docker pull gitea.fpssoftware.uk/fps-software/cesarbarbosa-migrator:<sha>
docker run --rm --entrypoint dotnet \
  gitea.fpssoftware.uk/fps-software/cesarbarbosa-migrator:<sha> \
  CesarBarbosa.DataMigration.dll --help
```

**Expect the usage text.** If it exits with a .NET framework error instead, the base image regressed
— see the comment in `Dockerfile.migrator` on why it must be `aspnet`, not `runtime`. This failure
is invisible at build time, which is why you run it.

### B3. Rehearse, still on `main`'s old revision

Run `--check-schema` against live SQL Server (read-only), then the Job with `args: ["--verify-only"]`,
exactly as in `DEPLOY.md` Phase 2. Nothing here touches the running site.

---

## Phase C — Freeze the automation (outage begins)

> **The freeze is already committed.** It lives on the
> `feat/cesarbarbosa-postgres-cutover` branch of `fps-software-server` (commit `27d1b8e`), not in a
> `kubectl patch`. That is deliberate: `root-app` re-applies `apps/*.yaml` on every reconcile, so a
> live patch would be reverted within seconds — the mail migration hit exactly that. **Git is the
> source of truth; the patch is not.**

### C1. Get the freeze onto `main` — and confirm it landed

The freeze must be **on `main`** before Phase D, because that is the revision Argo and the Image
Updater read.

```bash
# fps-software-server
git checkout main
git merge feat/cesarbarbosa-postgres-cutover
git push origin main
```

Wait for Argo to reconcile, then **confirm the freeze actually took effect** — do not assume:

```bash
kubectl -n shared-services get application cesarbarbosa \
  -o jsonpath='{.spec.syncPolicy}'
```

**Expect `{"syncOptions":["CreateNamespace=true"]}` with NO `automated` key.** If `automated` is
still there, Argo has not reconciled yet — wait, and re-check. Do not proceed.

```bash
kubectl -n shared-services get imageupdater image-updater \
  -o jsonpath='{range .spec.applicationRefs[*]}{.namePattern}{"\n"}{end}'
```

**Expect five lines: `econoflow`, `move`, `gelosorio`, `bfs`, `educontrol` — and no
`cesarbarbosa`.**

> **If either check fails, stop.** Proceeding means a merge in Phase D can auto-deploy the Npgsql
> build against the SQL Server database.

### C2. What the committed freeze changed, and what it did not

| File | Change |
|---|---|
| `apps/cesarbarbosa.yaml` | `syncPolicy.automated` (`prune` + `selfHeal`) removed. `CreateNamespace=true` and the destination untouched. |
| `argocd-image-updater/image-updater.yaml` | The `cesarbarbosa` `applicationRef` commented out. |

**Scope: `cesarbarbosa` only.** `root-app` keeps reconciling, so the other 18 applications
(`mail`, `econoflow`, `postgres`, …) are unaffected. This was verified by re-reading every
`apps/*.yaml`: `cesarbarbosa` is the only one without an `automated` block.

**Both halves were needed.** Disabling only Argo's `selfHeal` would still let the Image Updater's
git write-back land — so the digest would change in git and deploy the instant automation was
restored, at a moment nobody chose.

### C3. Stop the application

```bash
kubectl -n cesarbarbosa scale deploy/cesarbarbosa --replicas=0
kubectl -n cesarbarbosa get pods        # must be empty
```

Because the freeze is in git (C1), this now sticks. **Poll until there are no pods** — do not
proceed on a single check.

> **Note the drift this creates.** The cluster is now deliberately ahead of git (git says
> `replicas: 1`, the cluster runs 0). Argo will report `OutOfSync` but will not correct it, because
> automation is off. Phase E resolves this by letting Argo take ownership of whatever is committed
> by then — which is why Phase D **commits** its changes rather than only applying them.

Confirm no writers remain on SQL Server:

```sql
SELECT DB_NAME(dbid) AS db, COUNT(*) AS connections
  FROM sys.sysprocesses WHERE dbid = DB_ID('cesarbarbosa') GROUP BY DB_NAME(dbid);
```

---

## Phase D — Migrate, verify, switch (the outage)

### D1. Merge, now that nothing will auto-deploy

```bash
git checkout main
git merge feat/migrate_postgres
git push origin main
```

CI publishes again. Because Argo and the Image Updater are both suspended, **nothing deploys.**
This is the whole point of Phase C happening first.

### D2. Seal the PostgreSQL connection string

`POSTGRES_CONNECTION_STRING` is **not** in the secret yet. Add it, using the Phase A2 password:

```bash
kubectl -n cesarbarbosa get secret cesarbarbosa-credentials -o yaml > cesarbarbosa-credentials.yaml
```

Add this key, base64-encoded:

```
Host=postgres.shared-services.svc.cluster.local;Port=5432;Database=cesarbarbosa;Username=cesarbarbosa;Password=<A2-password>;SSL Mode=Disable
```

```bash
pwsh -File ./scripts/seal.ps1 -SecretFile ./cesarbarbosa-credentials.yaml `
  -SealedFile ./cesarbarbosa/cesarbarbosa-credentials-sealed.yaml -Namespace cesarbarbosa
rm cesarbarbosa-credentials.yaml
git add cesarbarbosa/cesarbarbosa-credentials-sealed.yaml
git commit -m "cesarbarbosa: add the PostgreSQL target connection string"
git push
```

Apply the secret directly. Argo's automation is off (Phase C), so it will not do this for you — but
**commit it anyway**, so restoring automation in Phase E does not revert the secret:

```bash
kubectl apply -f cesarbarbosa/cesarbarbosa-credentials-sealed.yaml
kubectl -n cesarbarbosa get secret cesarbarbosa-credentials \
  -o jsonpath='{.data.POSTGRES_CONNECTION_STRING}' | base64 -d
```

> This reads the SQL Server source from `CesarBarbosaDB`, which still points at SQL Server. **That is
> correct now and wrong after D5.** Leave the note in the Job's header alone; revisit it later.

### D3. Pin the Job to the SHA and run it

```bash
kubectl -n shared-services get application cesarbarbosa \
  -o jsonpath='{.spec.source.targetRevision}'
```

Edit `migrate-job.yaml`: set the image to `cesarbarbosa-migrator:<sha>` (**not** `:latest`), leave
`args: ["--migrate", "--truncate"]`, then:

```bash
kubectl -n cesarbarbosa delete job cesarbarbosa-migrate --ignore-not-found
kubectl -n cesarbarbosa apply -f cesarbarbosa/migrate-job.yaml
kubectl -n cesarbarbosa logs -f job/cesarbarbosa-migrate
```

**Require `MIGRATION VERIFIED` before continuing.** The site is down; stopping here costs nothing.

### D4. Verify independently

```bash
kubectl -n cesarbarbosa get job cesarbarbosa-migrate -o jsonpath='{.status.succeeded}'   # 1

kubectl -n shared-services exec -i deploy/postgres -c postgres -- \
  psql -U postgres -d cesarbarbosa -v ON_ERROR_STOP=1 < scripts/postgres-verify.sql
```

All orphan counts must be 0. Compare row counts with what you recorded, and confirm the comment
count matches exactly:

```sql
-- SQL Server                          -- PostgreSQL
SELECT COUNT(*) FROM Comment;           SELECT COUNT(*) FROM "Comment";
```

### D5. Repoint and start

Re-seal `CesarBarbosaDB` to the **PostgreSQL** string (same procedure as D2), and in
`cesarbarbosa/deployment.yaml` set `DATABASE_MANAGE_SCHEMA_AT_STARTUP: "false"`.

```bash
git commit -am "cutover: point CesarBarbosaDB at PostgreSQL"
git push
kubectl apply -k cesarbarbosa/            # Argo is suspended; apply by hand
kubectl -n cesarbarbosa rollout status deploy/cesarbarbosa
```

**The outage ends when the pod is Ready.**

---

## Phase E — Re-enable automation, then verify

### E1. Restore the automation — one commit, both halves

Restore **both** files together. Restoring only one redeploys immediately at a moment nobody chose:
Argo without the updater still syncs the `kustomization.yaml` digest the updater already wrote;
the updater without Argo writes a new digest that deploys the moment Argo returns.

```bash
# fps-software-server
git revert --no-commit 27d1b8e     # the freeze commit
```

Or edit by hand — put `syncPolicy.automated` back in `apps/cesarbarbosa.yaml`, and uncomment the
`cesarbarbosa` block in `argocd-image-updater/image-updater.yaml`.

**Before committing, check what the updater wrote while it was off.** The digest in
`cesarbarbosa/kustomization.yaml` should be the image you actually verified in Phase D:

```bash
grep -A2 'name: gitea.fpssoftware.uk/fps-software/cesarbarbosa' cesarbarbosa/kustomization.yaml
```

If the digest there is a *newer* build than the one you ran the cutover with, restoring automation
will deploy that newer image. That may be fine — but it is a deploy, so decide deliberately rather
than discovering it during Phase E.

```bash
git commit -m "cesarbarbosa: restore auto-deploy after the PostgreSQL cutover"
git push origin main
```

### E2. Confirm Argo took ownership

```bash
kubectl -n shared-services get application cesarbarbosa
kubectl -n shared-services get imageupdater image-updater \
  -o jsonpath='{range .spec.applicationRefs[*]}{.namePattern}{"\n"}{end}'
```

Expect the Application `Synced` / `Healthy` with an `automated` syncPolicy, and six lines from the
Image Updater with `cesarbarbosa` back.

**One pod restart here is expected and correct** — Argo is reconciling the drift created in C3
(the cluster was scaled to 0 while git said `replicas: 1`). What matters is that it stabilises:

```bash
kubectl -n cesarbarbosa get pods -w
```

> **If Argo rolls the pod more than once, or the pod does not become Ready, stop and investigate.**
> A steady restart loop after restoring automation means the app image and the committed manifest
> disagree — most likely the digest point above, or that a Phase D change was applied by hand and
> never committed.

### E3. Verify the live site

```bash
curl -s https://cesarbarbosa.com.br/api/health/ready
curl -s https://cesarbarbosa.com.br/api/infocompany
curl -s 'https://cesarbarbosa.com.br/api/post?page=0&pageSize=5'
curl -s 'https://cesarbarbosa.com.br/api/post/search?searchText=BUENOS'
```

Then browse: blog list, a post with gallery and comments, a portfolio page, admin login. **Look at
the images** — they come from MinIO, untouched by this migration.

### E4. After

- [ ] Add `cesarbarbosa` to the Databasement backup schedule — **the SQL Server backup no longer
      protects this data.**
- [ ] Keep SQL Server read-only and untouched for at least one backup cycle.
- [ ] Update the Job's `MIGRATION_SOURCE` (it still reads `CesarBarbosaDB`, now PostgreSQL — the
      Job's own header flags this).
- [ ] Decide whether `mssql` stays in `compose.yaml`.

---

## Rollback

The freeze is committed (Phase C), so rollback is "bring the old thing back" and Argo cannot
undo it.

| Failure | Do this | Loss |
|---|---|---|
| Phase A/B | Nothing — the site was never touched | none |
| C1–C3 | Revert the freeze commit on `main`; Argo restores the previous pod | none |
| D3 (the Job) fails | Leave the app at 0; fix; re-run (`--truncate` is idempotent) | none |
| D4/D5 looks wrong | Re-seal `CesarBarbosaDB` back to SQL Server, `--replicas=1` | none |
| After content was authored in PostgreSQL | Reverting loses it | the new writes |
| Anything during Phase E | Revert the restore commit; automation returns to suspended | none |

**The unrecoverable mistake:** starting the app (D5) before D3 reported `MIGRATION VERIFIED`.

> **Why rollback is cheap here.** The freeze keeps git as the source of truth throughout, so the
> cluster never holds state that git disagrees with for long. The one window where it does is C3
> (`--replicas=0` against a committed `replicas: 1`), and that is deliberate and short — resolved
> in E2.
