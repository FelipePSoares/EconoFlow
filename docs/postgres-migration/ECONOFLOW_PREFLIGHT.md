# EconoFlow — PostgreSQL migration pre-flight

**Status: AUDITED — shape established, prep work started.**

This file was delivered as a *questionnaire with the answers left blank*. It is now
filled in from the source, with file and line references for every answer. Where a
question could not be answered from the repository alone (production facts), it is
marked **OPEN** rather than guessed.

Branch for this work: `feat/postgres-migration-prep`.

---

## 1. Establish the shape

| # | Question | Answer | Evidence |
|---|---|---|---|
| 1 | How many `DbContext` types exist? | **2** — `EasyFinanceDatabaseContext`, `MyKeysContext` | `EasyFinance.Persistence/DatabaseContext/*.cs` |
| 2 | Does any context use a non-default schema? | **NO** — neither calls `HasDefaultSchema` | grep for `HasDefaultSchema` → 0 hits; both contexts use only `ToTable("…")` with bare names |
| 3 | What is the connection-string env var? | **`EasyFinanceDB`** | `PersistenceServiceRegistration.cs:20`; also `docs/docker.md:60` |
| 4 | Is provider selection compile-time (`#if DEBUG`)? | **YES** — `#if DEBUG` (line 15) chooses InMemory vs SqlServer | `PersistenceServiceRegistration.cs:15-28` |
| 5 | How many migrations are there? | **2 histories: 36 (+1 snapshot) in `Migrations/`, 1 (+1 snapshot) in `Migrations/MyKeys/`** | file counts below |
| 6 | Are there `date`-only columns? | **YES — already `DateOnly`** | `BaseFinancial.Date`, `PlanEntry.Date`, `Notification.ExpiresAt` |
| 7 | Is there a health check tied to SQL Server? | **YES** — `AddSqlServer(connectionString)` | `PersistenceServiceRegistration.cs:33` |
| 8 | Attachment storage providers? | **MinIO and filesystem** (factory-selected) | `AttachmentStorageServiceFactory.cs:28,48` |
| 9 | Database size and row counts? | **OPEN** — needs the live database | not derivable from source |
| 10 | Acceptable downtime? | **OPEN** — needs the product owner | not derivable from source |

Migration file counts (raw files; each migration contributes `.cs` + `.Designer.cs`):

| Folder | `.cs` files | Actual migrations |
|---|---:|---:|
| `Migrations/` | 73 | **36** (+1 model snapshot) |
| `Migrations/MyKeys/` | 3 | **1** (+1 model snapshot) |

### Shape verdict

> **Two contexts → two migration hosts. This is WhiteLabel's shape, not Move's.**

A single shared connection string (`EasyFinanceDB`) serves both contexts. The
`#if DEBUG` branch is the compile-time trap the template calls out, and the SQL
Server health check **fails at startup** against a PostgreSQL connection string.

**No non-default schema** means the 1.1.x schema-quoting fixes in the shared engine
are not load-bearing, and the mandatory ambiguity check from `CUTOVER_LESSONS.md` §4
does not apply.

---

## 2. Audit the SQL Server surface

### Provider wiring and packages — the migration itself

| Location | What |
|---|---|
| `PersistenceServiceRegistration.cs:23,27` | `UseSqlServer` for both contexts |
| `PersistenceServiceRegistration.cs:33` | `AddSqlServer` health check, `#if !DEBUG` |
| `EasyFinance.Persistence.csproj:10,16` | `AspNetCore.HealthChecks.SqlServer` 9.0.0, `Microsoft.EntityFrameworkCore.SqlServer` 10.0.11 |
| `EasyFinance.Server.csproj:22,34` | same two |
| `EasyFinance.Application.Tests.csproj:13,24` | same two |
| `EasyFinance.Server.Tests.csproj:13,26` | same two |
| **All 36 + 1 migrations** | `SqlServerModelBuilderExtensions.UseIdentityColumns`, `SqlServerPropertyBuilderExtensions.UseIdentityColumn`, `nvarchar`, `datetime2`, `uniqueidentifier` |

**Raw-SQL hit count in application code: ZERO.**

```powershell
rg -n "FromSqlRaw|ExecuteSqlRaw|ExecuteSqlInterpolated|SqlQuery|Database\.ExecuteSql"  # 0 hits
```

This is the single most important finding in the audit, and it is good news. The
pre-flight warned that *"a finance application is a strong candidate for raw SQL in
reporting or aggregation"* and that those are *"the expensive part of this
migration"*. EconoFlow has none. Every aggregation (monthly totals, tax-year
rollups, balances) is LINQ over `IQueryable`, so the provider translates it.

### 2.1 Raw SQL the call-site grep did NOT find — caught by the rehearsal

The grep above searches **C# call sites**, and that is not sufficient. EF Core stores
two kinds of *model configuration* as raw SQL strings it never translates:

| Kind | How it is declared |
|---|---|
| Index filters | `HasIndex(...).HasFilter("...")` |
| Check constraints | `HasCheckConstraint("...", "...")` |

EconoFlow had **five** such fragments, all in SQL Server syntax:

| File | Fragment | Why PostgreSQL rejects it |
|---|---|---|
| `PlanConfiguration.cs:49` | `[Type] = 1 AND [IsArchived] = 0` | brackets **and** a `bit`-style integer comparison |
| `AttachmentConfiguration.cs:63` | `[ExpenseId] IS NOT NULL AND [AttachmentType] = 1` | brackets |
| `DeductibleGroupExpenseConfiguration.cs:21` | `[ExpenseId] IS NOT NULL` | brackets |
| `DeductibleGroupExpenseConfiguration.cs:25` | `[ExpenseItemId] IS NOT NULL` | brackets |
| `DeductibleGroupExpenseConfiguration.cs:32` | `CK_DeductibleGroupExpenses_ExactlyOneTarget` | brackets |

They were caught by **running the migration**, not by reading the code. Applying the
first generated baseline produced:

```
Npgsql.PostgresException (0x80004005): 42601: syntax error at or near "["
```

All five now use syntax both providers accept: double-quoted identifiers (valid on
SQL Server with `QUOTED_IDENTIFIER ON`, the default, and on PostgreSQL) and `FALSE`
instead of `= 0`. Enum columns keep their integer comparison (`"Type" = 1`), which is
portable on both.

`RawSqlProviderPortabilityTests` now fails the build if either pattern returns.

> **The generalisable lesson:** "we have no raw SQL" is a claim about *call sites*
> unless model configuration is checked too. `--check-schema` cannot catch this
> either, because these are strings in C#. Only applying the migration found them —
> which is exactly why the pack insists on a rehearsal against a real database.

The only other SQL Server-specific SQL lives **inside 4 EF migration `.cs` files**, in
seed-data inserts using `NEWID()`:

| Migration | Line |
|---|---|
| `20250919045656_AddNotifications.cs` | 54 |
| `20251009180536_AddLanguageCodeForUser.cs` | 33 |
| `20260217231101_AddOverviewAnnouncementNotification.cs` | 17 |
| `20260223134837_AddTwoFactorAnnouncementNotification.cs` | 17 |

These are **not** a bug to fix: they are SQL Server migration bodies, and they are
exactly why the PostgreSQL schema must come from a **fresh migration set** rather
than by replaying these 36 (see §7).

### Other checks

- **`InvariantGlobalization`** — not set in any csproj. No action.
- **Stored procedures, views, triggers** — none declared anywhere in the repository,
  and there is no `.sql` schema script. **OPEN**: confirm against the live database
  catalog, since objects can exist there without a source file here.
- **SSIS / agent jobs / linked servers** — none referenced. **OPEN** for the same
  reason.
- **Reporting tools reading the database** — none in-repo. **OPEN**.

---

## 3. The semantic audit that changes behaviour silently

| Trap | Finding | Verdict |
|---|---|---|
| Case-sensitive `LIKE` | **No string search exists.** Every `.Contains()` / `.StartsWith()` hit is either in-memory `List.Contains()` (collection membership) or a literal-prefix check on a URL / file path — **not** a database search predicate. | **Not applicable** |
| Wildcards in user input | No user-facing pattern search exists, so there is no unescaped `%` / `_` path. | **Not applicable** |
| Case-sensitive equality | One genuine case: `DeductibleGroup.Name`, user-supplied and in a **unique index** `(ProjectId, TaxYearId, Name)`. `Endpoint` / `Token` indexes are high-entropy tokens. | **ACTION — see §3.1** |
| Leading-wildcard search | None. No `pg_trgm` / GIN index needed. | **Not applicable** |
| `datetime2(7)` precision | 100 ns → 1 µs truncation. Audit columns are `SystemClock`-produced. | Accepted; no data of that precision |
| `DateTimeKind.Unspecified` | **Zero raw `DateTime.Now`/`DateTime.Today`.** Every writer goes through `SystemClock`. | **Safe — guard with a test, §3.2** |
| UUID ordering | `uniqueidentifier` PKs throughout (`IdentityDbContext<User, IdentityRole<Guid>, Guid>`). | Engine's problem; do not hand-roll comparisons |
| `date` columns | Already `DateOnly` → Postgres `date`. | **Requires engine 1.1.3** |

### 3.1 Collation policy — one column, decided

Per the template's rule (equality/indexed → `citext`; pattern → `text` + `pg_trgm`;
display/join-only → `text`):

| Column | Treatment | Why |
|---|---|---|
| `DeductibleGroups.Name` | **`citext`** | User-supplied, compared for equality via a unique index. Without `citext`, `Travel` and `travel` become two rows — a real defect on a finance app where a user can create both. |
| `WebPushSubscriptions.Endpoint` | plain `text` | High-entropy URL; case variation cannot legitimately occur |
| `ExpoPushTokens.Token` | plain `text` | opaque token |
| `UserProjects.Token` | plain `text` | opaque token |
| everything else | plain `text` | displayed or joined by id |

> Do **not** apply `citext` more broadly: it cannot be combined with `pg_trgm`
> operator classes, so a `citext` column loses its trigram search path.

### 3.2 `DateTime` — EconoFlow is the safest of the four projects

Verified, not assumed:

| Surface | Finding |
|---|---|
| Clock abstraction | `SystemClock.UtcNowDateTime` → `provider.GetUtcNow().UtcDateTime` (**Kind=Utc**); `TodayDate` → `DateOnly` |
| Raw `DateTime.Now` / `DateTime.Today` | **zero occurrences** in the solution |
| Audit stamps | `BaseEntity.CreatedDate` / `ModifiedAt` default from `SystemClock` (`BaseEntity.cs:23-24`); `UnitOfWork.cs:72` uses `SystemClock.UtcNowDateTime` |
| Financial dates | already `DateOnly` (`BaseFinancial.cs:29`, `PlanEntry.cs:26`, `Notification.cs:48`) → Postgres `date`, which carries no Kind at all |
| `DateTimeOffset.Now` ×2 | `AccessControlController.cs` — cookie `Expires` only, **never persisted** |
| Dev seeder | `DevelopmentTestDataSeeder.cs:20` uses `SystemClock.TodayDate`; runs only under `IsDevelopment()` (`Program.cs:187`) |

The `DateTime` audit columns become `timestamp with time zone`. They are safe today
**only because every writer goes through `SystemClock`** — so the risk is not the
migration, it is **regression**: anyone who later writes `DateTime.Now` next to one
of these columns reintroduces the WhiteLabel bug, at runtime, on a live site.

**Action:** add the architectural regression test from `DATETIME_KIND_TRAP.md` §5.

Column classification (instant vs calendar date), for the record:

| Type | Columns | Maps to |
|---|---|---|
| **Instant** | `CreatedDate`, `ModifiedAt`, `SentAt`, `AcceptedAt`, `RevokedAt`, `LastUsedAt`, `ExpiryDate`, `EmailLockedUntil`, `LockoutEnd` | `timestamptz` |
| **Calendar date** | `Incomes.Date`, `Expenses.Date`, `ExpenseItems.Date`, `PlanEntries.Date`, `Notifications.ExpiresAt` | `date` (**already correct**) |

---

## 4. Flag enums — the specific compatibility question

EconoFlow has two `[Flags]` enums. **Both are Postgres-compatible, and no schema
change is required.** The reasoning, because "flags enums and Postgres" is a real
trap in general:

1. **They are persisted as `integer` columns, not as a Postgres `enum` type.** EF
   Core maps a CLR enum to its underlying integral type, which the model snapshot
   confirms: `b.Property<int>("NotificationChannels")`,
   `b.Property<int>("LimitNotificationChannels")`. Npgsql maps `int` → `integer`.
   A Postgres native `enum` type is only used if you explicitly ask for it via
   `MapEnum`, which this codebase does not.

2. **The values are explicit powers of two** (`1 << n`) with no combinatorial
   members, so every stored value is a valid `integer` in range.

3. **`HasSentinel` / `HasDefaultValue` are provider-agnostic.** `UserConfiguration.cs:28-31`
   sets `.HasDefaultValue(NotificationChannels.Email | NotificationChannels.Push)`
   (= `5`) and `.HasSentinel(NotificationChannels.None)` (= `0`). These emit a
   `DEFAULT 5` clause and EF-side change-tracking behaviour respectively; both are
   plain integers on the wire. **They do not need `citext`, a converter, or a
   Postgres enum type.**

4. **The risk people actually hit is the wire format, not the database.** EconoFlow
   serializes flag enums as **arrays** in JSON via `FlagsEnumArrayConverter`
   (`Program.cs:99`). That converter is registered on the MVC pipeline and is
   completely independent of the database provider — it produced arrays before the
   migration and will produce arrays after. The database stores the same integer
   either way, so **the API contract is unchanged by this migration**.

The one rule to keep: **do not "improve" these to a Postgres native `enum` type
during the migration.** A native enum would make the stored representation a
labelled type, and every future addition of a flag would then require a schema
migration (`ALTER TYPE … ADD VALUE`) — turning a compile-time enum change into a
database change. The `integer` mapping is the correct choice and is what makes the
migration a non-event for these columns. A regression test pins this (§6).

---

## 5. Rehearsal checklist

- [ ] Rehearsal stack up, PostgreSQL published on **5433** (never 5432)
- [ ] **Prove which database 5433 reaches** before the first run
- [ ] `.dacpac` loaded into SQL Server in Docker — **one exists**: `.backup/dump.dacpac`
      (rehearsal convenience only, never the source of truth)
- [ ] Migration host(s) written — **one per `DbContext`** (see §7)
- [ ] `--check-schema` **PASSES** against the live source
- [ ] `--migrate --truncate` → **MIGRATION VERIFIED**
- [ ] Orphan checks = **0** on every foreign key
- [ ] `citext` check passes on **real** data (`DeductibleGroups.Name`)
- [ ] Full test suite green against PostgreSQL
- [ ] The **real application** run against the migrated data
- [ ] Clean-room repeatability: drop the target, re-apply, re-copy, re-verify

---

## 6. Prep work on this branch

This branch does the **preparation** the template requires before any data moves.
It does **not** copy data.

| # | Change | Why |
|---|---|---|
| 1 | `DatabaseProviderInfo` singleton | Startup branches on the **same value** the `DbContext` was built with, instead of a compile-time `#if` |
| 2 | Runtime provider selection | Deletes the `#if DEBUG` provider branch, the compile-time trap that broke Move's test suite |
| 3 | Npgsql provider + `AspNetCore.HealthChecks.NpgSql` | A SQL Server probe against a Postgres string **fails at startup** |
| 4 | Design-time factories for both contexts | Decides the SQL dialect of **every** generated migration; must not be `#if DEBUG`-dependent |
| 5 | `DateTime.(Now\|Today)` architectural test | Prevents the regression `DATETIME_KIND_TRAP.md` §5 describes |
| 6 | Flag-enum persistence test | Pins §4 so a future "modernise to a Postgres enum" cannot land silently |
| 7 | `citext` on `DeductibleGroups.Name` | Fixes the case-sensitivity defect in §3.1 |
| 8 | Raw-SQL portability fix + test | The five fragments in §2.1 |
| 9 | New `EasyFinance.Persistence.Postgres` project | Holds the PostgreSQL baseline; see §7 |

### Provider resolution order

Highest precedence first:

1. an explicit code argument (`providerOverride`, used by tests),
2. the `Database:Provider` configuration value / `Database__Provider` env var,
3. the **shape** of the `EasyFinanceDB` connection string (`Host=` → PostgreSQL,
   `Server=`/`Data Source=` → SQL Server) — this is what lets an existing deployment
   keep working without also setting a new key,
4. **in Development only**, the in-memory store (preserving the old `#if DEBUG`
   behaviour for `dotnet run`).

Outside Development, unresolvable configuration **stops startup**. Silently falling
back to the in-memory store would produce a pod that reports healthy while persisting
nothing — the failure mode is worse than a crash loop, because nothing looks wrong.

### What this branch deliberately does NOT do

- **It does not repoint production.** `EasyFinanceDB` keeps its name, so the cutover
  stays a **value** change, not a key rename plus a value change.
- **It does not copy data**, and does not touch the running site.
- **It does not delete the SQL Server migrations.** They stay, because they are the
  only thing that can recreate the old schema during the rollback window.
- **It does not introduce Flyway or DbUp.** Two histories over one schema is a new
  failure mode.
- **`MyKeysContext` now has its PostgreSQL migration** (§7). Data Protection keys are
  only persisted outside Development (`Program.cs`), so this never affected local
  runs — but it was a cutover blocker, because `MyKeys` needs its own migration set.
  It is now generated, verified and applied.
- **The migration host is written and has run** (§6b).

---

## 6a. Rehearsal: what was actually verified on this branch

This is the evidence section. Everything below was **run**, not reasoned about.

**Stack.** SQL Server 2022 on host port **14330**; PostgreSQL 17 on host port
**5433** — never 5432. The pack's hard rule was followed: before the first run, 5433
was proven to reach the rehearsal container (`SELECT current_database()` →
`econoflow_rehearsal`) and the host was confirmed to have **nothing listening on
5432**.

**Source schema.** `.backup/dump.dacpac` published into the rehearsal SQL Server:
**24 tables** — a real schema, not an empty database. Real row counts, which is what
makes the flag-enum evidence meaningful:
`ExpenseItems` 2,469 · `Expenses` 1,495 · `Notifications` 441 · `Categories` 225 ·
`Incomes` 179 · `UserProjects` 89 · `Projects` 83 · `AspNetUsers` 55.

### The flag-enum question, answered from real data

| Column | Values found in the real database |
|---|---|
| `AspNetUsers.NotificationChannels` | `5` (Email\|Push) on **all 55** rows |
| `Notifications.LimitNotificationChannels` | `0`, `8`, `28` (Push\|InApp\|WebPush) |

`28` is a **combination of flags stored as a plain integer**. This is precisely why
mapping these enums to a PostgreSQL native `enum` type would break: a native enum
cannot hold a combined value. The generated baseline confirms the correct mapping:

```sql
"NotificationChannels" integer NOT NULL DEFAULT 5
```

which is identical in meaning to the SQL Server original (`INT NOT NULL DEFAULT ((5))`).

### `citext`, proven three ways

| Check | Result |
|---|---|
| Extension created by the migration | `SELECT extname FROM pg_extension` → `citext` |
| Column type | `information_schema.columns` → `DeductibleGroups.Name` is `citext` |
| Case-insensitive **lookup** on the migrated table | `WHERE "Name" = 'travel'` finds the row stored as `'Travel'` → **1 row** |
| Case-variant **insert** on the migrated table | `duplicate key value violates unique constraint "IX_DeductibleGroups_ProjectId_TaxYearId_Name"` |
| **Control** — same test on plain `text` | **2 rows inserted** — the bug reproduced |

The control is the important one: it proves the fix is load-bearing rather than
theoretical, and that the defect was real.

### The generated PostgreSQL baseline

Applying `InitialPostgresBaseline` to the rehearsal database succeeded and created
**23 tables**. Verified properties:

| Check | Result |
|---|---|
| SQL Server artifacts (`nvarchar`, `datetime2`, `SqlServer:Identity`, `NEWID()`, `uniqueidentifier`) | **none** |
| PostgreSQL artifacts | `uuid`, `timestamp with time zone`, `character varying`, `citext` |
| `DateOnly` columns → `date` | 5 columns |
| `DateTime` columns → `timestamp with time zone` | 37 columns |
| Naive `timestamp without time zone` (**would be a Kind bug**) | **none** |

That last row is the `DateTime` conclusion from §3.2 confirmed at the schema level:
there is no naive timestamp anywhere, so no `DateTimeKind.Unspecified` value can be
written to a column that would reject it.

**Test suite:** 602 passing, 4 skipped (the `citext` tests, which require a real
PostgreSQL and skip with that reason stated), 0 failing.

---

## 6b. The data migration, rehearsed end to end

**Result: `MIGRATION VERIFIED` — every table matches the SQL Server source row for
row, by SHA-256 digest. 5,196 rows in 6.2 seconds.**

The host is `tools/EconoFlow.DataMigration/` — the three project-specific files the
template allows (`Program.cs`, `EconoFlowMigrationProfile.cs`, `MigrationPlan.cs`)
plus a csproj. The engine is the shared `fpssoftware.datamigration` package at
**1.1.3**, the floor EconoFlow needs because of its five `date` columns.

### What the generator produced, and what had to be decided

`--generate-plan` read the live catalog and emitted a 332-line draft over 24 tables
and 193 columns. It reported **no `<UNMAPPED>` types** — all nine distinct source
types have known mappings. It flagged four tables with no declarable key, and the
header listed the five things it cannot know. Each was resolved:

| Decision | Resolution |
|---|---|
| **Table order** | Draft was alphabetical; rewritten in foreign-key order |
| **Key columns** | `AspNetUserLogins` → `(LoginProvider, ProviderKey)`; `AspNetUserRoles` → `(UserId, RoleId)`; `AspNetUserTokens` → `(UserId, LoginProvider, Name)` |
| **Timestamps** | All 38 `datetime2`/`datetimeoffset` columns → `TimestampTz` **with a `UtcTimestamp` coercion** |
| **Unmapped types** | None |
| **Excluded tables** | `__EFMigrationsHistory`, `DataProtectionKeys` — reasons recorded in the plan |

**Naming:** the generator emitted `"dbo.Table"` on *both* sides. SQL Server's schema
is `dbo`; PostgreSQL's is `public` and has no `dbo`, so the source keeps the prefix
and the target is the bare name. Copying the generator's output verbatim would have
failed to find every target table.

### The four failures the rehearsal actually caught

This is the value of rehearsing. None of these would have been visible from reading
the code, and `--check-schema` found only the first.

1. **A hand-written plan omitted columns.** The first attempt used a helper that
   emitted only the `Id` column for UUID tables. `--check-schema` reported
   *"MISSING COLUMN dbo.AspNetUsers.CreatedDate"* and listed 2 real errors, plus
   NOTE-level lines for every deliberately excluded column. The plan was regenerated
   programmatically from the catalog rather than typed, which removes the whole class
   of transcription error.

2. **Foreign-key order was wrong.** `AspNetUsers.DefaultProjectId` references
   `Projects`, but the first order copied `AspNetUsers` first. The copy died with
   `23503: insert or update on table "AspNetUsers" violates foreign key constraint
   "FK_AspNetUsers_Projects_DefaultProjectId"`. PostgreSQL enforces foreign keys
   immediately, so the full 31-relationship FK graph was read from the catalog and the
   order rebuilt from it.

3. **The `DateTimeKind` trap — the predicted one, and it fired exactly as documented.**
   The copy failed on the fourth table with:

   ```
   ArgumentException: Cannot write DateTime with Kind=Unspecified to PostgreSQL type
   'timestamp with time zone', only UTC is supported.
   ```

   This is precisely the failure `DATETIME_KIND_TRAP.md` §1 describes. SQL Server's
   `datetime2` carries no offset, so `Microsoft.Data.SqlClient` materialises those
   values as `Kind=Unspecified`. The fix is a `Coerce` on all 38 timestamp columns
   using `DateTime.SpecifyKind(value, DateTimeKind.Utc)` — and deliberately **not**
   `ToUniversalTime()`, which would shift every value by the host offset and turn a
   loud crash into quiet corruption. `AspNetUsers.LockoutEnd` is the one
   `DateTimeOffset` column, and it converts through `.UtcDateTime` because it carries
   a real offset that must be respected.

   > `DATETIME_KIND_TRAP.md` §3 concluded EconoFlow's *application* was structurally
   > safe here, and that was correct — every writer goes through `SystemClock`. But
   > the **migration** is a separate writer, and it is the one that failed. The
   > app-side cleanliness did not protect the copy.

4. **The migrations assembly was not on the host's load path.** `--verify-only` failed
   with `FileNotFoundException: Could not load file or assembly
   'EasyFinance.Persistence.Postgres'` — the profile names the assembly so EF can find
   the PostgreSQL migrations, but nothing in the host's code referenced a type in it,
   so the compiler did not copy it to the output.

### Verification

| Check | Result |
|---|---|
| `--check-schema` against the live source | **PASSED** — "every table and column the plan needs exists in the source" |
| `--verify-only` before the copy | Correctly reported 19 tables MISMATCH (source populated, target empty) |
| `--migrate --truncate` | **MIGRATION VERIFIED**, 22 tables, row-for-row digests identical |
| Sequence resync | `AspNetRoleClaims.Id`, `AspNetUserClaims.Id` resynced |
| Idempotency | Re-running both EF migrations: "No migrations were applied. The database is already up to date." |
| `citext` on real migrated rows | `Health Insurance`, `health insurance` and `HEALTH INSURANCE` all return the **same single row**; inserting the case-variant violates `IX_DeductibleGroups_ProjectId_TaxYearId_Name` |

### Timings

| Step | Actual |
|---|---|
| `--check-schema` | seconds |
| Copy of 5,196 rows across 22 tables | **6.2 seconds** |
| Whole rehearsal | dominated by fixing the four failures above, not by the copy |

For a database this size the copy is trivial. The risk is entirely in the plumbing
and in the plan's correctness — which is what the rehearsal is for.

---

## 7. Migrations: the existing 36 cannot run on PostgreSQL

This is the part that decides the size of the remaining job, so it is stated plainly.

The 36 migrations in `Migrations/` and the 1 in `Migrations/MyKeys/` are **SQL Server
migration bodies**. They contain `nvarchar`, `datetime2`, `uniqueidentifier`,
`SqlServerPropertyBuilderExtensions.UseIdentityColumn`, and — in 4 of them — literal
`NEWID()` seed inserts. Running them against PostgreSQL fails at the first
statement. They are not portable and must not be "fixed" one by one.

The correct shape, per the template, is a **fresh PostgreSQL migration set**, and
that is what this branch builds:

### The structural constraint that decides the layout

EF Core discovers a context's migrations by scanning the assembly holding the
`DbContext` (plus any `MigrationsAssembly` override). `EasyFinance.Persistence`
already contains the 36 SQL Server migrations, so **EF cannot hold two active
migration sets for one context in one assembly** — generating a PostgreSQL baseline
into that project appends to the SQL Server history instead of starting a clean one.

The resolution is a dedicated project:

```
EasyFinance.Persistence/            the DbContext, the model, the 36 SQL Server migrations
EasyFinance.Persistence.Postgres/   the PostgreSQL baseline, and the factory that generates it
```

That keeps the SQL Server set untouched and working, which is what preserves the
rollback story for the whole rollback window, and it makes the dialect of a generated
migration a property of *which factory generated it* rather than of a build flag.

### What was done

1. `PostgresDesignTimeDbContextFactory` points at Npgsql **and** at the
   `EasyFinance.Persistence.Postgres` migrations assembly. Verified with
   `dotnet ef dbcontext info`:
   `Provider name: Npgsql.EntityFrameworkCore.PostgreSQL`, `tcp://localhost:5433`.
2. `InitialPostgresBaseline` generated — **22 tables**, reviewed, and confirmed to
   contain **zero** SQL Server artifacts (§6a).
3. `citext` is declared in **two** places, per the template: in the model inside an
   `if (Database.IsNpgsql())` guard (so a fresh database is creatable by migrations
   alone — this is what emitted `Npgsql:PostgresExtension:citext`), and the column
   type on `DeductibleGroups.Name`.
   > EF Core auto-detects an extension implied by a **column type** (`citext`), but
   > **not** one implied by an **index operator class** (`pg_trgm`). EconoFlow needs
   > no `pg_trgm`, because it has no leading-wildcard search.
4. Applied successfully to the rehearsal PostgreSQL: 23 tables present.
5. `MyKeysContext` also has its own PostgreSQL baseline
   (`Migrations/MyKeys/InitialPostgresBaseline`), generated through
   `MyKeysDesignTimeDbContextFactory`. Verified: `DataProtectionKeys` is created with
   `Id integer GENERATED BY DEFAULT AS IDENTITY` and `text` columns — no
   `SqlServer:Identity`, no `nvarchar`.
6. Both contexts have been applied, and re-running is a no-op
   (*"No migrations were applied"*), which matters because `UseMigration()` runs on
   **every** start-up.

### On the migration history table

Both contexts currently record their migrations in the **same**
`__EFMigrationsHistory` table. That is the *existing* behaviour, not something this
branch introduced: the SQL Server database has a single `__EFMigrationsHistory` with
37 rows (36 + the MyKeys one) for the same two contexts.

It is safe here because EF keys the table by `MigrationId`, and the two baselines have
distinct timestamp-based IDs
(`20261012185544_InitialPostgresBaseline` for the application context and
`20261012190723_InitialPostgresBaseline` for `MyKeys`). Verified: each context reports
only its own migration as applied, with nothing pending.

> **The risk to keep in mind:** this holds only while the IDs stay distinct. Two
> migrations generated in the *same second* for different contexts would collide. The
> template's guidance — "`MyKeys` **must have its own history table** and its own host"
> — is the robust shape, and is worth adopting if the two sets are ever regenerated
> together. It is recorded here as a known, analysed deviation rather than an
> oversight.

### Done

- **`MyKeysContext` PostgreSQL migration** — generated, applied, verified.
- **The migration host** — `tools/EconoFlow.DataMigration/`, with a plan and profile
  for the application context. `--check-schema` PASSES and `--migrate --truncate`
  reports **MIGRATION VERIFIED** (§6b).

### Still to do before cutover

- **The host migrates the application context only.** `MyKeysContext` holds Data
  Protection keys, which are deployment-specific and may be DPAPI-encrypted; the plan
  excludes that table deliberately, and the application generates its own keys on first
  run. If a cutover decision is made to carry keys across, that is a second profile.
- **`--auto` and the initContainer wiring** (`MIGRATION_TEMPLATE.md` §7) are not set
  up. The tool must be published into the application image at `/app/migrator`, and the
  Deployment needs an initContainer. Note the host needs the
  **`Microsoft.AspNetCore.App`** shared framework, so it must ship in the `aspnet`
  image — a `runtime` image builds fine and dies at start-up.

The existing SQL Server migrations stay in the repository until the rollback window
closes, because they are the only thing that can recreate the old schema.

---

## 8. Cutover checklist

Per `CUTOVER_LESSONS.md` §7, plus the two items Move added:

- [ ] Freeze merged **and verified in the cluster** (both halves: Argo `syncPolicy.automated`
      **and** the Image Updater rule)
- [ ] Role owns the database; migrator login exists and **UPDATE is denied**
- [ ] Every `secretKeyRef` cross-checked against the sealed keys
- [ ] Image verified **by running it** — Npgsql present, `sqlclient` absent
- [ ] **Resolve and record the image digest** before the window
- [ ] `--check-schema` PASSES against live production *(PASSES against rehearsal — §6b)*
- [ ] Pre-window row counts recorded
- [ ] Scale to 0; **confirm zero SQL Server connections**
- [ ] Copy → **MIGRATION VERIFIED**; orphan checks = 0 *(verified in rehearsal — §6b)*
- [ ] Repoint the connection string **and apply the image digest explicitly**
- [ ] Health endpoints 200; SQL Server connections 0, PostgreSQL > 0
- [ ] **Cluster matches `kustomize build`** before restoring automation
- [ ] Automation restored — both halves, one commit — then **prove nothing reverted**
- [ ] PostgreSQL added to the **backup schedule** (most commonly forgotten)
- [ ] Passwords rotated; SQL Server left read-only for the rollback window

> **Not yet rehearsed, and they need a live-environment dress rehearsal before the
> window:** the `--auto` initContainer path, the migrator inside the application image,
> and the image-digest step. Everything data- and schema-related has been rehearsed
> against a copy of the real database.

`docs/docker.md` documented the readiness probe as *"`200 OK` when SQL Server and
S3/Minio are reachable"*. **That has been updated on this branch** to describe the
provider-aware health check and the new `Database__Provider` variable — otherwise the
deploy notes would describe a dependency the image no longer has.

---

## 9. The two failures to expect, because they have happened every time

**1. The image pin decides what runs.** CI publishing `:latest` does **not** move a
digest-pinned Deployment. Symptom: crash-loop with
`ArgumentException: Keyword not supported: 'host'` from
`Microsoft.EntityFrameworkCore.SqlServer…SqlServerConnection`. **Read the types in the
stack** — that is the old build, not a bad connection string.

**2. A secret key is missing or mis-keyed.** The pod stops at
`CreateContainerConfigError`, which looks like bad credentials but is really "the key
is not there".

---

## 10. What EconoFlow must NOT inherit from the other projects

- Do **not** copy a migration tool into this repository — the engine is a **shared
  package**; EconoFlow supplies a plan, a profile and a 10-line `Program.cs` **per context**.
- Do **not** copy Move's plan. That is Move's schema.
- Do **not** rename `EasyFinanceDB`.
- Do **not** introduce Flyway or DbUp alongside EF Core migrations.
- Do **not** map the flag enums to a Postgres native `enum` type (§4).

---

## 11. Open questions for the product owner

These cannot be answered from the repository and are needed before the cutover
window can be sized:

1. Database size and row counts in production (Q9)?
2. Acceptable downtime — stop-the-world, or initContainer with `--auto` (Q10)?
3. Do any stored procedures, views, triggers or agent jobs exist in the live database
   that have no source file here?
4. Is the MinIO bucket shared with another application, and is it already populated?
5. Does any external reporting tool read the EconoFlow database directly?
