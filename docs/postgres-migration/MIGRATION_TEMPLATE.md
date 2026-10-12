# SQL Server → PostgreSQL migration template (per project)

A reusable, hardened checklist for migrating one .NET / EF Core project from SQL Server to
PostgreSQL. Written for a **five-project programme** where CesarBarbosa is the pilot: everything here
was learned by doing it once, and the goal is that projects 2–5 do not re-earn any of it.

Sources of truth, in order:

| Document | Answers |
|---|---|
| **This file** | *What do I do, in what order, for project N — and what must I not forget?* |
| [`DATABASE_MIGRATION.md`](DATABASE_MIGRATION.md) | *How does it work? What broke, and why?* (the pitfalls, in depth) |
| [`CUTOVER.md`](CUTOVER.md) | *How do I actually perform the switch on the cluster?* (operational runbook) |

Read `DATABASE_MIGRATION.md` Part 3 before starting any project. It is the long-form version of the
traps summarised here.

---

## 0. Before you start (once, shared by all five)

- [ ] **Pick the tooling and freeze it across all five projects.** Deviating per project means
      re-earning the trust each time; the whole point of a pilot is to reuse it.
      - Data: the **shared migrator tool** extracted from this repo's
        `tools/CesarBarbosa.DataMigration` (see §1) — *not* pgloader, *not* AWS DMS.
        pgloader would re-derive the type mapping that Part 3 of `DATABASE_MIGRATION.md` painstakingly
        verified; AWS DMS needs infrastructure that a cluster-internal SQL Server does not justify.
      - App: `Npgsql.EntityFrameworkCore.PostgreSQL`. Pin `Microsoft.EntityFrameworkCore`
        **explicitly** at the version Npgsql requires (Npgsql 10.0.3 needs EF Core ≥ 10.0.4) so
        NuGet cannot resolve a lower EF Core than the rest of the solution.
      - Health check: swap `AspNetCore.HealthChecks.SqlServer` → `AspNetCore.HealthChecks.Npgsql`.
        A SQL Server probe against a Postgres connection string **fails at startup**.
      - Migrations: EF Core migrations, applied by the tool's `--migrate`. Do not introduce Flyway
        or DbUp alongside EF — two histories over one schema is a new failure mode.
- [ ] **Decide the conventions and write them down.**
      - Identifier casing: this solution uses **EF Core default PascalCase, double-quoted**. Postgres
        folds unquoted identifiers to lowercase, so *every* hand-written identifier must be quoted:
        `pg_get_serial_sequence('"AspNetUserClaims"', 'Id')`. Unquoted, it folds and fails.
      - Dates: `timestamptz`, UTC, `DateTimeKind.Utc` forced on every write.
      - GUIDs: `uuid` (bytewise ordering — see the uuid trap in §6).
      - Case sensitivity: **decide per column**, not globally. See the collation policy below.
- [ ] **Collation / case-sensitivity policy.** This is the single biggest source of silent behaviour
      change, and it is a *policy* decision, not a mechanical one:

      | Situation | Use |
      |---|---|
      | Column is compared for **equality** and indexed/uniqued | `citext` |
      | Column is only ever **searched** with a pattern | plain `text` + `ILIKE` + trigram index |
      | Column is data you only display or join on by id | plain `text` |

      Do **not** reach for `citext` everywhere: it cannot be used with `pg_trgm` index operators, so
      a `citext` column loses the trigram search path. Equality → `citext`; pattern → `text`+GIN.
- [ ] **Stand up PostgreSQL dev/staging, plus backup and monitoring, before touching code.** A
      migration with no target to rehearse against is not a plan.
- [ ] **Order the projects deliberately.** Start with the smallest or least critical —
      **that is what CesarBarbosa is.** Do not start with the busiest one.
- [ ] **Confirm the classification in §1 first.** If your project needs no data copy (nothing in
      production), you can skip most of §4 — but not §2, §3 or §7.

---

## 1. Is this project "generic tool" or "project-specific plan"?

Answer this before writing any code, because it decides how much work the project is.

The shared tool is **deliberately split**: the engine is generic, and a project contributes only a
plan + a few knobs. Concretely:

| Piece | Generic? | Where it lives |
|---|---|---|
| Copy, verify, digest, sequences, `--auto` marker | **Yes** | shared tool |
| SQL Server catalog read (`--check-schema`, `--generate-plan`) | **Yes** | shared tool |
| Table/column map | **No — per project** | the project's `MigrationPlan.cs` |
| Key columns for the digest (`KeyColumns`) | **No — per project** | same plan file, per table |
| Connection defaults | **No — per project** | env vars / config, never code |
| App env var name (`CesarBarbosaDB`, `EasyFinanceDB`, …) | **No — per project** | `MIGRATION_APP_CONNECTION_VAR` / `--app-env-var` |

The three seam leaks that used to exist have been **fixed**, so a new project now supplies a plan
and configuration only:

| Was | Now |
|---|---|
| `Verifier.IsKeyColumn` — a hardcoded table-name switch in generic code | `TablePlan.KeyColumns`, declared per table. Tables with an `Id` column default to `["Id"]`; join tables state their key explicitly. A plan with no declarable key is reported by `--check-schema` as `NO KEY COLUMN`. |
| `CesarBarbosaDB` hardcoded as the target fallback | `MIGRATION_APP_CONNECTION_VAR` env var or `--app-env-var <name>` argument. Defaults to `CesarBarbosaDB` so this project's deployment is unchanged. |
| Project name in messages | Remaining project-specific strings are the connection defaults (already overridable by env) and the banner. |

**The escape hatch already exists:** `--generate-plan` reads the **live catalog** and emits a
reviewed-draft plan for any database, including one with no schema dump. So a new project starts
with one command, not from a blank file.

- [ ] Run `--generate-plan` against the project's live SQL Server.
- [ ] Review the draft against the **five things a generator cannot know** (it prints them as a
      header, deliberately): table order for FKs, key columns, timestamp coercion, every
      `<UNMAPPED>` type, and which tables to exclude.
- [ ] Declare `KeyColumns` on every table the generator flags — it emits a `NOTE` for any table
      whose key it could not infer.
- [ ] Set `MIGRATION_APP_CONNECTION_VAR` (or pass `--app-env-var`) to the environment variable your
      deployment already uses; do not edit code.
- [ ] Make `--check-schema` a standing gate in CI-rehearsal.

> **Do not copy the tool into each repository.** The engine carries hard-won fixes (the `citext`
> connection-cache bug, uuid ordering, the SQL Server reader retry) that must not be re-fixed five
> times. Share one tool and give each project a plan.

### Exactly what a new project supplies

The engine is **~2,100 lines and is now a package**. A project supplies **three small files** —
measured, not estimated:

| File | Per project? | Lines |
|---|---|---|
| **`<Project>MigrationProfile.cs`** | ✅ | ~100 |
| **`MigrationPlan.cs`** | ✅ | ~205 |
| **`Program.cs`** | ✅ | 10 |
| everything else (`FpsSoftware.DataMigration`) | ❌ package reference | ~2,100 |

The host is **two directories, not one file list**: the library project is referenced (later, a
package) and the project keeps only its own three files. Nothing project-specific remains in the
library — checkable with one command:

```bash
grep -rn 'CesarBarbosa\|EasyFinance' FpsSoftware.DataMigration/   # expect only doc examples
grep -n 'ProjectReference' FpsSoftware.DataMigration/*.csproj      # expect none
```

> **The engine must never import the project.** The natural mistake is to let engine files
> `using <Project>.DataMigration;` to reach the plan. That inverts the dependency and stops
> compiling the moment the engine is a package. The plan is reached through
> `MigrationProfile.Tables` instead, so the arrow points one way.

The project implements `MigrationProfile`, which is the **only** extension point:

```csharp
internal sealed class YourMigrationProfile : MigrationProfile
{
    public override string AppConnectionVariable => "EasyFinanceDB";
    public override string DefaultSource => "Server=localhost,14330;...";   // rehearsal only
    public override string DefaultTarget => "Host=localhost;Port=5432;..."; // rehearsal only
    public override IReadOnlyList<string> RequiredExtensions => ["citext", "pg_trgm"];
    public override IReadOnlyList<TablePlan> Tables => MigrationPlan.Tables;
    public override IReadOnlyDictionary<string,string> SequencesToResync => MigrationPlan.SequencesToResync;

    protected override DbContext CreateContext(string cs) =>
        new YourDbContext(new DbContextOptionsBuilder<YourDbContext>()
            .UseNpgsql(cs, o => o.CommandTimeout(300)).Options);
}
```

Wired up with one statement, first in `Program.cs`:

```csharp
MigrationProfile.Use(new YourMigrationProfile());
```

`Use` throws if it is never called, and if it is called twice. That is deliberate: the tool is run
as a cutover command, where silently falling back to defaults could aim a truncating copy at the
wrong database.

`CreateContext` exists so the shared engine never names a project's `DbContext` — without it,
`Schema.cs`, the file that applies your EF Core migrations, could not be shared.

**A project's total migration surface is therefore two files and one line.** Everything else is
referenced.

> **The environment variable is overridable at run time** (`MIGRATION_APP_CONNECTION_VAR` or
> `--app-env-var`), so `AppConnectionVariable` rarely needs editing either.

### Starting a new project — the short version

```bash
# 1. Draft a plan from the LIVE source catalog. Read-only.
dotnet run --project <shared-tool> -- --generate-plan > MigrationPlan.cs

# 2. Review it. The generator prints the five things it CANNOT know:
#    table order (FKs), key columns, timestamp coercion, <UNMAPPED> types,
#    and which tables to exclude. Fix every <UNMAPPED> and every NO KEY COLUMN.

# 3. Validate the plan against the live database before anything moves.
MIGRATION_SOURCE="Server=<prod>;..." \
  dotnet run --project <shared-tool> -- --check-schema
```

Then the project's `MigrationProfile` implementation, then dry-run with `--verify-only` once the
schema exists.

### Extraction plan (done — the engine is now a package)

**The engine lives in its own project, `FpsSoftware.DataMigration/`, and is published as a private
NuGet package** on the `fpssoftware.uk` feed alongside `fpssoftware.chassis`.

```
FpsSoftware.DataMigration/          ← the LIBRARY (packaged)
├── MigrationHost.cs                RunAsync(args) — the engine's front door
├── MigrationProfile.cs             the abstract contract a project implements
├── TablePlan.cs                    TablePlan / ColumnPlan — the plan's shapes
├── Schema.cs, MigrationState.cs, AutoRunner.cs, PlanTools.cs,
│   SchemaInspector.cs, EngineTypes.cs
└── FpsSoftware.DataMigration.csproj   PackageId + Version

tools/CesarBarbosa.DataMigration/   ← this project's HOST (3 files + csproj)
├── Program.cs                      10 lines: Use(profile) + RunAsync(args)
├── CesarBarbosaMigrationProfile.cs the project's values
└── MigrationPlan.cs                the table/column map
```

The engine is project-referenced today so this repo builds without waiting on a package release. A
new project references the **package**:

```xml
<PackageReference Include="FpsSoftware.DataMigration" Version="1.0.0" />
```

### Publishing a new engine version

**The package publishes automatically on every push to `main`** — the same trigger as
`fpssoftware.chassis`. The workflow (`.github/workflows/nuget-publish.yml`) lives in the **pilot
repository (CesarBarbosa), not here** — it packs `FpsSoftware.DataMigration/` from that repo and
pushes it to the private feed. WhiteLabel only *consumes* the package; it does not publish it, and
there is nothing to copy from this document's workflow section into this repository.

So to release a new version, bump the csproj and merge:

```bash
# 1. bump <Version> in FpsSoftware.DataMigration/FpsSoftware.DataMigration.csproj
# 2. merge to main — the workflow packs and pushes
```

Re-running on an unchanged version is harmless: the push uses `--skip-duplicate`, so it is skipped
rather than failing.

> **An earlier version of this workflow triggered on a `v*` tag**, on the reasoning that publishing
> a package is a deliberate act. The reasoning was fine; the outcome was a workflow that sat in the
> repository and **never ran once**, so the package was simply missing from the feed with nothing to
> show why. It now follows the chassis pattern, which has a track record in this organisation.
> Consistency with a known-working pipeline beats extra ceremony, and a workflow nobody has watched
> run is not safer than one that runs on every merge.

Consume it with:

```xml
<PackageReference Include="fpssoftware.datamigration" Version="1.0.0" />
```

The package id is lowercase, matching `fpssoftware.chassis` — NuGet resolves ids case-insensitively,
but the id is stored as published and displayed that way in the Gitea UI.

### Two rules that keep the package usable

Breaking either makes the package unusable by any other project:

1. **No `ProjectReference` to an application.** The library knows nothing about any `DbContext`;
   projects hand one in through `MigrationProfile.CreateContext`. A reference here would tie the
   package to one application's assembly graph.
2. **No project-specific values.** Everything a project varies lives on `MigrationProfile`. A
   hardcoded value in the library means the next project edits the package instead of configuring
   it — the divergence the package exists to prevent.

Both are checkable in one command:

```bash
grep -rn 'CesarBarbosa\|EasyFinance' FpsSoftware.DataMigration/   # expect only doc examples
grep -n 'ProjectReference' FpsSoftware.DataMigration/*.csproj      # expect none
```

### What made it packageable

The engine could not be packed before. Two structural blockers, both now removed:

- **It was an `Exe`.** All orchestration lived in top-level statements in a project's `Program.cs`,
  and a package is something you reference, not something you run. The orchestration is now
  `MigrationHost.RunAsync(args)` in the library, and each project's `Program.cs` is 10 lines.
- **It referenced the application.** The old csproj had a `ProjectReference` to the app's
  persistence project. That is gone; the `DbContext` arrives as a delegate.

`Microsoft.EntityFrameworkCore.Relational` is referenced rather than a provider — the provider
(Npgsql) belongs to the consuming project, which already has it for its application.

---

## 2. Assess (per project)

- [ ] List tables, views, procs, functions, triggers, jobs, linked servers.
- [ ] Find SQL Server-specific features: CLR, `MERGE`, `OUTPUT`, `FOR XML`, `OPENQUERY`, temporal
      tables, `hierarchyid`, full-text search. **Each one is a rewrite, not a port** — call them out
      as work items now.
- [ ] Find raw SQL in code: Dapper, `FromSqlRaw`, `ExecuteSqlRaw`, string-built queries.
- [ ] Record DB size and the acceptable downtime. This decides initContainer-without-freeze vs
      stop-the-world — see [`CUTOVER.md`](CUTOVER.md) §0.
- [ ] **Check for cross-database queries and tables shared with the other four projects.** If a
      table is shared, it cannot be migrated on its own schedule: migrating it twice, or in the
      wrong order, gives two divergent copies. Resolve shared tables **once, as a programme-level
      decision**, before any project moves.
- [ ] **Check the object store separately from the database.** Images/binaries are *not* in a schema
      dump and are not moved by this migration. Confirm whether the bucket is shared and already
      populated. (CesarBarbosa: yes — `Image.StorageKey` values are unchanged and the bucket is
      untouched. Getting this wrong is how you ship a "successful" migration with broken images.)

---

## 3. Schema

- [ ] Convert with a tool, then **review every line by hand** — do not trust a converter's output.
- [ ] Map types, identities, defaults, computed columns, constraints.

      | SQL Server | PostgreSQL | Trap |
      |---|---|---|
      | `nvarchar(max)` | `text` | no `(max)` suffix, no length limit |
      | `bit` | `boolean` | raw `= 0` / `= 1` in SQL must become `false` / `true` |
      | `datetime2(7)` | `timestamptz` | **100 ns → 1 µs truncation** |
      | `uniqueidentifier` | `uuid` | **ordering differs** — see §4 |
      | `IDENTITY(1,1)` | `GENERATED BY DEFAULT AS IDENTITY` | explicit inserts do **not** advance the sequence |
      | `ISNULL(a,b)` | `COALESCE(a,b)` | `??` in LINQ translates on both |
      | `GETDATE()` | `now()` | prefer client-side `DateTime.UtcNow` so it is parameterised |
      | `'a' + NULL` → NULL | `\|\|` propagates NULL | `concat()` treats NULL as empty — different behaviour |

- [ ] Recreate indexes, **including included columns and filtered indexes**, and re-review them for
      Postgres. A filtered index becomes a partial index (`WHERE ...`); included columns become
      `INCLUDE (...)`. Neither maps automatically.
- [ ] Rewrite procs, functions and triggers in PL/pgSQL **or move the logic into the app**. Prefer
      the app: business logic in the database is what makes the next migration expensive.
- [ ] Add the extensions **in two places** — in the model (inside an `if (Database.IsNpgsql())`
      guard) so a fresh database is creatable by migrations alone, and in an init script for
      convenience on a fresh volume.

      > EF Core auto-detects an extension implied by a **column type** (`citext`), but **not** one
      > implied by an **index operator class** (`pg_trgm`). The latter must be declared explicitly.

---

## 4. Application

- [ ] Swap the provider: `UseSqlServer` → `UseNpgsql`, in **every** project. Audit all of them —
      a redundant reference in the web project is easy to miss and keeps SQL Server loadable.
- [ ] **Move provider selection from compile time to run time.** Delete every `#if DEBUG` provider
      branch: it makes the provider a build property, so a Debug build cannot be pointed at a real
      database at all. Resolve from configuration, and expose the decision via a singleton
      (`DatabaseProviderInfo`) so startup branches on the same value the `DbContext` was built with.
- [ ] Point the `IDesignTimeDbContextFactory` at the new provider **before generating any
      migration** — that file decides the SQL dialect of every generated migration. Never make it
      `#if DEBUG`-dependent.
- [ ] Fix raw SQL: `[brackets]` → `"quotes"`, `TOP n` → `LIMIT n`, `GETDATE`, `ISNULL`, `+`
      concatenation, `bit` comparisons.
- [ ] **Fix string case sensitivity and wildcard escaping.** This changes meaning *silently*:
      SQL Server's `_CI_` collation made `LIKE` case-insensitive and treated `%`/`_` as the app
      expected. Postgres `LIKE` is case-sensitive, so search silently returns nothing.
      - Rewrite search clauses to **inline** `EF.Functions.ILike(p.Field, pattern, escapeChar)`.
        **A helper method that wraps `ILike` does not translate** — it must appear where EF Core
        builds the expression tree.
      - Escape `\` first, then `%`, then `_`, and pass the escape character. Otherwise searching
        `50%` matches everything.
      - Map equality/unique text columns to `citext` (§0 policy).
      - Add **trigram (GIN) indexes** for leading-wildcard search: a B-tree index cannot serve
        `ILIKE '%term%'`, so without `pg_trgm` the site search is a sequential scan.
- [ ] **Audit every `HasIndex(...).IsUnique()` over a text column.** Without `citext` (or a
      functional unique index on `lower(col)`), the index starts accepting `Cultura` and `cultura`
      as two different rows.
- [ ] Check transaction isolation and locking assumptions.
- [ ] **Check `DateTime` handling.** Npgsql is strict: it rejects a `DateTime` whose `Kind` is
      `Unspecified`. Legacy rows are often UTC stored as `Unspecified`, so force
      `DateTime.SpecifyKind(v, DateTimeKind.Utc)` on write — and **never** call `ToUniversalTime()`
      on them, which shifts by the host offset and makes an identical copy look different.
- [ ] Update connection strings, secrets, health checks. **Keep the old env var name** if
      deployments already set it — renaming it is a second, unnecessary change during a cutover.
- [ ] Rehearse: the InMemory provider **cannot translate `EF.Functions.ILike`**, so search is
      untestable without a real Postgres (test with Testcontainers).

---

## 5. Data

- [ ] Test-load into staging and **time it**. The number sets the cutover window and decides whether
      a write freeze is affordable.
- [ ] Plan CDC only if the database is large or genuinely live (DMS or Debezium). For a small,
      low-write database a short freeze + truncate-and-recopy is **simpler and safer** than
      incremental sync — and `--truncate` is inherently idempotent, which incremental logic is not.
- [ ] **Reset sequences after the load.** `COPY` inserts explicit values and never advances the
      sequence, so without `setval(pg_get_serial_sequence(...), MAX(col), true)` the application's
      first insert collides with an existing key. Identifiers must be **double-quoted**.
- [ ] Handle encoding, empty string vs `NULL`, and trailing spaces. (SQL Server collapses `''` and
      `' '` in some comparisons; Postgres does not.)

---

## 6. Validate

- [ ] **Refuse to run against an unmigrated target** — otherwise you get one
      `relation does not exist` per table instead of one actionable message.
- [ ] **Refuse to run when source and target resolve to the same endpoint.** Compare host+database,
      not the raw string, so `localhost,14330` vs `localhost:14330` is still caught. With
      `--truncate`, this mistake empties the system of record — and it is *realistic*, because the
      target commonly falls back to the same environment variable the application uses.
- [ ] Compare row counts, then **per-table SHA-256 digests over all rows**.
      - Order by a **deterministic key**, and cast uuid keys to text on both sides
        (`CONVERT(varchar(36), col)` vs `col::text`) — see the ordering trap below.
      - Normalise before hashing: `Guid` → lowercase `"D"`; `DateTime` → `yyyy-MM-ddTHH:mm:ss.ffffff`
        **as stored**; `bool` → `"1"`/`"0"`; `NULL` → a sentinel that cannot occur; join columns with
        a unit separator (`\u001f`) so concatenation cannot create a false collision.
- [ ] Run integration and regression tests against Postgres.
- [ ] Compare results of critical queries and reports on both databases.
- [ ] Load-test and tune with `EXPLAIN ANALYZE`, then `VACUUM ANALYZE`.
- [ ] **Exercise the real application against the real migrated data**, not just SQL. This is the
      check that matters most; it is where a missed `ILIKE` shows up.
- [ ] Prove it is repeatable: drop the target (`dotnet ef database update 0`), re-apply, re-copy,
      re-verify. A migration that works once by accident is not a migration.

> ### The trap that wastes the most time: uuid ordering
> SQL Server orders `uniqueidentifier` by its **last six bytes**; PostgreSQL orders `uuid`
> **bytewise**. `ORDER BY Id` therefore returns the same rows in a **different order**, and a naive
> row-by-row comparison reports mismatches that do not exist. This hit six tables in CesarBarbosa.
> Order by the canonical **text** form on both sides.

> ### The trap that looks like data corruption but is not
> `InvalidCastException: Reading as 'System.Object' is not supported for fields having DataTypeName
> '-.-'`. `-.-` is not a real type — it is what a reader reports when Npgsql's per-connection type
> cache has been poisoned by an earlier reader on the **same connection** (a user-defined type such
> as `citext` then fails to resolve). **Give each phase its own connection**; phases are sequential,
> so there is nothing to share. The tell is the type name in the message: `citext` is a Postgres
> type, so seeing it on an allegedly "source" read means the target connection is involved.

---

## 7. Pipeline and Kubernetes

- [ ] Add the migration step. Prefer an **initContainer running `--auto`** over a one-shot Job: the
      Job is a step a human must remember and re-run, and it drifts from the revision being deployed.
- [ ] **Ship the tool inside the application image**, published to `/app/migrator`, rather than as a
      second image. Reasons, all of them learned the hard way:
      - A separate migrator image is a second revision that can drift from the code reading that
        schema.
      - The tool references the persistence project, which transitively pulls in
        `Microsoft.AspNetCore.Identity` — so it needs the **`Microsoft.AspNetCore.App`** shared
        framework. `mcr.microsoft.com/dotnet/runtime` does **not** contain it, and the container
        builds fine and then dies at startup. The app image already uses `aspnet`, so the problem
        disappears by construction.
      - Verify a container by **running** it, not just building it. This failure is invisible at
        build time.
- [ ] Use `--auto`, **never** `--truncate`, in an initContainer — it re-runs on every restart.
      `--auto` is backed by a **completion marker**, and the marker is the point:
      - empty + unmarked → migrate, verify, write marker
      - marked → skip (a restart costs seconds)
      - data present + unmarked → **refuse** (a run died; never serve a half-migrated database)

      "Does the target have data?" is the **wrong** guard: a copy that died halfway leaves some
      tables populated, so a data check would skip the rest and serve a half-migrated database. Make
      **every** verified copy write the marker, not just the automatic path — otherwise the
      documented recovery ("re-run with `--truncate`") appears to work and changes nothing.
- [ ] Make the change backward compatible (**expand/contract**) where the app is not being switched
      simultaneously.
- [ ] Put secrets and config in place: the new connection string **alongside** the old one, so the
      switch is a single key change at the end.
- [ ] If the namespace is Argo-managed with `selfHeal: true`, **every change is a git commit** —
      including the freeze. A live `kubectl edit` will appear to work and then silently revert.
- [ ] **Freeze the image updater, not just Argo.** If an Argo CD Image Updater watches your image,
      disabling Argo's `selfHeal` is only half the job: the updater still writes a new digest into
      your kustomization on `main`, and that digest deploys the instant automation returns — at a
      moment nobody chose. Suspend **both**, and restore them **together**. (Adding
      `workflow_dispatch` to CI lets you publish an image from a branch without merging, which is
      what lets you get the code in without the pod.)
- [ ] **Verify the deployed image actually contains the new provider — by RUNNING it.** See §9.
- [ ] Prepare the rollback plan (§8).
- [ ] Confirm `replicas` cannot become 2 during the switch: with `maxSurge: 1` two initContainers
      can race on one database. The marker prevents it — **do not silence the `--auto` refuse path.**

---

## 8. Cutover

- [ ] **Decide freeze vs. no-freeze, and write the trade down.** Both are legitimate; the choice
      depends on traffic and tolerance for silent loss.
      - **Stop the application (chosen for this programme's pilot).** Scale to zero, migrate, verify,
        start. Removes the data-loss window *by construction* — with nothing serving, nothing can
        write during the copy. Costs a known, bounded outage. Rollback is free until someone authors
        content in the new database.
      - **No freeze (initContainer + `--auto`).** True zero-downtime, but anything written during the
        copy plus the rollout is **silently lost**. Viable only for a low-write site, and only if you
        accept checking the highest-write table's row count afterwards.

      For a low-traffic site the outage is usually the better trade: the no-freeze path risks
      *silent data loss*, the outage costs minutes you can announce.
- [ ] Write the runbook with exact steps, owners and timing. Keep it **separate** from the
      how-it-works reference: a cutover has phases, a freeze and rollback decisions that do not
      belong in an explanation. ([`CUTOVER.md`](CUTOVER.md) is the worked example.)
- [ ] Create a **read-only source login** for the migrator. It only ever issues `SELECT`, so it
      should hold no more privilege than that. Beware `CHECK_POLICY = ON` rejecting a weak password:
      if `CREATE LOGIN` fails, later statements still "succeed" against a login that does not exist —
      always confirm the verification query returns a row.
- [ ] Dry-run on staging.
- [ ] Freeze writes, run the final sync, verify, switch.
- [ ] Verify **no active writers** before the final sync. The clean rollback story only holds if you
      actually froze.
- [ ] **Check the count of the highest-write table afterwards** (comments, events, logs). With no
      freeze, anything written during the window is lost. Choosing that trade is fine; *not knowing*
      it happened is not.
- [ ] Reset the migrated admin password **before** the switch. A migrated `PasswordHash` is intact
      but the production password is unknown, so login legitimately returns 401 —
      **do not conclude the migration failed because login fails.** Distinguish "hash corrupt" from
      "password unknown" by testing candidates with `PasswordHasher<object>()`. Leaving this until
      after the switch turns a known, harmless 401 into an apparent outage.
- [ ] Keep SQL Server **read-only** for a rollback window. Do not drop it as part of this work.
- [ ] Monitor errors, slow queries and connections after the switch.
- [ ] Browse the real site end to end, and **look at the images** — they come from the object store
      and should be unaffected, so a missing image means something unrelated has gone wrong.

### Rollback — state the data loss honestly

| Situation | Action | Data loss |
|---|---|---|
| Anything fails before the connection-string switch | none needed; the app still points at SQL Server | none |
| Final sync fails | re-point/replica back; site returns | none |
| Failure after the switch, **before** any content is authored | re-seal the old string | none |
| Failure after content **was** authored in Postgres | reverting loses it | the writes since the switch |

That last row is the real decision. Write it down before the cutover, not during it.

---

## 8b. What actually went wrong on the pilot — read this before project 2

These are not hypotheticals. Every one of them happened during the CesarBarbosa cutover, and most
cost real time. They are ordered by how much they cost.

### The one that took the site down: the deployed image was still the SQL Server build

**Symptom.** After the migration verified and the connection string was repointed, the app
crash-looped with:

```
System.ArgumentException: Keyword not supported: 'host'.
   at Microsoft.Data.SqlClient.SqlConnectionString..ctor(...)
   at Microsoft.EntityFrameworkCore.SqlServer.Storage.Internal.SqlServerConnection.CreateDbConnection()
```

**Diagnosis.** This looks like a bad connection string. It is not. Read the **types in the stack**:
`Microsoft.EntityFrameworkCore.SqlServer.*`. The running binary was the **pre-migration, SQL
Server-only build**. It was handed a Postgres string, and `Microsoft.Data.SqlClient` does not know
the keyword `host`. The connection string was correct the whole time.

**Root cause.** The kustomization pinned the image by **digest**, not tag:

```yaml
images:
  - name: .../cesarbarbosa
    newTag: latest
    digest: sha256:d20eb68d...   # the OLD build
```

A digest pin is authoritative: even though the registry's `latest` had moved to the new Npgsql
build, the deployment kept running the pinned old one. And because Argo automation was suspended
for the cutover, nothing moved it.

**Two lessons, both general:**

1. **Never trust the tag; verify the digest you are about to run.** Before repointing the app,
   confirm the image the deployment resolves to actually contains the new provider:

   ```bash
   kubectl get deploy <app> -o jsonpath='{.spec.template.spec.containers[0].image}'
   # then RUN that exact image and look inside:
   ls /app | grep -i npgsql        # expect Npgsql.dll, Npgsql.EntityFrameworkCore.PostgreSQL.dll
   ls /app | grep -i sqlclient     # expect NOTHING
   ```

2. **A digest pin must be updated as part of the cutover, deliberately.** If your manifests pin by
   digest, the "deploy the new build" step is *editing the pin*, not merging code. Put it in the
   runbook as its own step with its own check, because CI publishing a new `latest` does **not**
   move a digest-pinned deployment.

> **The general trap:** in a GitOps setup the pipeline publishes an image, but a *pin* decides what
> runs. Those are two different acts. A cutover that only does the first looks complete and serves
> the old code.

### Settle the git/cluster mismatch BEFORE restoring automation

If you did the cutover with automation suspended and applied things by hand (as you must — see
below), the cluster is now **ahead of git**. Restoring Argo then syncs git's *old* state back over
the working cluster. In the pilot that would have redeployed the SQL Server build and crash-looped
the site a second time.

Before re-enabling automation, reconcile every manual change back into git:

```bash
# Compare what git says against what the cluster runs, for each manual change:
git show origin/main:<app>/kustomization.yaml | grep -A2 'name:'
kubectl get deploy <app> -o jsonpath='{.spec.template.spec.containers[0].image}'
git show origin/main:<app>/deployment.yaml | grep -E 'replicas:|DATABASE_MANAGE'
kubectl get deploy <app> -o jsonpath='replicas={.spec.replicas}'
```

Every difference is a change automation will revert. Commit them all, **then** restore.

### Suspending Argo alone does not freeze deployment

Covered in §7, repeated here because it is the single most surprising thing about this cluster:
disabling Argo's `selfHeal` leaves the **Image Updater** free to write a new digest into
`kustomization.yaml` on `main`. Both must be suspended, and both restored together.

### The Job's target secret did not exist

`POSTGRES_CONNECTION_STRING` was not in the SealedSecret — the role had been created by hand, so
nothing ever stored its password. The Job failed with `password authentication failed`, which looks
like a credential problem but was really "the key is absent, so the connection string is a
placeholder".

**Lesson:** grep the actual secret for every `secretKeyRef` your manifests use, before the window:

```bash
kubectl get secret <name> -o json | jq -r '.data | keys[]'
```

And note that a **hand-created database role has no stored password anywhere** — the connection
string must be built from a password you set yourself, and re-sealing it is a real step, not an
afterthought.

### `--verify-only` cannot run before the schema exists

A natural instinct is to dry-run first. The tool correctly refuses:

```
Schema: NOT READY - 1 migration(s) not applied (20240101000000_InitialPostgres). Run with --migrate first.
```

That guard is right, but it means the first run of a **fresh** target must be `--migrate --truncate`,
not `--verify-only`. Plan the ordering: schema first, then verification is meaningful.

### The read-only source login worked, and is worth the effort

A pleasant surprise worth repeating: `sqlserver-readonly-login.sql` had already been applied, the
login existed, and `--check-schema` passed against live production on the first try — 15 tables,
16 present including `__EFMigrationsHistory`, exactly as predicted. **The `--check-schema` step
before the window is what made the cutover itself uneventful.** Do it first; it is read-only and it
is cheap.

### Concrete timings from the pilot, for sizing

| Step | Actual |
|---|---|
| Data copy + verification (15 tables, 1,505 rows) | **7 seconds** |
| `--check-schema` against live production | seconds |
| The whole real work | dominated by the image problem, not the data |

For databases this size the migration itself is trivially fast. **The risk is entirely in the
plumbing** — images, digests, secrets, automation. Budget your attention accordingly.

---

## 9. After

- [ ] Backups, restore tests and alerts for the new database. **The SQL Server backup schedule no
      longer protects this data** — this is the most commonly forgotten step.
- [ ] Review autovacuum and connection pooling (PgBouncer if needed).
- [ ] Decommission SQL Server **only** after the rollback window, after a verified backup, and as its
      own deliberate change.
- [ ] **Remove the migration scaffolding — this is the step the original plan omitted.** Once
      production is live on Postgres and the rollback window has closed, remove what existed only to
      move data. Do it as one deliberate cleanup commit, and only when every item below is true:

      | Remove | Precondition |
      |---|---|
      | `mssql` service + `mssql-data` volume in `compose.yaml` | no local rehearsal needed |
      | `.backup/*.dacpac` | never a source of truth; delete as soon as the rehearsal is done |
      | `SQLSERVER_SOURCE_CONNECTION_STRING` secret key | cutover complete and verified |
      | initContainer / migration Job from the Deployment | marker confirmed; app is on Postgres |
      | the read-only SQL Server login | no further verification runs |
      | **the migrator itself** and the Dockerfile `/app/migrator` stage + its `restore`/`publish` steps | **all five projects migrated**, and no re-verification is planned |
      | `CesarBarbosaDB` renamed to a Postgres-shaped name | optional; keeping the old name avoids a second deployment change |

      **Do not remove the tool per-project.** It is shared (§1), so it is removed once, when the
      **programme** finishes — not when the first project does. Removing it after project 1 would
      mean rebuilding it for project 2, and the plan files are the only thing that should differ.
- [ ] Keep the app-side work **permanently**: `citext`, `pg_trgm`, `TextSearch`, the GIN indexes, the
      runtime provider selection. None of that is scaffolding — it is the application's configuration.

---

## 10. Programme-level checklist

Run this across all five, and do not let a project skip ahead of the shared decisions.

- [ ] §0 decisions made **once** and written down (tooling, conventions, collation policy, ordering).
- [ ] Shared tables / cross-database queries resolved **once**, before any project moves.
- [ ] Pilot (smallest / least critical) completed end to end, including its cutover.
- [ ] One shared migrator tool; **one plan file per project**; no copies of the engine.
- [ ] `--check-schema` green against each project's live database before its cutover.
- [ ] Per project: assessed, schema reviewed by hand, app fixed, data verified by digest, cutover
      rehearsed, rollback stated in writing.
- [ ] Post-cutover: each database added to the backup schedule before its SQL Server is decommissioned.
- [ ] Scaffolding removed **once at programme end**, not per project.

---

## What is genuinely project-specific

Keep this list short — if a project needs more than this, the tool has the wrong seam.

1. **The plan** — table and column map (`MigrationPlan.cs` equivalent), in dependency order.
2. **Key columns** — which columns make a row unique, for the verification digest.
3. **Excluded tables** — identity/auth/audit tables the new schema does not carry.
4. **Connection defaults** — via environment variables, never hardcoded in code.
5. **The app env var name** — `CesarBarbosaDB`, `EasyFinanceDB`, …

Everything else in this document is shared, and should be built once.
