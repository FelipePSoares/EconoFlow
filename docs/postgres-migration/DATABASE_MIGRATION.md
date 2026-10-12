# SQL Server → PostgreSQL migration

What this document is: a record of the completed, verified migration of CesarBarbosa from SQL Server to
PostgreSQL, plus the reusable procedure for repeating it on another .NET / EF Core project.
Part 1 documents this repo file by file, Part 2 the data-copy tool, **Part 3 the behavioural pitfalls you must
audit in any project**, Part 4 how the result was proven, Part 5 a generic runbook, Part 6 what is still open.
The application's own UI/text is pt-br; this document is English like the rest of `docs/`.

Stack: .NET 10, EF Core 10.0.11, `Npgsql.EntityFrameworkCore.PostgreSQL` 10.0.3, PostgreSQL 17
(`postgres:17-alpine`), SQL Server 2022 (`mcr.microsoft.com/mssql/server:2022-latest`) present only as a
**rehearsal source**.

---

## TL;DR / the whole migration in commands

```powershell
# 0. Tooling: sqlpackage is a dotnet global tool, not part of the SDK.
dotnet tool install --global microsoft.sqlpackage

# 1. Bring up the rehearsal stack (postgres + minio + mssql, the last behind a profile).
docker compose --profile rehearsal up -d --wait

# 2. Materialise the production data-tier application package into the SQL Server container.
#    .backup/dump.dacpac contains schema AND data (that is what a dacpac is).
sqlpackage /Action:Publish /SourceFile:.backup\dump.dacpac `
  /TargetConnectionString:"Server=localhost,14330;Database=CesarDacpac;User Id=sa;Password=<pwd>;TrustServerCertificate=True;Encrypt=True"

# 3. Create the Postgres schema from the EF Core baseline migration.
$env:CesarBarbosaDB = "Host=localhost;Port=5432;Database=cesarbarbosa;Username=cesarbarbosa;Password=cesarbarbosa"
dotnet ef database update --project CesarBarbosa.Persistence --startup-project CesarBarbosa.Persistence

# 4. Copy every row, then verify counts and per-table SHA-256 digests.
#    Exits non-zero on any mismatch.
dotnet run --project tools/CesarBarbosa.DataMigration -- --truncate
```

Useful variants:

```powershell
dotnet run --project tools/CesarBarbosa.DataMigration -- --verify-only      # compare, copy nothing
dotnet run --project tools/CesarBarbosa.DataMigration -- --migrate-only     # apply schema, copy nothing
dotnet run --project tools/CesarBarbosa.DataMigration -- --dump PostTag     # show the first differing row
dotnet run --project tools/CesarBarbosa.DataMigration -- --help
```

A copy refuses to start unless the target schema is already current (`Schema: NOT READY - ... Run
with --migrate first`), so a copy can never half-succeed against an unmigrated database.

It also refuses to run when `--source` and `--target` resolve to the **same endpoint**. That guard
exists because the target falls back to the `CesarBarbosaDB` environment variable — which, during
an in-cluster cutover, holds the *SQL Server* connection string. A missing or mis-keyed
`MIGRATION_TARGET` would therefore have aimed a truncating copy at the system of record. The check
compares host+database, not just the string, so it still catches a differently-spelled equivalent
(`localhost,14330` vs `localhost:14330`).

> **Procedural companion.** This document is the *how it works / how to repeat it* reference. For
> the actual switch on this cluster — the ordered cutover with its freeze window, in-cluster
> migration Job and rollback plan — see [`CUTOVER.md`](CUTOVER.md).

Result of the run recorded in Part 4: **15 tables, every table matching the source by row count and by a
SHA-256 digest over all rows.**

---

## Part 1 — What this repository did

### 1.1 Packages: `CesarBarbosa.Persistence/CesarBarbosa.Persistence.csproj`

```diff
-<PackageReference Include="Microsoft.EntityFrameworkCore.SqlServer" Version="10.0.11" />
-<PackageReference Include="AspNetCore.HealthChecks.SqlServer" Version="..." />
+<PackageReference Include="Npgsql.EntityFrameworkCore.PostgreSQL" Version="10.0.3" />
+<PackageReference Include="AspNetCore.HealthChecks.NpgSql" Version="9.0.0" />
+<PackageReference Include="Microsoft.EntityFrameworkCore" Version="10.0.11" />
```

Why the explicit `Microsoft.EntityFrameworkCore` 10.0.11 reference: Npgsql 10.0.3 requires EF Core
**>= 10.0.4**, and pinning it explicitly keeps the whole stack on 10.0.11 instead of letting NuGet resolve a
lower EF Core than the rest of the solution. The health-check package had to be swapped too — an
`AspNetCore.HealthChecks.SqlServer` probe against a Postgres connection string fails at startup.

`CesarBarbosa.Application/CesarBarbosa.Application.csproj` also gained
`Npgsql.EntityFrameworkCore.PostgreSQL` 10.0.3, deliberately and explicitly: the only relational provider is
PostgreSQL, `EF.Functions.ILike` has no provider-neutral spelling, and the dependency should be visible there
rather than arriving transitively.

Audit **every** project for the old provider, not just the persistence one. `CesarBarbosa.Server.csproj` also
carried a `Microsoft.EntityFrameworkCore.SqlServer` reference; it is redundant once the provider is configured
by the persistence layer, and it was removed too:

```diff
-<PackageReference Include="Microsoft.EntityFrameworkCore.SqlServer" Version="10.0.11" />
+<!-- Relational provider comes from CesarBarbosa.Persistence (Npgsql). -->
```

After the sweep, `Microsoft.Data.SqlClient` remains only in the data-migration tool, which *must* talk to the
source database.

### 1.2 Provider selection moved from compile time to run time

New `CesarBarbosa.Persistence/DatabaseOptions.cs` (section `Database`):

| Key | Default | Environment override |
|---|---|---|
| `Provider` | `PostgreSql` (or `InMemory`) | `DATABASE_PROVIDER` |
| `ConnectionString` | empty | `CesarBarbosaDB` |

`CesarBarbosaDB` is the name the SQL Server deployment used and is **kept** so existing deployment manifests
keep working after the cutover. The environment variables win over configuration. An unknown provider name
throws at startup instead of silently falling back to a store that would lose data.

New `CesarBarbosa.Persistence/DatabaseProviderInfo.cs`: the `DatabaseProvider` enum (`InMemory = 0`,
`PostgreSql = 1`) and a singleton `DatabaseProviderInfo(provider, connectionString)` with an `IsRelational`
flag, registered in DI so startup code can branch without re-reading configuration.

**Before:** `#if DEBUG` chose InMemory, `#else` chose SQL Server — a compile-time property, so a Debug build
could not be pointed at a real database at all. **After:** `PersistenceServiceRegistration.AddPersistenceServices`
reads the options, applies the environment overrides, resolves the enum, registers `DatabaseProviderInfo`, and
only then configures the `DbContext`.

### 1.3 `CesarBarbosa.Persistence/PersistenceServiceRegistration.cs`

```csharp
case DatabaseProvider.PostgreSql:
    if (string.IsNullOrWhiteSpace(databaseOptions.ConnectionString))
        throw new InvalidOperationException("No PostgreSQL connection string configured. ...");

    // SplitQuery keeps large aggregate reads (a Post with its images, comments
    // and tags) from exploding into a cartesian product - the same reason the
    // SQL Server build set UseQuerySplittingBehavior.
    options.UseNpgsql(databaseOptions.ConnectionString, npgsqlOptions =>
        npgsqlOptions.UseQuerySplittingBehavior(QuerySplittingBehavior.SplitQuery));
    break;
```

The health check is registered as a readiness dependency only for the relational provider:

```csharp
healthChecksBuilder.AddNpgSql(databaseOptions.ConnectionString,
    name: "database", tags: new[] { "db", "postgres" });
```

`UseMigration()` (which calls `dbContext.Database.Migrate()`) returns early when
`!providerInfo.IsRelational`, i.e. it is a no-op for InMemory, which has no schema.

### 1.4 `CesarBarbosa.Persistence/CesarBarbosaDatabaseContextFactory.cs`

The `IDesignTimeDbContextFactory<T>` used by `dotnet ef` was switched to `UseNpgsql`. **This file decides the
SQL dialect of every generated migration**, so it must always match production and must never be switched by
`#if DEBUG`. It reads `CesarBarbosaDB` and falls back to a local `cesarbarbosa_designtime` connection string.

### 1.5 Migrations: three deleted, one fresh baseline

Deleted (all SQL Server dialects):

- `Migrations/20260831090325_InitialCreate.*`
- `Migrations/20260901091131_RemovePortfolioCategoryProject.*`
- `Migrations/20260901154942_AddInfoCompanyLogoUrl.*`

```powershell
dotnet ef migrations add InitialPostgres `
  --project CesarBarbosa.Persistence `
  --startup-project CesarBarbosa.Persistence `
  --output-dir Migrations
# -> Migrations/20261004183845_InitialPostgres.cs (+ .Designer.cs, + updated ModelSnapshot)
```

Why delete rather than edit: the old migration bodies referenced `SqlServerModelBuilderExtensions` /
`SqlServerPropertyBuilderExtensions`, so they no longer compile once the SQL Server package is gone. Why a
fresh baseline is safe **here**: there is no production Postgres environment yet, so there is no history to
preserve.

> If a PostgreSQL environment already existed, the opposite is correct: **keep** `__EFMigrationsHistory` and
> the existing migrations, delete only the SQL Server ones if they never ran on Postgres, and add new
> migrations for the Postgres-specific deltas (extensions, `citext`, GIN indexes). Rewriting history that a
> live database already applied will make `dotnet ef database update` refuse to run or silently diverge.

### 1.6 `CesarBarbosa.Server/Program.cs`

Startup branches on the resolved provider instead of the build configuration:

```csharp
var database = app.Services.GetRequiredService<DatabaseProviderInfo>();

if (!database.IsRelational || DevelopmentDataSeeder.IsForced)
{
    // In-memory store, or an explicitly forced demo database (SEED_MOCK_DATA=true):
    // seed realistic mock data.
    await DevelopmentDataSeeder.SeedAsync(app.Services);
}

if (database.IsRelational)
{
    app.UseMigration();
}
```

Consequence worth understanding: since the default local database is now the **real migrated one**, mock
seeding is opt-in via `SEED_MOCK_DATA=true` (`DevelopmentDataSeeder.ForceSeedEnvironmentVariable`), because
silently injecting sample posts into the migrated database would corrupt production parity. HSTS is likewise
applied only for a relational provider outside Development.

### 1.7 Semantic parity (the part that actually changes behaviour)

| File | Change | Why |
|---|---|---|
| `CesarBarbosa.Application/Shared/TextSearch.cs` (new) | `ContainsPattern` / `StartsWithPattern` / `Escape`, escaping `\` first, then `%`, then `_` | PostgreSQL `LIKE` is case-sensitive and treats `%`/`_` as wildcards — SQL Server's collation hid both |
| `CesarBarbosa.Application/Features/PostService/PostService.cs` | `EF.Functions.ILike(p.Title, pattern, TextSearch.EscapeCharacterString) \|\| ... Subtitle ... \|\| ... Text` written **inline** | ILIKE must be visible to EF Core at the query site to be translatable |
| `CesarBarbosa.Application/Features/UserAdminService/UserAdminService.cs` | same `ILike` treatment for user-name search | same reason |
| `CesarBarbosa.Persistence/Mapping/BaseEntityConfiguration.cs` | new `PostgresStringSemantics.UseCaseInsensitiveText<TProperty>()` → `HasColumnType("citext")` | restores case-insensitive equality without touching a single query |
| `CesarBarbosa.Persistence/Mapping/TagConfiguration.cs` | `Tag.Name` → `citext`, unique index kept | stops the unique index accepting both `Cultura` and `cultura` |
| `CesarBarbosa.Persistence/Mapping/UserConfiguration.cs` | `AspNetUsers.UserName`, `AspNetUsers.Email` → `citext` | these are compared by direct lookups, not only via the Normalized* columns |
| `CesarBarbosa.Persistence/Mapping/PostConfiguration.cs` | GIN trigram indexes on `Title`, `Subtitle`, `Text` (`.HasMethod("gin").HasOperators("gin_trgm_ops")`) | a leading-wildcard `ILIKE '%term%'` cannot use a B-tree index; without pg_trgm the site search degenerates to a sequential scan of every post body |
| `CesarBarbosa.Persistence/DatabaseContext/CesarBarbosaDatabaseContext.cs` | `modelBuilder.HasPostgresExtension("citext")` and `("pg_trgm")` inside `if (Database.IsNpgsql())` | keeps the extensions in the model so a fresh database is creatable by migrations alone; the guard keeps the file loadable by the in-memory provider, which has no notion of extensions |
| `scripts/postgres-init/01-extensions.sql` | `CREATE EXTENSION IF NOT EXISTS citext; pg_trgm;` | runs on first initialisation of the volume so the parity work does not need a volume wipe |

Note on extension declaration: EF Core auto-detects an extension implied by a **column type** (which is why
`citext` appeared on its own), but it does **not** infer one implied by an **index operator class** — hence
`pg_trgm` had to be declared explicitly in the model.

---

## Part 2 — The data migration tool

`tools/CesarBarbosa.DataMigration` — a standalone console app (`net10.0`), in `CesarBarbosa.slnx`, referencing
`Microsoft.Data.SqlClient` 6.1.1 (source) and `Npgsql` 10.0.3 (target). It is deliberately **not** part of
`CesarBarbosa.Server`, not published with the app, and deliberately free of the application's private NuGet
feed dependency, so it builds from a bare checkout, in CI, or in a container, and a failed run cannot take the
web application down with it.

- `MigrationPlan.cs` — the declarative table/column map: `TablePlan(SourceTable, TargetTable, Columns)`,
  `ColumnPlan(SourceColumn, TargetColumn, NpgsqlDbType, Coerce)`, plus `SequencesToResync`.
  Keeping the contract as *data* is what makes the migration reviewable: the whole source→target mapping is
  visible in one screen and adding a table means adding an entry.
- `Schema.cs` — applies and verifies the target schema via the same EF Core baseline the app runs.
- `SchemaInspector.cs` / `PlanTools.cs` — read the **live** source catalog to validate or generate a plan.
- `Program.cs` — `Migrator` (truncate → copy → resync sequences) and `Verifier` (counts, digests, `--dump`).

### 2.0 Working from the live database, not from a dump

The plan is a *hypothesis* about the source schema. Verify it against the live catalog before trusting it —
and for a new project, generate a first draft from it:

```powershell
# Validate: compares the plan with sys.tables/sys.columns. Reports every mismatch at once.
dotnet run --project tools/CesarBarbosa.DataMigration -- --check-schema

# Bootstrap a plan for a database that has none (including one with no schema dump):
dotnet run --project tools/CesarBarbosa.DataMigration -- --generate-plan
```

`--check-schema` reports `MISSING TABLE`, `MISSING COLUMN`, `NO KEY COLUMN`, and informational
`NOTE ... is NOT migrated` lines, and exits non-zero if anything must change. Run it in CI-rehearsal and
always before reusing this tool on another database.

`--generate-plan` emits a **draft, not a finished plan**. It maps SQL Server types to `NpgsqlDbType`, and
anything it cannot confidently map is emitted as `<UNMAPPED>` with a `TODO` carrying the source type — so an
unrecognised type cannot be overlooked. The draft still needs a human for the four things the tool cannot
know: **table order** (foreign keys), **key columns** (the digest depends on them), **timestamp coercion**,
and **which tables to exclude**.

> **Why not just keep a `.dacpac` around?** A data-tier application package is a *snapshot*. It is convenient
> when it happens to exist, it is genuinely the best way to rehearse locally without touching production, and
> this project used one — but it goes stale on the next migration and the next project will not have one at
> all. The live catalog is always current and always reachable by whoever holds credentials, so it is the
> contract.

### 2.1 Design decisions

**Plain ADO.NET, not EF Core.** There is no model/entity dependency, so the tool works even when the source and
target schemas differ, and it is fast and reproducible. It also cannot be broken by a change to the
application's domain model.

**Binary `COPY` for writes.** Every column declares its `NpgsqlDbType` explicitly in the plan:

```csharp
var copySql = $"COPY {Quote(plan.TargetTable)} ({copyColumns}) FROM STDIN (FORMAT BINARY)";

await using var importer = await target.BeginBinaryImportAsync(copySql);
foreach (var row in rows)
{
    await importer.StartRowAsync();
    for (var i = 0; i < columns.Count; i++)
        if (row[i] is null) await importer.WriteNullAsync();
        else                await importer.WriteAsync(row[i], columns[i].NpgsqlType);
}
await importer.CompleteAsync();
```

**Foreign-key dependency order.** PostgreSQL enforces FKs immediately and the EF-generated constraints are
**not** `DEFERRABLE`, so `SET CONSTRAINTS ALL DEFERRED` cannot help. The plan lists tables so that no table
appears before everything it references (`AspNetUsers` → `Tag`/`Post` → `Image` → `PostTag`/`Comment` →
`Portfolio` → `PortfolioTag` → the identity join tables). The code still issues `SET CONSTRAINTS ALL DEFERRED;`
best-effort inside the transaction, catches the expected `PostgresException`, and relies on ordering.

**One transaction for the whole copy**, so a failure leaves the target untouched.

**Sequence resync after COPY.** `COPY` inserts explicit values and never advances the sequence, so without this
the application's next `INSERT` collides with an existing primary key:

```sql
SELECT setval(
    pg_get_serial_sequence('"AspNetUserClaims"', 'Id'),
    COALESCE((SELECT MAX("Id") FROM "AspNetUserClaims"), 1),
    (SELECT COUNT(*) > 0 FROM "AspNetUserClaims"));
```

The identifiers **must** be double-quoted: EF Core created these tables with camel-case names, and unquoted
`pg_get_serial_sequence('AspNetUserClaims','Id')` folds to lowercase and fails. Currently applies to
`AspNetUserClaims.Id` and `AspNetRoleClaims.Id` (the only integer identities with data).

**Atomic wipe.** `--truncate` emits one `TRUNCATE TABLE t1, t2, ... CASCADE;` so the wipe is all-or-nothing and
`CASCADE` covers the FKs regardless of plan order.

### 2.2 Commands and connection-string precedence

```powershell
docker compose --profile rehearsal up -d --wait
sqlpackage /Action:Publish /SourceFile:.backup\dump.dacpac /TargetConnectionString:"Server=localhost,14330;Database=CesarDacpac;User Id=sa;Password=<pwd>;TrustServerCertificate=True;Encrypt=True"
dotnet ef database update --project CesarBarbosa.Persistence --startup-project CesarBarbosa.Persistence   # with CesarBarbosaDB set
dotnet run --project tools/CesarBarbosa.DataMigration -- --truncate
```

| Switch | Effect |
|---|---|
| `--truncate` | Truncate the target tables before copying; copy then verify; **exits non-zero on any mismatch** |
| `--verify-only` | Compare without copying |
| `--dump <Table>` | Print both engines' normalised rows side by side and mark the first differing row (and the first differing character). This is the diagnostic that isolates a digest mismatch |
| `--source` / `--target` | Explicit connection strings |
| `--help` | Usage |

Resolution order for connection strings: `--source`/`--target` → `MIGRATION_SOURCE`/`MIGRATION_TARGET` →
`CesarBarbosaDB` (target only, the name the app already uses) → the compose defaults
(`Server=localhost,14330;Database=CesarDacpac;...` and
`Host=localhost;Port=5432;Database=cesarbarbosa;...`). Passwords are redacted before a connection string is
printed.

> **Networking gotcha (cost time once already).** From the Windows host you must connect to SQL Server on the
> **published host port** — `localhost,14330`. The container IP returned by `docker inspect` is *not* routable
> from the host and the connection simply times out.

### 2.3 What the tool verifies

1. **Row count** per table on both sides.
2. **SHA-256 digest over every row**, in a stable order, on both sides — truncated to a 16-hex-char digest for
   display.

The digest cannot be a naive concatenation, so it normalises deliberately (see pitfalls 3–5): `Guid` to
lowercase `"D"` form, `DateTime`/`DateTimeOffset` to `yyyy-MM-ddTHH:mm:ss.ffffff` **as stored**, `bool` to
`"1"`/`"0"`, `DBNull` to a `\0` sentinel, and rows are joined with a unit separator (`\u001f`) so concatenating
two columns cannot create a false collision.

---

## Part 3 — Behavioural pitfalls checklist (the reusable part)

Every item below was observed in this migration. Treat it as a checklist for *any* SQL Server → PostgreSQL port.

### 3.1 Case sensitivity of string comparison

SQL Server's collation `SQL_Latin1_General_CP1_CI_AS` made `LIKE` case-insensitive and made `%`/`_` behave as
the application expected. PostgreSQL `LIKE` is case-sensitive, so `Title.Contains(term)` **silently changes
meaning**: searching `BUENOS` returned 0 rows while `buenos` returned 7.

```csharp
// Must be inline in the query - a helper method returning bool that internally
// calls EF.Functions.ILike is NOT translatable ("Translation of method ... failed").
var pattern = TextSearch.ContainsPattern(searchText);

query = query.Where(p =>
    EF.Functions.ILike(p.Title,    pattern, TextSearch.EscapeCharacterString) ||
    EF.Functions.ILike(p.Subtitle, pattern, TextSearch.EscapeCharacterString) ||
    EF.Functions.ILike(p.Text,     pattern, TextSearch.EscapeCharacterString));
```

Measured after the fix: `buenos` / `Buenos` / `BUENOS` all return the same 7 rows.

- **A helper that wraps `EF.Functions.ILike` does not translate.** It was tried and abandoned; the call has to
  appear where EF Core builds the expression tree.
- **Wildcards must be escaped**, or a search for `50%` matches everything. `TextSearch.Escape` escapes
  backslash first, then `%`, then `_`, and `ESCAPE '\'` is passed to `ILike`.
- `Npgsql.EntityFrameworkCore.PostgreSQL` is referenced from the Application project on purpose: PostgreSQL is
  the only relational provider and there is no provider-neutral spelling of ILIKE.

### 3.2 `citext` for indexed / looked-up text columns

`Tag.Name`, `AspNetUsers.UserName` and `AspNetUsers.Email` are mapped with `HasColumnType("citext")`
(`PostgresStringSemantics.UseCaseInsensitiveText`). This restores case-insensitive **equality** and — critically
— stops the unique index on `Tag.Name` from accepting both `Cultura` and `cultura` as two different tags.

`citext` must be treated as an **extension**: EF Core declared it automatically because a *column type* implies
it, but `pg_trgm` had to be declared explicitly in the model (`modelBuilder.HasPostgresExtension("pg_trgm")`
inside an `if (Database.IsNpgsql())` guard) because EF only auto-detects extensions implied by a column type,
**not** by an index operator class.

### 3.3 DateTime precision

SQL Server `datetime2(7)` holds 100 ns; PostgreSQL `timestamp with time zone` holds microseconds, so precision
is truncated on the way in. The verifier therefore formats timestamps to **6 fractional digits on both sides**.
Separately: the legacy rows are UTC stored with `DateTimeKind.Unspecified`, and calling `ToUniversalTime()` on
them shifts the value by the host's offset and makes an identical copy look different — format them **as
stored**, and force `DateTime.SpecifyKind(value, DateTimeKind.Utc)` when writing, because Npgsql rejects a
`DateTime` whose `Kind` is `Unspecified`.

### 3.4 UUID ordering differs between the engines

SQL Server orders `uniqueidentifier` by its **last six bytes**; PostgreSQL orders `uuid` **bytewise**. So
`ORDER BY Id` returns the same rows in a *different order*, and a naive row-by-row comparison reports false
mismatches. This is exactly what happened for `PostTag`, `PortfolioTag`, `Tag`, `Post`, `Image` and `Portfolio`.

```csharp
// SQL Server                            // PostgreSQL
CONVERT(varchar(36), "Id")              "Id"::text
```

Order by the canonical text form on both sides and the rows line up.

### 3.5 Text hashing must normalise

A digest over raw values will differ for reasons that are not data differences. Normalise:
`Guid` → lowercase `"D"` form; `DateTime`/`DateTimeOffset` → fixed `yyyy-MM-ddTHH:mm:ss.ffffff` format;
`bool` → `"1"`/`"0"`; `null`/`DBNull` → a sentinel that cannot occur in data (`\0`). Join columns of a row with a
unit separator so concatenation cannot create false collisions.

### 3.6 Do not build the plan around a schema dump

A `.dacpac` (or any schema snapshot) carries schema **and data**, but **not files**: the image binaries are not
in it. A "successful" migration can therefore still ship a site with broken images. In this project the local
MinIO bucket was empty and no legacy uploads existed on disk, so this looked like a real gap — it was not. The
`Image` rows hold `StorageKey` values, production MinIO already holds the objects under exactly those keys, and
the bucket is untouched by a database migration. **Check whether the object store is actually shared and
already populated before planning any file migration.**

The more important lesson is structural, and it applies to the **next** project: **do not let a dump become
the source of truth.** A snapshot goes stale the moment anyone runs a migration, and the next project will not
have one. Build the procedure so the **live catalog** is the contract — `--check-schema` validates the plan
against `sys.tables`/`sys.columns`, `--generate-plan` bootstraps a plan from it — and treat any dump as a
local rehearsal convenience only. This project began by leaning on its dump; the cutover runbook now depends
on it nowhere.

### 3.7 A migrated password hash cannot be verified by guessing

The migrated ASP.NET Identity `PasswordHash` was byte-identical to the source (length 84, same prefix) and
`PasswordHasher.VerifyHashedPassword` parsed it as a valid v3 hash. The production password is simply unknown,
so a local login legitimately returns 401. Distinguish "hash corrupt" from "password unknown" by testing
candidate passwords against the migrated hash with `PasswordHasher<object>()`. **Do not conclude the migration
failed because login fails.** Reset the admin password through the app's own flow —
`GET api/users/generate-password/{id}` (`UsersController`, `[HttpGet("generate-password/{id:guid}")]`) or the
admin UI.

### 3.8 `InvariantGlobalization` breaks `Microsoft.Data.SqlClient`

It fails with "Globalization Invariant Mode is not supported". Do not set `<InvariantGlobalization>true</...>`
on a migrator that talks to SQL Server. (Harmless — and common — on the Postgres-only app; fatal on the tool
that must read the source.)

### 3.9 `#if DEBUG` provider switching is a trap

It makes the provider a **compile-time** property, so a Debug build cannot be pointed at a real database at all
(and a Release build cannot be pointed at the in-memory store). Resolve the provider from configuration at
runtime and expose the decision through a singleton (`DatabaseProviderInfo`) so startup code branches on the
same value the `DbContext` was built with.

### 3.10 Reuse one connection per phase, not per process

A copy tool naturally opens one connection to the source and one to the target and keeps them for the whole
run. That is fine for the copy, but **give each later phase its own connection**. Npgsql resolves each column's
type through a per-connection cache of PostgreSQL type descriptions, and a user-defined type such as `citext`
is only resolvable while that cache is intact. Running state-inspection queries on the target connection before
the copy, and then reusing that same connection for the verification read, produced this:

```
Could not read AspNetUsers.UserName (ordinal 3, reported SQL type: -.-)
InvalidCastException: Reading as 'System.Object' is not supported for fields having DataTypeName '-.-'
```

`-.-` is not a real type name - it is what a reader reports when it has failed to resolve one. The tell is the
**type name in the message**: `citext` is a PostgreSQL type, so a failure naming it on a "source" read means the
target connection is involved. Opening a fresh connection per phase fixed it outright, and it costs nothing:
the phases are sequential, so there is nothing to share.

The same applies to a `SqlConnection`: give verification its own source connection rather than reusing the
copy's, so it cannot inherit half-finished reader state.

**Related, and worth copying:** a tool that decides whether to migrate on every run needs a *completion
marker*, not a data check. "Does the target have rows?" is the wrong question - a copy that died halfway leaves
some tables populated, so a data check would skip the rest and the application would serve a half-migrated
database. Write a marker as the last act of a **verified** run, and treat "data present, marker absent" as a
hard failure that stops the pod. Also make every successful copy write the marker, not just the automatic path,
or the documented recovery ("re-run with `--truncate`") will appear to work and change nothing.

### 3.11 A console migrator that references the data layer needs the ASP.NET base image

The migrator is a plain console app, but it references the persistence project so it can apply the exact same
EF Core migrations the application runs. That transitively pulls in `Microsoft.AspNetCore.Identity`, so the
published output requires the **`Microsoft.AspNetCore.App`** shared framework - and
`mcr.microsoft.com/dotnet/runtime` does **not** contain it. The container starts and immediately dies:

```
You must install or update .NET to run this application.
Framework: 'Microsoft.AspNetCore.App', version '10.0.0' (x64)
No frameworks were found.
```

Two things make this worth calling out: it is invisible at build time (the image builds perfectly; only
*running* it fails), and the diagnosis points at .NET rather than at the dependency that caused it. Always
verify a container by **running** it, not just by building it.

**This is also an argument for one image rather than two.** Ship the tool inside the application image and the
problem disappears: the app image already uses the `aspnet` base, so the framework is present by construction,
and the tool is published from the same commit as the code that reads the schema. A separate migrator image
means a second revision that can drift, a second CI job, and — as happened here — a second base image to get
wrong. The convention in this repository is therefore one image, with the tool published to `/app/migrator` and
invoked by an initContainer.

---

## Part 4 — Verification evidence

### 4.1 Schema

```powershell
dotnet ef database update --project CesarBarbosa.Persistence --startup-project CesarBarbosa.Persistence
```

created all **16 relations** (15 tables + `__EFMigrationsHistory`). `EXPLAIN` confirmed that `Post` carries
three GIN trigram indexes — `IX_Post_Title`, `IX_Post_Subtitle`, `IX_Post_Text` with `gin_trgm_ops` — and that a
search predicate plans as a `BitmapOr` over all three when a sequential scan is not cheaper.

### 4.2 Row-level fidelity

The tool's own report is the primary evidence: **15 tables, every table matching by row count and by SHA-256
digest over all rows.**

| Table | Rows | | Table | Rows |
|---|---:|---|---|---:|
| AspNetUsers | 1 | | Portfolio | 374 |
| AspNetRoles | 0 | | PortfolioTag | 523 |
| InfoCompany | 1 | | AspNetUserRoles | 0 |
| Tag | 16 | | AspNetUserClaims | 0 |
| Post | 11 | | AspNetRoleClaims | 0 |
| Image | 575 | | AspNetUserLogins | 0 |
| PostTag | 3 | | AspNetUserTokens | 0 |
| Comment | 1 | | | |

The run copied **1,505 rows across 15 tables** (the sum of the per-table figures above), every table matching the
source.

### 4.3 Referential integrity

`scripts/postgres-verify.sql` — every orphan check returned **0**:

```powershell
docker exec -i cesarbarbosa-postgres psql -U cesarbarbosa -d cesarbarbosa -v ON_ERROR_STOP=1 < scripts/postgres-verify.sql
```

images→post, posts→author, portfolios→image, posttag→post, portfoliotag→tag. (Row counts alone cannot catch a
bad copy order; PostgreSQL checks FKs per row, so this is where a mistake surfaces.)

### 4.4 Semantic parity, as queries

```sql
-- citext: case-insensitive equality on Tag.Name (both return the same non-zero count)
SELECT COUNT(*) FROM "Tag" WHERE "Name" = 'cultura';
SELECT COUNT(*) FROM "Tag" WHERE "Name" = 'CULTURA';

-- ILIKE: search parity (all counts equal)
SELECT COUNT(*) FROM "Post" WHERE "Title" ILIKE '%buenos%' OR "Subtitle" ILIKE '%buenos%' OR "Text" ILIKE '%buenos%';
SELECT COUNT(*) FROM "Post" WHERE "Title" ILIKE '%BUENOS%' OR "Subtitle" ILIKE '%BUENOS%' OR "Text" ILIKE '%BUENOS%';
```

### 4.5 API smoke test against the migrated database

| Endpoint | Result |
|---|---|
| `/api/health/live` | 200 |
| `/api/health/ready` | 200 (Postgres health check included) |
| `/api/infocompany` | 200 with real data (name `Cesar Barbosa`) |
| `/api/tag` | 200 (16 tags) |
| `/api/post` (paged) | 200 (5 of 11 on page 0) |
| `/api/post/getRecentPosts` | 200 |
| `/api/portfolio` | 200 |
| `/api/post/search` | 200, `buenos`/`Buenos`/`BUENOS` all return the same 7 rows |
| `/api/post/search?searchText=50%` | 200, 0 rows — the `%` is literal, not a wildcard |
| `/api/users` (no token) | 401 — admin endpoints stayed guarded |
| `/sitemap.xml` | 200 |

This is the check that matters most: it exercises the *real* application against the *real* migrated data, not
just SQL. Run it with the server pointed at Postgres:

```powershell
$env:CesarBarbosaDB = "Host=localhost;Port=5432;Database=cesarbarbosa;Username=cesarbarbosa;Password=cesarbarbosa"
$env:ASPNETCORE_ENVIRONMENT = "Production"
dotnet run --project CesarBarbosa.Server -c Release
```

Note that the seeded development admin (`admin` / `Admin@123`) does **not** exist in migrated data — see 3.7.

### 4.6 Clean-room reproducibility

The result above is not a one-off: the whole pipeline was re-run from nothing to confirm it is
repeatable, which is what makes the runbook in Part 5 trustworthy.

```powershell
# 1. A virgin database with NO extensions (only plpgsql)
createdb cesarfresh                       # or: CREATE DATABASE cesarfresh;

# 2. Migrations alone must produce the complete schema
$env:CesarBarbosaDB = "Host=localhost;Port=5432;Database=cesarfresh;..."
dotnet ef database update --project CesarBarbosa.Persistence --startup-project CesarBarbosa.Persistence
#    -> 16 relations, and citext + pg_trgm created by the migration itself.
#       Confirms the fresh-volume init script is a convenience, not a requirement.

# 3. The baseline is reversible
dotnet ef database update 0 ...           # all tables dropped
dotnet ef database update ...             # 16 relations again
```

The migrated database was then taken the same way — `database update 0`, `database update` (0 rows left),
then the data tool from scratch — and came back to **15 tables / 1,505 rows, every table matching the
source digest**, with the orphan checks at 0 and all API checks passing. That exercises the *entire*
documented path end to end rather than only the happy increment.

---

## Part 5 — Repeat this on another project: runbook

> **Shorter companion:** [`MIGRATION_TEMPLATE.md`](MIGRATION_TEMPLATE.md) is the per-project
> *checklist* for the other four projects in the programme — what to do in what order, what is
> generic in the tool versus what each project must supply, and the post-cutover cleanup phase.
> This Part remains the long-form explanation of *why* each step exists.

### Step 1 — Inventory the SQL Server-specific surface

Before changing anything, list every place the engine leaks into the code. This determines the size of the job.

```powershell
# Provider wiring and packages
rg -n "UseSqlServer|EntityFrameworkCore\.SqlServer|HealthChecks\.SqlServer|SqlServerModelBuilderExtensions|SqlServerPropertyBuilderExtensions"
# Raw SQL and engine-specific functions
rg -n "FromSqlRaw|ExecuteSqlRaw|ExecuteSqlInterpolated|GETDATE|SYSDATETIME|NEWID|ISNULL|\[dbo\]|\bTOP\b"
# String semantics that depended on the collation
rg -n "\.Contains\(|\.StartsWith\(|\.EndsWith\(|EF\.Functions\.Like"
# Unique indexes over text
rg -n "HasIndex\(.*\)\.IsUnique\(\)"
# Provider chosen at compile time
rg -n "#if DEBUG|#if !DEBUG"
# Identities / sequences / column types
rg -n "UseIdentityColumn|ValueGeneratedOnAdd|datetime2|datetimeoffset|uniqueidentifier|nvarchar|HasColumnType\("
```

Also check: Dockerfiles and CI for `InvariantGlobalization` and for provider-related env var names, EF Core
**tests** (an in-memory provider will not catch collation or precision changes), stored procedures/views/triggers
in the database itself, SSIS/agent jobs, and any reporting tool reading the database.

### Step 2 — Pick the provider and the package set

`Npgsql.EntityFrameworkCore.PostgreSQL` for the app; swap `AspNetCore.HealthChecks.SqlServer` for
`AspNetCore.HealthChecks.NpgSql`; keep an explicit `Microsoft.EntityFrameworkCore` reference at the version the
Npgsql provider requires (>= 10.0.4 for Npgsql 10.0.3) so the solution does not drift.

### Step 3 — Move provider selection to runtime

Delete every `#if DEBUG` provider branch. Introduce options bound from a `Database` configuration section with
environment overrides, resolve the provider once at startup, register a singleton describing the choice, and
branch startup side effects (seeding, migrating, HSTS) on that singleton. Keep the **old connection-string
environment variable name** if deployments already set it.

### Step 4 — Decide the migration-history strategy

- No PostgreSQL environment yet → delete the SQL Server migrations and generate one fresh baseline. (Deleting
  is also forced when the old migration bodies reference SQL Server builder extensions and stop compiling.)
- PostgreSQL already exists → keep `__EFMigrationsHistory`, never rewrite applied migrations, and add a new
  migration for the Postgres-specific deltas.

Point the `IDesignTimeDbContextFactory` at the new provider **before** generating anything; it decides the
dialect of every generated migration.

```powershell
dotnet ef migrations add InitialPostgres --project <PersistenceProject> --startup-project <PersistenceProject> --output-dir Migrations
dotnet ef database update      --project <PersistenceProject> --startup-project <PersistenceProject>
```

### Step 5 — Bring the extensions in two places

Declare them in the model (`modelBuilder.HasPostgresExtension(...)` inside an `if (Database.IsNpgsql())` guard)
so a fresh database is creatable by migrations alone, **and** in an init script for convenience on a fresh
volume. Remember that EF auto-detects extensions implied by a column type but not by an index operator class.

### Step 6 — Fix case sensitivity and wildcard escaping

Add a `TextSearch`-style helper for patterns, then rewrite every search clause to inline `EF.Functions.ILike`
with the escape character. Map looked-up/unique text columns to `citext`. Add trigram indexes for
leading-wildcard search. Verify with the three-case query: lower, Mixed, UPPER must all return the same rows.

### Step 7 — Audit the specific semantics

Go through every item on this list; they are the ones that fail silently rather than loudly:

- every `Contains` / `StartsWith` / `EndsWith` / `==` on strings (case sensitivity, and `%`/`_` in user input);
- every `HasIndex(...).IsUnique()` over text (`citext`, or a functional unique index on `lower(col)`);
- every raw SQL string (`[brackets]`, `TOP`, `GETDATE`, `ISNULL`, `+` concatenation, `bit` comparisons);
- every identity/sequence column (explicit values do not advance a Postgres sequence);
- every `datetime2` / `datetimeoffset` (precision and `Kind`);
- every `Guid` used as an ordering key.

### Step 8 — Build the copy tool in dependency order

Standalone console app, plain ADO.NET, declarative table/column plan, binary `COPY` with explicit
`NpgsqlDbType`, one transaction, `TRUNCATE ... CASCADE` for `--truncate`, `setval(pg_get_serial_sequence(...))`
with double-quoted identifiers afterwards.

**Derive the plan from the live catalog, not from a dump.** Point `--generate-plan` at the real database to get
a draft, then review it — the four things a generator cannot know are table order (foreign keys), key columns
(the digest depends on them), timestamp coercion, and which tables to exclude. Then make `--check-schema` a
standing gate: it diffs the plan against `sys.tables`/`sys.columns` and reports every mismatch at once, so
drift is a list you fix beforehand rather than a copy that fails mid-window. Add two guards that cost nothing
and prevent the worst outcomes: **refuse to copy into an unmigrated target** (otherwise you get one
`relation does not exist` per table), and **refuse to run when source and target resolve to the same
endpoint** (with `--truncate`, that empties the system of record — and it is a realistic mistake, because the
target commonly falls back to the same environment variable the application uses for the source).

### Step 9 — Verify counts and digests, then plan the cutover

Counts first (cheap), digests second (authoritative), `--dump` third (diagnosis). Then: **pre-stage** everything
that can be done without downtime (role, database, schema, bulk copy, verification, any password resets),
freeze writes for the real window, run the copy once more to pick up the delta, verify, switch, smoke test, and
keep the source read-only for a rollback period. Separate the **operational** runbook from this reference
document — the cutover has phases, a freeze, and rollback decisions that do not belong in a "how it works"
explanation. `CUTOVER.md` in this repository is that companion.

### SQL Server behaviour → PostgreSQL equivalent

| SQL Server behaviour | PostgreSQL equivalent | Notes |
|---|---|---|
| Case-insensitive `LIKE` (collation `_CI_`) | `col ILIKE pattern ESCAPE '\'`, inline `EF.Functions.ILike(...)` | Must be inline in the LINQ query; a wrapping helper does not translate |
| Case-insensitive `=` (collation `_CI_`) | `citext` column type | Use for looked-up columns and unique indexes |
| `%`/`_` treated literally for the app | Escape `\`, then `%`, then `_`; pass the escape character | Otherwise `50%` matches everything |
| `GETDATE()` / `SYSDATETIME()` | `now()` / `CURRENT_TIMESTAMP` | In C#, prefer `DateTime.UtcNow` computed client-side so the value is parameterised |
| `ISNULL(a, b)` | `COALESCE(a, b)` | In LINQ, `a ?? b` translates to `COALESCE` on both engines |
| `[identifier]` | `"identifier"` | Postgres folds unquoted identifiers to lowercase — this is what breaks `pg_get_serial_sequence('AspNetUserClaims','Id')` |
| `SELECT TOP n` | `LIMIT n` | `.Take(n)` in LINQ |
| `IDENTITY(1,1)` | `GENERATED BY DEFAULT AS IDENTITY` + backing sequence | Explicit inserts do **not** advance the sequence → `setval(pg_get_serial_sequence(...), MAX(col), true)` |
| `nvarchar(max)` | `text` | No `(max)` suffix; no length limit either |
| `bit` | `boolean` | Comparisons against `0`/`1` in raw SQL must become `false`/`true` |
| `uniqueidentifier` ordering | `uuid` | SQL Server sorts by the **last six bytes**, Postgres bytewise → order by `CONVERT(varchar(36), col)` vs `col::text` when comparing |
| `datetime2(7)` precision | `timestamp with time zone`, microseconds | 100 ns → 1 µs truncation; format 6 fractional digits on both sides when hashing |
| `'a' + NULL` → NULL; `CONCAT` treats NULL as empty | `||` propagates NULL; `concat()` treats NULL as empty | Same NULL semantics, different operators; `||` needs explicit casts for non-text operands, which `+` did implicitly |
| `SET IDENTITY_INSERT t ON` | No equivalent needed for `GENERATED BY DEFAULT` (explicit values allowed); `OVERRIDING SYSTEM VALUE` for `GENERATED ALWAYS` | Relevant to copy tools that insert explicit IDs |
| Collation-based unique index (`_CI_`) | `citext` column, or a functional unique index on `lower(col)` | Without it the index starts accepting `Cultura` and `cultura` |

### What to grep for

```text
UseSqlServer                       SqlServerModelBuilderExtensions     SqlServerPropertyBuilderExtensions
Microsoft.EntityFrameworkCore.SqlServer                                AspNetCore.HealthChecks.SqlServer
FromSqlRaw   ExecuteSqlRaw   ExecuteSqlInterpolated    "SELECT "      "INSERT "     "UPDATE "
GETDATE   SYSDATETIME   ISNULL   NEWID   [dbo]   TOP
.Contains(   .StartsWith(   .EndsWith(   EF.Functions.Like   StringComparison.
.HasIndex( ... ).IsUnique()        HasColumnType(   HasCollation(   UseCollation(
UseIdentityColumn   ValueGeneratedOnAdd   IDENTITY_INSERT   datetime2   datetimeoffset
uniqueidentifier   nvarchar   bit
#if DEBUG   InvariantGlobalization
```

---

## Part 6 — Remaining work

1. **Nothing outstanding in the migration itself.** Data, schema, verification and the semantic-parity work
   (case-insensitivity, wildcard escaping, uuid ordering, timestamp precision) are all complete and proven.
2. **Production cutover.** Not covered here — see [`CUTOVER.md`](CUTOVER.md) for the operational runbook:
   phases, the freeze window, the in-cluster migration Job, and rollback.
3. **Rollback plan.** Keep the SQL Server `cesarbarbosa` database untouched and read-only for a defined period.
   This is the same shape the mail stack used when it kept its pre-migration RocksDB store as a rollback copy.
4. **Backups.** Add the new PostgreSQL database to the cluster's Databasement schedule; the SQL Server backup
   that previously covered this data no longer protects it.
5. **Decide whether `mssql` stays in `compose.yaml`** once the rehearsal profile is no longer needed.
6. **Frontend build was not exercised** as part of this work.
7. **Images need no work.** They live in the shared MinIO and are addressed by `Image.StorageKey`, which the
   migration does not change. (An earlier draft of this document wrongly listed an image upload as required;
   that came from inspecting a local, empty MinIO rather than production.)
