# EconoFlow — PostgreSQL migration pre-flight

**Status: NOT STARTED.** This file is the entry point for the next session. It is a
*questionnaire with the answers left blank*, deliberately: nothing below has been
established about EconoFlow yet, and guessing here is how a migration gets planned around
the wrong shape.

Fill it in **before** writing any code, then use it to pick which completed project
EconoFlow most resembles. The procedure itself is in
[`MIGRATION_TEMPLATE.md`](MIGRATION_TEMPLATE.md).

---

## 1. Establish the shape (do this first)

Every answer here selects a different documented path. Record the evidence, not an
impression — a file path and line number, or a command and its output.

| # | Question | Answer | Evidence |
|---|---|---|---|
| 1 | How many `DbContext` types exist? | **2** — `EasyFinanceDatabaseContext`, `MyKeysContext` | `EasyFinance.Persistence/DatabaseContext/*.cs` |
| 2 | Does any context use a non-default schema? | _unknown_ | |
| 3 | What is the connection-string env var? | **`EasyFinanceDB`** | `PersistenceServiceRegistration.cs:20` |
| 4 | Is provider selection compile-time (`#if DEBUG`)? | **YES** — `#if DEBUG` (line 15) chooses InMemory vs SqlServer | `PersistenceServiceRegistration.cs:15-34` |
| 5 | How many migrations are there? | **2 histories: 36 (+1 snapshot) in `Migrations/`, and `MyKeys/`** | see below |
| 6 | Are there `date`-only columns? | _unknown_ — **likely**, it is a finance app | |
| 7 | Is there a health check tied to SQL Server? | **YES** — `AddSqlServer(connectionString)` at line 33 | `PersistenceServiceRegistration.cs:33` |
| 8 | Attachment storage providers? | **MinIO and filesystem** (factory-selected) | `EasyFinance.Application/**/AttachmentStorageService*.cs` |
| 9 | Database size and row counts? | _unknown_ | |
| 10 | Acceptable downtime? | _unknown_ | |

**Verified so far in the source** (`PersistenceServiceRegistration.cs`), quoted rather
than paraphrased:

```csharp
#if DEBUG
    services.AddDbContext<EasyFinanceDatabaseContext>(options => options
        .UseInMemoryDatabase("AppDb")...);
#else
    var connectionString = Environment.GetEnvironmentVariable("EasyFinanceDB") ?? string.Empty;
    services.AddDbContext<EasyFinanceDatabaseContext>(
        options => options.UseSqlServer(connectionString, ...));
    services.AddDbContext<MyKeysContext>(options => options.UseSqlServer(connectionString));
#endif
...
#if !DEBUG
    healthChecksBuilder.AddSqlServer(connectionString);
#endif
```

Migration file counts are the raw files, not the number of migrations — each migration
contributes a `.cs` and a `.Designer.cs`:

| Folder | `.cs` files | Actual migrations |
|---|---:|---:|
| `Migrations/` | 73 | **36** (+1 model snapshot) |
| `Migrations/MyKeys/` | 3 | **1** (+1 model snapshot) |

> **Findings #1, #4, #5 and #7 together settle EconoFlow's shape.** Two contexts means
> **two migration hosts** — WhiteLabel's shape, not Move's. A single shared connection
> string (`EasyFinanceDB`) serves both contexts, which is worth confirming against the
> deployment before relying on it. The `#if DEBUG` branch is the compile-time trap the
> template calls out; expect it to break the test suite exactly as it did on Move, where
> tests silently got the in-memory store from that branch and started failing the moment
> the provider became a runtime decision. The SQL Server health check **fails at startup**
> against a PostgreSQL connection string and must become `AspNetCore.HealthChecks.NpgSql`.

---

## 2. Audit the SQL Server surface

Run each of these and record what it finds. The point is to size the job and to find the
items that are **rewrites rather than ports**.

```powershell
# Provider wiring and packages (the migration itself)
rg -n "UseSqlServer|EntityFrameworkCore\.SqlServer|HealthChecks\.SqlServer|SqlServerModelBuilderExtensions|SqlServerPropertyBuilderExtensions"

# Raw SQL and engine-specific functions — each hit is a manual fix
rg -n "FromSqlRaw|ExecuteSqlRaw|ExecuteSqlInterpolated|GETDATE|SYSDATETIME|NEWID|ISNULL|\[dbo\]|\bTOP\b"

# String semantics that depended on the collation (SILENT behaviour change)
rg -n "\.Contains\(|\.StartsWith\(|\.EndsWith\(|EF\.Functions\.Like"

# Unique indexes over text (needs citext, or they start accepting 'a' and 'A')
rg -n "HasIndex\(.*\)\.IsUnique\(\)"

# Compile-time provider selection
rg -n "#if DEBUG|#if !DEBUG"

# Identities / sequences / column types
rg -n "UseIdentityColumn|ValueGeneratedOnAdd|datetime2|datetimeoffset|uniqueidentifier|nvarchar|HasColumnType\(|HasCollation\(|UseCollation\("
```

Also check: the `Dockerfile` and CI for `InvariantGlobalization` and provider env vars;
**stored procedures, views and triggers** in the database itself (these are rewrites, or
better, moved into the app); SSIS/agent jobs; and any reporting tool reading the database.

**Record the raw-SQL hit count here:** _unknown_

> A finance application is a strong candidate for **raw SQL in reporting or aggregation**
> (monthly totals, balances, period rollups). Those are the expensive part of this
> migration, not the schema. Find them early — a `--check-schema` pass tells you nothing
> about them, because they are strings in C#.

---

## 3. The semantic audit that changes behaviour silently

These do not fail loudly. Each one is a real defect that passes every schema check.

| Trap | What to look for | Why it matters |
|---|---|---|
| Case-sensitive `LIKE` | every `.Contains()` / `.StartsWith()` used as a search | SQL Server's `_CI_` collation made these case-insensitive; PostgreSQL's `LIKE` is not, so search **silently returns nothing**. Must become inline `EF.Functions.ILike(...)`. |
| Wildcards in user input | search boxes, filters | `%` and `_` are wildcards on PostgreSQL. Without escaping, searching `50%` matches **everything**. |
| Case-sensitive equality | usernames, emails, category/account names, any unique index over text | Without `citext` the unique index accepts both `Food` and `food` as separate rows. |
| Leading-wildcard search | any `ILIKE '%term%'` | Needs a **GIN trigram index**; a B-tree cannot serve it, so the query becomes a sequential scan. |
| `datetime2(7)` precision | every timestamp | 100 ns → 1 µs truncation. |
| `DateTimeKind.Unspecified` | legacy rows | **Npgsql rejects it.** Force `SpecifyKind(..., Utc)` on write — and **never** call `ToUniversalTime()`, which shifts by the host offset. |
| UUID ordering | `uniqueidentifier` primary keys, especially in `ORDER BY` | SQL Server sorts by the last six bytes, PostgreSQL bytewise — a naive row comparison reports false mismatches. The engine handles this; do not hand-roll comparisons. |
| `date` columns | transaction/period/due dates | **Requires engine 1.1.3** (see `README.md`). |

**Collation policy — decide per column, not globally:**

| Situation | Use |
|---|---|
| Compared for **equality**, indexed or unique | `citext` |
| Only ever **searched** with a pattern | plain `text` + `ILIKE` + trigram GIN index |
| Only displayed, or joined by id | plain `text` |

> Do **not** reach for `citext` everywhere: it cannot be used with `pg_trgm` operator
> classes, so a `citext` column **loses** its trigram search path. That is a trap that
> only shows up as "search got slow", long after the migration.

---

## 4. Rehearsal checklist

- [ ] Rehearsal stack up, PostgreSQL published on **5433** (never 5432)
- [ ] **Prove which database 5433 reaches** before the first run
- [ ] `.dacpac` (or equivalent) loaded into SQL Server in Docker
- [ ] Migration host(s) written — **one per `DbContext`**
- [ ] `--check-schema` **PASSES** against the live source
- [ ] `--migrate --truncate` → **MIGRATION VERIFIED**
- [ ] Orphan checks = **0** on every foreign key
- [ ] `citext` / `ILIKE` / wildcard checks pass on **real** data
- [ ] Full test suite green against PostgreSQL
- [ ] The **real application** run against the migrated data — this is the check that
      catches a missed `ILIKE`, and no SQL-level test replaces it
- [ ] Clean-room repeatability: drop the target, re-apply, re-copy, re-verify

---

## 5. Cutover checklist

Per `CUTOVER_LESSONS.md` §7, plus the two items Move added:

- [ ] Freeze merged **and verified in the cluster** (both halves: Argo `syncPolicy.automated`
      **and** the Image Updater rule)
- [ ] Role owns the database; migrator login exists and **UPDATE is denied**
- [ ] Every `secretKeyRef` cross-checked against the sealed keys
- [ ] Image verified **by running it** — Npgsql present, `sqlclient` absent
- [ ] **Resolve and record the image digest** before the window
- [ ] `--check-schema` PASSES against live production
- [ ] Pre-window row counts recorded
- [ ] Scale to 0; **confirm zero SQL Server connections**
- [ ] Copy → **MIGRATION VERIFIED**; orphan checks = 0
- [ ] Repoint the connection string **and apply the image digest explicitly** — a frozen
      Argo will **not** do it for you
- [ ] Health endpoints 200; SQL Server connections 0, PostgreSQL > 0
- [ ] **Cluster matches `kustomize build`** before restoring automation
- [ ] Automation restored — both halves, one commit — then **prove nothing reverted**
- [ ] PostgreSQL added to the **backup schedule** (most commonly forgotten)
- [ ] Passwords rotated; SQL Server left read-only for the rollback window

---

## 6. The two failures to expect, because they have happened every time

**1. The image pin decides what runs.** CI publishing `:latest` does **not** move a
digest-pinned Deployment. This is a *separate act*, and it has gone wrong on the pilot and
again on Move. Symptom: the app crash-loops with
`ArgumentException: Keyword not supported: 'host'` from
`Microsoft.EntityFrameworkCore.SqlServer...SqlServerConnection`. **Read the types in the
stack** — that is the old build, not a bad connection string.

While Argo is **frozen**, `selfHeal` is off, so nothing converges git into the cluster —
including your fix. Apply the image explicitly with `kubectl patch` / `kubectl set image`.

**2. A secret key is missing or mis-keyed.** The pod stops at `CreateContainerConfigError`,
which *looks* like bad credentials but is really "the key is not there". Grep the actual
sealed secret for every `secretKeyRef` your manifests use, before the window.

---

## 7. What EconoFlow must NOT inherit from the other projects

- Do **not** copy a migration tool into this repository. The engine is a **shared package**;
  EconoFlow supplies a plan, a profile and a 10-line `Program.cs` **per context**.
- Do **not** copy Move's plan. That is Move's schema.
- Do **not** rename `EasyFinanceDB`. Keeping the existing env var name means the cutover is
  a **value** change, not a key rename plus a value change.
- Do **not** introduce Flyway or DbUp alongside EF Core migrations. Two histories over one
  schema is a new failure mode.
