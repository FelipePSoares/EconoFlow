# WhiteLabel — project-specific brief for the SQL Server → PostgreSQL migration

**Read this first, then `docs/MIGRATION_TEMPLATE.md`.**

The `docs/` in this folder are the **reusable, project-agnostic** record from the pilot
(CesarBarbosa), which is project 1 of a five-project programme. They are written to be applied to
*any* .NET / EF Core project, so they deliberately do **not** describe WhiteLabel.

This file is the missing half: what is different about **this** repository, checked by reading the
code rather than assumed. Where the docs and this file disagree about WhiteLabel, **this file
wins** — the docs describe the pilot's shape.

> The docs say the engine "is now a package". Verify that before relying on it — see §7.

---

## 1. The facts that change the plan

| | CesarBarbosa (pilot) | **WhiteLabel (this repo)** |
|---|---|---|
| Shape | Angular SPA + Web API, JWT | **Razor Pages**, cookie auth |
| DbContexts | **one** (`CesarBarbosaDatabaseContext`) | **two** — see §2 |
| Migrations | one folder, one context | **two folders in two projects** — see §2 |
| Project layout | `...Persistence` | **`WhiteLabel.Repository`** + `WhiteLabel/Config/` |
| Health check | `AspNetCore.HealthChecks.SqlServer` package | **hand-written `SqlServerHealthCheck`** — see §4 |
| Connection string | env var `CesarBarbosaDB` | **`ConnectionStrings:DefaultConnection`** — see §5 |
| Rehearsal SQL port | 14330 | container publishes **1433** — see §6 |
| `compose.yaml` | real compose file | **a one-line `docker run`** — see §6 |
| `nuget.config` | present | **absent — must be added** — see §7 |
| Shared schema | none | **`HasDefaultSchema("Admin")`** — see §2 |

---

## 2. Two DbContexts — the biggest structural difference

The pilot has **one** context, so `MigrationProfile.CreateContext` returning one `DbContext` was
never a question. WhiteLabel has two, and they are **not** in the same project:

| Context | File | Migrations live in | Schema |
|---|---|---|---|
| `WhiteLabelContext` | `WhiteLabel/Config/WhiteLabelContext.cs` | `WhiteLabel/Migrations/` | default (`public`) |
| `AdminContext` | `WhiteLabel.Repository/AdminContext.cs` | `WhiteLabel.Repository/Migrations/` | **`Admin`** |

Both are registered against the **same** connection string in `Startup.ConfigureServices`:

```csharp
services.AddDbContext<WhiteLabelContext>(options =>
    options.UseSqlServer(Configuration.GetConnectionString("DefaultConnection")));
services.AddDbContext<AdminContext>(options =>
    options.UseSqlServer(Configuration.GetConnectionString("DefaultConnection")));
```

`AdminContext.OnModelCreating` sets `modelBuilder.HasDefaultSchema("Admin")`, so its tables live in
the `Admin` schema, not `public`. **This matters for four separate things:**

1. **The migrator plan.** `TablePlan.TargetTable` must be schema-qualified for admin tables
   (`Admin."Expense"`, not `"Expense"`), and `SourceTable` similarly (`Admin.Expense`) — the source
   schema on SQL Server is also `Admin`.
2. **`--truncate`.** The generated `TRUNCATE TABLE a, b, c CASCADE` must carry the schema.
3. **Sequence resync.** `pg_get_serial_sequence('"Table"', 'Id')` will fail for a table in the
   `Admin` schema unless the identifier is qualified. This is the pilot's documented trap
   (unquoted identifiers fold to lowercase) with a second twist: unqualified names resolve via
   `search_path` and will silently miss `Admin`.
4. **`MigrationProfile.CreateContext`.** The engine calls it to apply migrations via `Schema.cs`.
   **A single overload cannot migrate both contexts.**

### Decide this before writing code

`Schema.cs` in the engine expects one context. WhiteLabel must resolve this deliberately — the
options, in the order I would try them:

- **A. Two migrator hosts** (e.g. `tools/WhiteLabel.DataMigration` handling the app schema, and a
  second host or a `--context` switch for `Admin`). Cleanest, but the plan/profile contract is
  currently one-per-process (`MigrationProfile.Use` **throws if called twice**), so two hosts means
  two processes.
- **B. One profile, migrations applied per context, copy driven by one plan.** Apply both contexts'
  migrations sequentially during the schema phase, then have the single plan cover both schemas.
  Likely the smallest change — but it requires the engine's `Schema.cs` to accept more than one
  context, i.e. **an engine change and a package version bump**. Check whether the engine already
  supports this before assuming it does not.
- **C. Verify whether `AdminContext` is even still in use.** It carries its own migration history
  and 7 migrations ending in `20240116202134_AddInternalProductLogic`. If the Admin area was
  superseded, dropping it from the migration scope is the correct and cheapest answer. **Confirm
  with the owner rather than deciding from the code alone.**

Also note: `AdminContext` declares `DbSet<Product> Products` while `WhiteLabelContext` also declares
`DbSet<Product> Products`. These are **different types** in different namespaces
(`WhiteLabel.Domain.Models.Product` vs `WhiteLabel.Models.Product`). Do not let a plan merge them —
they are separate tables.

---

## 3. The app-side work the docs describe, applied here

The docs' §4 checklist is correct and complete; the mapping onto this repo is:

- `UseSqlServer` → `UseNpgsql` in **`Startup.cs` (two call sites, lines 39–45)**. There is no
  `#if DEBUG` provider branch here, so step 3 of the runbook ("move provider selection to runtime")
  is a *smaller* job than the pilot's — but the same reasoning applies if you introduce
  `EF Core InMemory`: `WhiteLabel.csproj` already references
  `Microsoft.EntityFrameworkCore.InMemory` 10.0.11.
- **Remove `Microsoft.EntityFrameworkCore.SqlServer` from both projects** — it is in
  `WhiteLabel/WhiteLabel.csproj` (line 19) *and* `WhiteLabel.Repository/WhiteLabel.Repository.csproj`
  (line 12). The docs warn specifically that a redundant reference in the web project is easy to
  miss and keeps SQL Server loadable.
- Add `Npgsql.EntityFrameworkCore.PostgreSQL` (the pilot pinned **10.0.3** and pinned
  `Microsoft.EntityFrameworkCore` **explicitly at 10.0.11** because Npgsql 10.0.3 needs EF Core
  ≥ 10.0.4). WhiteLabel is already on EF Core 10.0.11, so no downgrade risk — but keep the explicit
  pin so NuGet cannot resolve lower.
- **`Nullable` is `disable`** in all WhiteLabel projects (`<Nullable>disable</Nullable>`). The
  engine is `<Nullable>enable</Nullable>`. Consuming the package from a nullable-oblivious project is
  fine, but do not be surprised by warnings; do **not** flip `Nullable` as part of this migration —
  that is an unrelated, large change.
- **No raw SQL found.** I grepped for `FromSqlRaw` / `ExecuteSqlRaw` / `ExecuteSqlInterpolated` /
  `GETDATE` / `ISNULL` / `[dbo]` / `TOP`: **no matches outside generated migration files**. So the
  docs' "fix raw SQL" step is likely a no-op here. Re-run the grep yourself to confirm before
  skipping it.
- **No `HasCollation` / `UseCollation` / `InvariantGlobalization` found.** Adding
  `<InvariantGlobalization>true</InvariantGlobalization>` would be **fatal on the migrator**
  (docs §3.8) — do not add it.

### `citext` / `pg_trgm` — audit these, do not copy wholesale

The pilot needed `citext` because SQL Server's `SQL_Latin1_General_CP1_CI_AS` collation made
`Tag.Name`, `AspNetUsers.UserName` and `AspNetUsers.Email` case-insensitive.

**WhiteLabel's source collation has not been checked.** Before mapping anything to `citext`, find
the source database's actual collation — the docs' §0 policy is "decide per column, not globally",
and applying `citext` where the source was already case-*sensitive* would be a behaviour change in
the opposite direction. WhiteLabel has no `AspNetUsers` (cookie auth, no Identity), so the pilot's
identity-specific `citext` work does not apply.

Unique indexes over text that need the audit (docs §4: "without `citext` the index starts accepting
`Cultura` and `cultura`"):

- `WhiteLabel.Repository/Mapping/ClientProductMap.cs:23` —
  `HasIndex(o => new { o.ProductId, o.ClientId }, "IX_Product_Client_Unique").IsUnique()`
- `AdminContextModelSnapshot` — `HasIndex("ProductUsedToMakeId").IsUnique()`

Both are **integer/GUID** composite keys by the look of them, so `citext` is probably irrelevant
here — **verify** rather than assume, since that is exactly the class of thing that fails silently.
`pg_trgm` is only needed if there is a leading-wildcard `ILIKE '%term%'` search; I found no such
search in WhiteLabel, so **`ciText`/`pg_trgm` may both be unnecessary**. Decide from the code, and
if neither is needed, `RequiredExtensions` returns an empty list and the check is skipped.

---

## 4. The health check is hand-written and will silently lie

The docs say "swap `AspNetCore.HealthChecks.SqlServer` → `AspNetCore.HealthChecks.Npgsql`".
**WhiteLabel uses neither package.** It has a custom check:

`WhiteLabel/HealthChecks/SqlServerHealthCheck.cs` injects `WhiteLabelContext` and calls
`dbContext.Database.CanConnectAsync()`.

Registered in `Startup.ConfigureServices` (line 36–37):

```csharp
services.AddHealthChecks()
    .AddCheck<WhiteLabel.HealthChecks.SqlServerHealthCheck>("sqlserver");
```

Two things to note:

1. Because it goes through EF Core, **it will keep working after the provider swap** — it compiles
   and returns Healthy against Postgres. So it is *not* a startup failure like the pilot's package
   swap. That is precisely why it is dangerous: the check's **name** (`"sqlserver"`) and its class
   name become lies, and any Kubernetes probe or dashboard keyed on `"sqlserver"` keeps reporting a
   healthy "SQL Server" that no longer exists.
2. **Rename them** (`PostgresHealthCheck`, tag `"postgres"`) as part of the change, and grep the
   deployment manifests for the old name before you do.

`Startup.Configure` exposes `/healthcheck/readness` (readiness, runs the check) and
`/healthcheck/liveness` (predicate `_ => false`, no dependency checks). Keep that split — it is
correct and the docs' reasoning about it matches.

---

## 5. The app's connection-string variable — there is none to preserve

The docs say: **keep the old env var name** if deployments already set it, because renaming it is a
second unnecessary change during a cutover (docs §4, and `MIGRATION_TEMPLATE.md` §1).

WhiteLabel reads:

```json
"ConnectionStrings": { "DefaultConnection": "" }
```

i.e. a **configuration key**, currently empty in `appsettings.json`, not an env var. ASP.NET Core
maps `ConnectionStrings__DefaultConnection` (double underscore) to that key, so **the deployment
very likely already sets that form**. Check the manifests and keep it.

Therefore:

- `AppConnectionVariable` should be **`ConnectionStrings__DefaultConnection`** if the deployment
  uses the env-var form, or you pass `--app-env-var ConnectionStrings__DefaultConnection`.
- It is overridable at run time via `MIGRATION_APP_CONNECTION_VAR` or `--app-env-var`, so this
  rarely needs editing in code.
- **Confirm the actual name in the deployment before the cutover** — do not guess it from
  `appsettings.json` alone. There is **no `Dockerfile`, no k8s manifest and no deployment repo
  inside this repository**; the only CI is `.github/workflows/docker-publish.yml`. Find where
  WhiteLabel is actually deployed before Phase 1 of `CUTOVER.md`.

---

## 6. `compose.yaml` is not a compose file

`D:\Sources\WhiteLabel\compose.yaml` currently contains **one line — a raw `docker run` command**,
not YAML:

```
docker run -e 'ACCEPT_EULA=Y' -e 'MSSQL_SA_PASSWORD=Teste*123' -p 1433:1433 ... mcr.microsoft.com/mssql/server:2022-latest
```

Consequences:

- It **cannot** be used as `docker compose --profile rehearsal up`, which is what the docs'
  rehearsal procedure assumes. Either convert it to real compose YAML (preferred — copy the
  structure from the pilot's `compose.yaml`) or run the `docker run` form manually.
- It maps SQL Server to **host port 1433**, and the password is committed in plaintext
  (`Teste*123`). The pilot deliberately used **14330** to avoid colliding with a local SQL Server or
  LocalDB. If you keep 1433, expect collisions.
- **Add the PostgreSQL service.** WhiteLabel has no Postgres service at all yet; the pilot's
  `compose.yaml` (in the CesarBarbosa repo) has `postgres:17-alpine` plus the
  `./scripts/postgres-init` mount that pre-enables extensions on a fresh volume. That mount is the
  only reason `scripts/postgres-init/01-extensions.sql` in this pack matters, and it "only runs
  against a fresh volume".
- Consider removing the plaintext SA password from a committed file while you are in there.

---

## 7. `nuget.config` must be added, and the package must be verified

`nuget.config` is **absent from WhiteLabel**, so the private feed cannot resolve at all — restore
fails with "package not found" regardless of whether the package is published. The copy in this
pack is the pilot's, verbatim, and is what you need:

```xml
<add key="fps-software" value="https://gitea.fpssoftware.uk/api/packages/fps-software/nuget/index.json" />
```

It authenticates with `%GITEA_NUGET_USERNAME%` / `%GITEA_NUGET_TOKEN%`, so those must be set in the
environment (locally and in CI).

**Confirm the package exists before building the host around it.** The intended reference is:

```xml
<PackageReference Include="FpsSoftware.DataMigration" Version="1.0.0" />
```

As of this writing the version in the pilot repo is **`1.0.0`** (`PackageId`
`fpssoftware.datamigration`, lowercase, matching `fpssoftware.chassis`; NuGet resolves ids
case-insensitively). Verify against the feed — do not trust this note, and do not assume the pilot's
own repo is a guide here:

> **CesarBarbosa itself still uses a `ProjectReference` to `FpsSoftware.DataMigration/`, not the
> package** — the `PackageReference` line sits commented out in
> `tools/CesarBarbosa.DataMigration/CesarBarbosa.DataMigration.csproj`. So **WhiteLabel would be the
> first real consumer of the package**, and the docs' claim that "the engine is now a package" is
> aspiration until a restore proves it. If restore fails, that is a finding about the package, not
> about WhiteLabel — report it rather than silently falling back to copying the engine source.

Check it with (needs credentials):

```powershell
dotnet package search fpssoftware.datamigration `
  --source https://gitea.fpssoftware.uk/api/packages/fps-software/nuget/index.json
```

**Fallback if the package is missing:** copy `FpsSoftware.DataMigration/` from the pilot repo as a
project and use a `ProjectReference`, exactly as the pilot does today. The engine is packageable by
design (no `ProjectReference` to any application, no project-specific values) — check those two
rules still hold with the grep in `MIGRATION_TEMPLATE.md` §1 before copying it.

---

## 8. What a WhiteLabel migration host still has to supply

Per `MIGRATION_TEMPLATE.md` §1, a project supplies a plan + a profile + a one-line `Program.cs`.
Skeleton files are in `host-skeleton/` in this pack:

- `Program.cs` — 3 statements; register the profile, call `MigrationHost.RunAsync(args)`.
- `WhiteLabelMigrationProfile.cs` — `AppConnectionVariable`, rehearsal defaults,
  `RequiredExtensions` (**possibly empty — see §3**), `Tables`, `SequencesToResync`,
  `CreateContext`.
- `MigrationPlan.cs` — **do not hand-write this.** Generate a draft from the live catalog:

  ```powershell
  MIGRATION_SOURCE="Server=localhost,1433;Database=<db>;User Id=sa;Password=<pwd>;TrustServerCertificate=True;Encrypt=True" `
    dotnet run --project tools/WhiteLabel.DataMigration -- --generate-plan > MigrationPlan.cs
  ```

  Then review it against the **five things a generator cannot know**: table order for FKs, key
  columns, timestamp coercion, every `<UNMAPPED>` type, and which tables to exclude. Fix every
  `<UNMAPPED>` and every `NO KEY COLUMN`.

- The `CreateContext` implementation must name a real `DbContext` and **both contexts**, if §2 lands
  on option B.
- `KeyColumns` — a table with an `Id` defaults to `["Id"]`; join tables (e.g. `OrderProduct`,
  `ClientProduct`, `JobItem`) must state their key explicitly, or `--check-schema` reports
  `NO KEY COLUMN`.
- `SequencesToResync` — only tables with an **integer identity** column. WhiteLabel's keys appear to
  be GUID/int; **check each table**, because a missed sequence means the app's first INSERT collides
  with a copied key (docs §5).

---

## 8b. FINDINGS from the production snapshot — read before writing the plan

Everything below was read out of `.backup/bfs-restore-2026-10-09/dump.dacpac` (its `model.xml`
carries schema **and** data) and cross-checked against the EF model. Two of these contradict what
the rest of this pack assumed, and both change the work.

### 1. The source collation is CONFIRMED case-insensitive

`model.xml` states it directly:

```xml
<Element Type="SqlDatabaseOptions">
  <Property Name="Collation" Value="SQL_Latin1_General_CP1_CI_AS" />
  <Property Name="CollationCaseSensitive" Value="False" />
```

§3 of this file says to check this rather than assume, and to add `citext` only for columns compared
for equality. The audit found exactly one such column that matters —
`Users.Email`, compared in `Pages/Login/Index.cshtml.cs` with
`FirstOrDefault(user => user.Email == this.Email)`, i.e. **equality against a value the user typed**.
It is mapped to `citext`. `pg_trgm` is **not** needed: there is no wildcard search anywhere.
`RequiredExtensions` is therefore `["citext"]`, not the pilot's two.

The only unique index, `Admin.IX_Product_Client_Unique`, is a composite over two GUIDs, so `citext`
is irrelevant to it.

### 2. The live `Admin` schema is 6 MIGRATIONS BEHIND the model — this is expected, not drift

The snapshot's single `__EFMigrationsHistory` contains:

```
20210916211038_InitialCreation        (public)
20210916213301_AlterConfigModel       (public)
20210918000210_AddProduct             (public)
20211002133808_ProductImage           (public)
20230305204649_AdminArea              (Admin)   <-- Admin stops here
20260829182931_AddS3MediaKeys         (public)
```

So the six later Admin migrations (`AddOrderAndProduct`, `AddedProductToStock`, `RemoveSalePage`,
`AddOrderIdToStock`, `CreateConstrainToAvoidDuplication`, `AddInternalProductLogic`) **never ran in
production**. The consequence is visible in the schema:

| Live `Admin` table | Model expects |
|---|---|
| `Clients`, `Expenses`, `Sales`, `Stocks` | `Clients`, `Expenses`, `Orders`, `OrderProducts`, `Products`, `Stocks`, `ClientProducts` |

`Admin.Sales` is the pre-`RemoveSalePage` table, and `Orders`/`OrderProducts`/`ClientProducts` do not
exist at all. **Owner's confirmation: "it really never ran there in production."** This is therefore
the correct migration input, not a stale backup — the old `dump.dacpac` at `.backup/` root was the
stale one.

Practical consequences:

1. The public-schema plan in `tools/WhiteLabel.DataMigration/MigrationPlan.cs` is written against
   **this** schema and matches it table-for-table and column-for-column.
2. The `Admin` schema cannot be migrated from a plan generated from the model — there is nothing to
   copy for the ordering tables, and `Sales` has no counterpart. Its data is empty anyway (the
   snapshot contains no `Data/dbo`… folders for any `Admin` table).
3. After the cutover, the new PostgreSQL database gets the **current** model for `Admin` (that is what
   "add everything with the admin" means), so the six pending migrations simply run there for the
   first time. No data is lost: there is none.

### 3. One shared migration history, not two — and that is also true of the new one

The live database has **one** `dbo.__EFMigrationsHistory` holding both contexts' migrations.

**Correction to an earlier draft of this section:** it said the new PostgreSQL baseline would
"resolve this into one history table per context". That is wrong, and the rehearsal proved it. EF Core
keeps its history table in the **default** schema and `HasDefaultSchema("Admin")` does **not** move
it, so `AdminContext` also writes to `public.__EFMigrationsHistory`. After applying both baselines the
database has exactly one such table, holding both:

```
20261009183833_InitialPostgres
20261009183915_InitialPostgresAdmin
```

That is normal EF behaviour and is safe: each context reads only its own rows, and the ids are
distinct. It is also exactly how the live SQL Server database already worked, so nothing about this
changes at cutover.

The practical consequence is for **verification**, not for correctness: do not assert that an
`Admin.__EFMigrationsHistory` exists — it never will. Assert instead that the single history table
contains **both** baselines. A missing Admin row means the Admin migrations never ran, which is
possible even while its tables exist.

### 4. Every key is a GUID — `SequencesToResync` is empty

All 12 public tables use `Id uniqueidentifier`. The only integer columns are payload
(`Configs.BaseWebSite`, `Configs.BaseColor`, `Menu.Title`), none database-generated. So there is no
sequence to realign after `COPY`, and an empty `SequencesToResync` is correct rather than an
oversight. **Check the Admin plan separately** rather than assuming the same.

Also note: the EF entity is `IndexConfig` but the **table is named `Index`**, so a plan written from
the model would report `MISSING TABLE` for it.

### 5. REHEARSED END TO END — and the two failures it caught

The whole path was run locally against a real SQL Server container loaded from the production
snapshot, and a real PostgreSQL:

```
docker compose up -d --wait                                   # postgres + mssql
sqlpackage /Action:Publish /SourceFile:.backup/bfs-restore-2026-10-09/dump.dacpac \
  /TargetConnectionString:"Server=localhost,14330;Database=construtorabfs;..."
dotnet ef database update --context WhiteLabelContext          # public baseline
dotnet ef database update --context AdminContext               # Admin baseline
dotnet run --project tools/WhiteLabel.DataMigration -- --migrate --truncate
```

Result: **`MIGRATION VERIFIED` — 12 tables, every one matching the source by row count and SHA-256
digest.** All 12 orphan checks returned 0. The app then ran against the migrated database: liveness
200, readiness 200 `Healthy`, and every page (home, AboutUs, Contact, Products, Jobs, Login) rendered
200. It was then proven repeatable — schema dropped with `database update 0`, rebuilt, re-copied, and
the digests came back identical.

**Two things failed first, and neither is in the migration tool:**

1. **`42501: permission denied for schema public`.** The PostgreSQL role did not own its database.
   `CREATE DATABASE` had been run *as* `postgres`, so `postgres` owned both the database and the
   `public` schema regardless of which role it was meant for — and PostgreSQL 15+ additionally
   revoked the implicit CREATE grant on `public`. Nothing to do with Npgsql or EF Core; the
   application simply cannot create tables. **This is the exact thing `CUTOVER_PREFLIGHT.md` A2 tells
   you to verify** (`expect cesarbarbosa|cesarbarbosa`), and it is why that check exists. Fixed in
   `compose.yaml` by setting the owner explicitly *and* asserting it, so the rehearsal cannot pass
   while production would fail.

2. **`permission denied for schema Admin`** — the same cause, one level down, for the `Admin` schema.

**The `citext` decision was verified, not merely made.** Through EF Core, with the real migrated row:

```
typed "felipepsoares@outlook.com.br"  -> FOUND
typed "FELIPEPSOARES@OUTLOOK.COM.BR"  -> FOUND
typed "FelipePSoares@Outlook.Com.Br"  -> FOUND
Control - Users.Name is plain text:  'felipe' -> not found, 'FELIPE' -> not found
```

The control matters: it shows the difference comes from the **column type**, not from a
case-insensitive server. Without `citext` the admin login would have become case-sensitive and the
only way to notice would have been a user unable to log in. Run it with
`dotnet run --project tools/WhiteLabel.LoginCheck -- "<postgres connection string>"`; it exits
non-zero on failure so it can gate a cutover.

### 6. THE ENGINE CANNOT ADDRESS A NON-DEFAULT SCHEMA — a finding for the shared tool

**This is the one place the shared engine does not fit, and it is a real limitation rather than a
WhiteLabel mistake.** It blocks copying `Admin` rows; it does not block creating the `Admin` schema,
which is what the cutover actually needs.

The engine's quoting helper is:

```csharp
private static string Quote(string identifier) => $"\"{identifier.Replace("\"", "\"\"")}\"";
```

and it is applied to the **whole** `SourceTable` / `TargetTable` string:

```csharp
select.Append(" FROM ").Append(Quote(plan.SourceTable)).Append(';');
var copySql = $"COPY {Quote(plan.TargetTable)} ({copyColumns}) FROM STDIN (FORMAT BINARY)";
var sourceCount = await ScalarAsync(source, $"SELECT COUNT(*) FROM {Quote(plan.SourceTable)};");
```

So neither spelling of a qualified name survives:

| Written in the plan | Engine emits | Result |
|---|---|---|
| `Admin.Clients` | `"Admin.Clients"` | `42P01: relation "Admin.Clients" does not exist` — one identifier whose *name* contains a dot |
| `Admin."Clients"` | `"Admin.""Clients"""` | also wrong; the quotes are re-escaped |

Neither works on SQL Server either: `Quote` is shared, and SQL Server's `QUOTED_IDENTIFIER` treats
`"Admin.Clients"` the same way.

**The form that does work is a bare table name plus `search_path`.** With
`search_path = "Admin", public`, the engine's own `TRUNCATE`, `COPY` and `COUNT(*)` all resolve
`"Clients"` to `Admin.Clients` — verified by running them.

**Why that workaround is rejected.** A bare name is resolved by `search_path`, which is
per-connection state the engine never sets, so correctness would rest on a connection-string option
being present in every environment and every host. The failure mode is not a loud error: with
`search_path` unset, `"Products"` resolves to **`public.Products`** — measured, that returned **1
row** while `Admin.Products` has **0**. A silent cross-schema copy of the wrong table is far worse
than a tool that refuses to run.

**What WhiteLabel does instead, per host:**

| Host | `--migrate-only` | row copy |
|---|---|---|
| `WhiteLabel.DataMigration` (public) | ✅ works | ✅ works — `MIGRATION VERIFIED`, 12 tables |
| `WhiteLabel.AdminDataMigration` (`Admin`) | ✅ works | ⛔ refuses; needs engine support |

The Admin schema is created by `AdminContext`'s own migrations, which are schema-aware through
`HasDefaultSchema("Admin")` and therefore unaffected. That is the whole requirement here, because
production has **no Admin rows to copy** — the six ordering migrations never ran there (§8b).

**For the shared tool, the fix is a schema-aware `Quote`** — split on the first `.` and quote each
part, or add a `Schema` property to `TablePlan` so the schema is data rather than string
concatenation. Until then, a second project with a non-default schema will hit exactly this, and the
`AdminMigrationPlan` in this repo carries the same warning at the point of use.

---

## 9. Suggested order for the session

1. **Read `docs/MIGRATION_TEMPLATE.md` §0–§1**, then this file.
2. **Decide §2** (two contexts) and **§7** (package present?) — both block real work, both are cheap
   to answer, and guessing either wastes the session.
3. Confirm the source collation (§3) and the deployment's connection-string key (§5).
4. `--generate-plan` against the live SQL Server (read-only), review, `--check-schema`.
5. App-side provider swap (§3) + health check rename (§4).
6. Schema, then data, then verify — `docs/DATABASE_MIGRATION.md` Part 5 runbook.
7. Cutover with `docs/CUTOVER.md` + `docs/CUTOVER_PREFLIGHT.md`. **The pilot's §8b is the most
   valuable part of the whole pack** — it is the list of things that actually went wrong, dominated
   by the deployed image being the old SQL Server build.

## 10. Files in this pack

| Path | Use |
|---|---|
| `WHITELABEL_NOTES.md` | this file — read first |
| `docs/DATABASE_MIGRATION.md` | how it works + the pitfalls in depth (Part 3 is the checklist) |
| `docs/MIGRATION_TEMPLATE.md` | per-project order of work; what is generic vs per-project |
| `docs/CUTOVER.md` | operational runbook for the switch |
| `docs/CUTOVER_PREFLIGHT.md` | account creation + corrected ordering — read before deploying |
| `docs/DEPLOY.md` | literal commands in order |
| `scripts/postgres-init/01-extensions.sql` | **REWRITTEN for WhiteLabel**: `citext` + the `Admin` schema, no `pg_trgm` |
| `scripts/sqlserver-readonly-login.sql` | read-only source login for the migrator; copy, set the password |
| `scripts/postgres-verify.sql` | **REWRITTEN for WhiteLabel** — both schemas, 12 orphan checks, the `citext` assertion |
| `nuget.config` | copy to the repo root; without it nothing resolves from the feed |
| `host-skeleton/` | superseded — see `tools/WhiteLabel.DataMigration` and `tools/WhiteLabel.AdminDataMigration` |

### Two hosts in this repository (the `host-skeleton/` answer)

| Project | Context | Schema | Copies rows? |
|---|---|---|---|
| `tools/WhiteLabel.DataMigration` | `WhiteLabelContext` | `public` | yes |
| `tools/WhiteLabel.AdminDataMigration` | `AdminContext` | `Admin` | no — see §6 |

Run them in that order: `--migrate-only` on each creates both schemas, then the public host copies.

