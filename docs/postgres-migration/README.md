# PostgreSQL migration — EconoFlow

EconoFlow is **complete**: SQL Server → PostgreSQL. Same procedure, same tooling, same
shared engine. These documents are the pack that has now carried **four** projects
through it successfully:

| Project | Shape | Status |
|---|---|---|
| CesarBarbosa (pilot) | single schema | **cutover complete** |
| WhiteLabel / BFS + Gelosorio | **two schemas, two contexts** | **cutover complete** (both sites) |
| Move | single schema, single context | **cutover complete** (2026-10-12) |
| **EconoFlow** | **two contexts, one schema** | **cutover complete** (2026-10-14) |

EconoFlow's full record is [`ECONOFLOW_PREFLIGHT.md`](ECONOFLOW_PREFLIGHT.md), and the
programme-level lessons it added are `CUTOVER_LESSONS.md` **§9**.

> **The headline for the next project is in §9.1.** EconoFlow's copy took **8 seconds**,
> exactly like every project before it. Its *outage* took **50 minutes**, and every minute
> was the same mistake: rehearsal used `dotnet ef` and the migration tool, while production
> runs the application. Three separate start-up defects were invisible to both.
>
> **Rehearse by starting the application against a real PostgreSQL.** Not the tooling
> around it. That one command would have caught all three.

---

## Read in this order

1. **`CUTOVER_LESSONS.md`** — **start here.** What actually happened on live clusters, four
   times, and the things that bit us. Every step in its checklist earned its place by
   something going wrong. **§9 is EconoFlow** — the most recent and the most relevant,
   because its failures were in the *application* rather than the plumbing. It also lists
   what was **not** a bug, so you do not chase those.
2. **`MIGRATION_TEMPLATE.md`** — the generic per-project order of work. This is your
   checklist; work it top to bottom.
3. **`DATABASE_MIGRATION.md`** — how the engine works and the pitfalls in depth. Part 3
   is the reusable audit list.
4. **`ECONOFLOW_PREFLIGHT.md`** — the **most recent completed example**. Documents the
   two-context shape, and §9.1–§9.3 of the lessons expand its three production defects.
5. **`WHITELABEL_NOTES.md`** — the worked example for a **multi-schema** project. Read
   this if the project has more than one schema; EconoFlow had two contexts but a single
   schema, which is a different (and simpler) case.
6. **`DATETIME_KIND_TRAP.md`** — the **app-side** half of `DateTime` handling, which the
   engine docs do not cover. WhiteLabel passed every data check and then failed in
   production on the first sale registered. EconoFlow needed the same coercion on all 38
   `TimestampTz` columns.
7. `CUTOVER.md`, `CUTOVER_PREFLIGHT.md`, `DEPLOY.md` — operational runbooks from the
   pilot. Their **ordering** advice is the valuable part; the site-specific commands are not.

---

## What is already done for you

The shared engine **`fpssoftware.datamigration`** is published to the private Gitea NuGet
feed. **Use version 1.1.4 or later.**

| Version | What was broken |
|---|---|
| 1.0.0 | Could not address a non-default schema at all |
| 1.1.0 | Schema quoting fixed for the COPY statements |
| 1.1.1 | Catalog reader returned bare table names; `--check-schema` false-negatived |
| 1.1.2 | 1.1.1 broke plans that spell tables bare |
| 1.1.3 | **`DateOnly` was not normalised in the verification digest.** Found by Move. |
| **1.1.4** | **Verification hashed rows in engine-returned order, so text key columns compared by collation.** Found by EconoFlow. |

**1.1.4 is a floor, not a preference.** If the project has any text column in a key — an
Identity `ProviderKey`, a login provider name, a token name — a `_CI_AS` source and a `C`
target order those rows differently, and 1.1.3 reports a `MISMATCH` for data that is
byte-identical. See [`DIGEST_COLLATION_FALSE_MISMATCH.md`](DIGEST_COLLATION_FALSE_MISMATCH.md)
for the full diagnosis; the fix orders **textual** keys by their binary encoding and leaves
non-text keys alone (`convert_to(integer, 'UTF8')` is an error, not a fallback).

You supply, per `MIGRATION_TEMPLATE.md`:

1. **The plan** — table/column map per context, in dependency order.
2. **Key columns** — which columns make a row unique, for the verification digest.
3. **Excluded tables** — identity/audit tables the new schema does not carry.
4. **Connection defaults** — via environment variables, never hardcoded.
5. **The app env var name** — the connection-string key the deployment already sets.

And **one migration host per `DbContext`** — the engine migrates exactly one context per
profile. EconoFlow has two, and the second one's schema had to be applied explicitly from
`CreateContext`; the symptom of forgetting is `42P01: relation "DataProtectionKeys" does
not exist` **at copy time**, after the schema step has already reported success.
`CUTOVER_LESSONS.md` §9.2 covers the shape.

---

## Start here: decide the project's shape before writing anything

The first question is not "what is the plan" — it is **"which of the four completed
projects does this resemble?"** The answer changes the size of the job.

Establish these facts **first**, because each one selects a different documented path:

| Question | If yes | If no |
|---|---|---|
| Does the solution have **more than one `DbContext`**? | One migration host per context, **and** apply the non-engine contexts from `CreateContext`. `--check-schema` per host. | One host, Move's shape. |
| Does it use a **non-default schema** (`Admin`, etc.)? | `CUTOVER_LESSONS.md` §4 and §5 apply — and **an ambiguity check is mandatory**, because same-named tables in two schemas can silently resolve to the wrong one and still report `MIGRATION VERIFIED`. | Simpler; the 1.1.x schema fixes are not load-bearing. |
| Is there a **second context for Data Protection keys**? | Its migration is separate and the engine will **not** apply it. The key ring must move, or every signed-in user is logged out at cutover. | — |
| Is the provider selected at **runtime** rather than compile time? | Three wirings must agree, not one: provider, **`MigrationsAssembly` in the runtime registration**, and a `ProjectReference` so the assembly ships in the image. `CUTOVER_LESSONS.md` §9.3. | — |
| Are there **`date` columns** (not `datetime`)? | **Requires engine 1.1.3.** | — |
| Is the object store **shared and already populated**? | Images/attachments are **not** in a schema dump and are not moved by this migration. Confirm the bucket and the key format before planning. | — |

> **What cost the most time, across four projects, was never the data.**
> It was (1) a **digest pin** that decided which image actually deployed, (2) **secrets**
> that were absent or mis-keyed, and now (3) the **application's own start-up path**.
> Budget attention there. EconoFlow's 5,242 rows copied in **8 seconds**.

---

## Two hard rules, learned the expensive way

**Never rehearse against `localhost:5432`.** On a workstation that port is often a cluster
port-forward, so it reaches **production**, not your local container. This copied 24,532
rows into a live database while reporting `MIGRATION VERIFIED`. Publish the rehearsal
PostgreSQL on **5433** and prove which database you are talking to before every run —
`CUTOVER_LESSONS.md` §2.1 has the exact commands.

**Rehearse by starting the APPLICATION, against a real database.** This is new in §9.1 and
it is now the single highest-value rehearsal step. A `.dacpac`-backed copy proves the
*engine* works; it proves nothing about the runtime wiring, because `dotnet ef` and the
migration tool set options the application does not. EconoFlow's three production defects
were all in that difference.

Take a `.dacpac` (or equivalent) snapshot before you start, and treat it as a **rehearsal
convenience only** — never as the source of truth. The live catalog is the contract.

