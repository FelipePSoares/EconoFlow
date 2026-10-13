# PostgreSQL migration — EconoFlow

EconoFlow is the next project in this programme: **SQL Server → PostgreSQL**. Same
procedure, same tooling, same shared engine. These documents are the pack that has now
carried **three** projects through it successfully:

| Project | Shape | Status |
|---|---|---|
| CesarBarbosa (pilot) | single schema | **cutover complete** |
| WhiteLabel / BFS + Gelosorio | **two schemas, two contexts** | **cutover complete** (both sites) |
| Move | single schema, single context | **cutover complete** (2026-10-12) |
| **EconoFlow** | **to be determined — see below** | not started |

> **This pack has never migrated EconoFlow.** Nothing here was written with EconoFlow's
> schema in mind. The procedure is proven; the project-specific facts are not yet known.

---

## Read in this order

1. **`CUTOVER_LESSONS.md`** — **start here.** What actually happened on live clusters,
   three times, and the things that bit us. Every step in its checklist earned its place
   by something going wrong. §8 is Move's cutover, the most recent and the most detailed.
   It also lists what was **not** a bug, so you do not chase those.
2. **`MIGRATION_TEMPLATE.md`** — the generic per-project order of work. This is your
   checklist; work it top to bottom.
3. **`DATABASE_MIGRATION.md`** — how the engine works and the pitfalls in depth. Part 3
   is the reusable audit list.
4. **`MOVE_CUTOVER.md`** — the **most recent completed example**, and the closest in
   tooling: one migration host driven by the shared NuGet package (1.1.3+). §5 documents
   an engine bug Move found and had fixed. §7.2 documents the one thing that went wrong
   live, which is the highest-value page in the pack.
5. **`WHITELABEL_NOTES.md`** — the worked example for a **multi-schema, multi-context**
   project. Read this one specifically if EconoFlow turns out to have more than one
   `DbContext`, because that is the case it covers.
6. **`DATETIME_KIND_TRAP.md`** — the **app-side** half of `DateTime` handling, which the
   engine docs do not cover. WhiteLabel passed every data check and then failed in
   production on the first sale registered. EconoFlow is currently in good shape here (§3),
   but read §1 and add the regression test in §5 — it is the one item that keeps it that way.
7. `CUTOVER.md`, `CUTOVER_PREFLIGHT.md`, `DEPLOY.md` — operational runbooks from the
   pilot. Their **ordering** advice is the valuable part; the site-specific commands are not.

---

## What is already done for you

The shared engine **`fpssoftware.datamigration`** is published to the private Gitea NuGet
feed. **Use version 1.1.3 or later.**

| Version | What was broken |
|---|---|
| 1.0.0 | Could not address a non-default schema at all |
| 1.1.0 | Schema quoting fixed for the COPY statements |
| 1.1.1 | Catalog reader returned bare table names; `--check-schema` false-negatived |
| 1.1.2 | 1.1.1 broke plans that spell tables bare |
| **1.1.3** | **`DateOnly` was not normalised in the verification digest, so a SQL Server `date` column could never verify.** Found by Move. |

**1.1.3 is a floor, not a preference.** If EconoFlow has any `date` column (very likely for
a finance application — transaction dates, due dates, period boundaries), 1.1.2 will report
a `MISMATCH` for data that is byte-identical, and no plan can work around it: a column's
declared `NpgsqlDbType` governs only the binary COPY **write**, while verification reads raw
CLR values.

You supply, per `MIGRATION_TEMPLATE.md`:

1. **The plan** — table/column map per context, in dependency order.
2. **Key columns** — which columns make a row unique, for the verification digest.
3. **Excluded tables** — identity/audit tables the new schema does not carry.
4. **Connection defaults** — via environment variables, never hardcoded.
5. **The app env var name** — the connection-string key the deployment already sets.

And **one migration host per `DbContext`** — the engine migrates exactly one context per
profile. If EconoFlow has two contexts, it needs two hosts, exactly as WhiteLabel did.

---

## Start here: decide EconoFlow's shape before writing anything

The first question is not "what is the plan" — it is **"which of the three completed
projects does EconoFlow resemble?"** The answer changes the size of the job.

Establish these facts **first**, because each one selects a different documented path:

| Question | If yes | If no |
|---|---|---|
| Does the solution have **more than one `DbContext`**? | One migration host **per context**; WhiteLabel's shape. `--check-schema` per host. | One host, Move's shape. |
| Does it use a **non-default schema** (`Admin`, etc.)? | `CUTOVER_LESSONS.md` §4 and §5 apply directly — and note that **an ambiguity check is mandatory**, because same-named tables in two schemas can silently resolve to the wrong one and still report `MIGRATION VERIFIED`. | Simpler; the 1.1.x schema fixes are not load-bearing. |
| Is there a **second context for Data Protection keys**? | Its migration history is separate. `MyKeys` **must have its own history table** and its own host. | — |
| Are there **`date` columns** (not `datetime`)? | **Requires engine 1.1.3.** Chart-of-accounts periods, statement dates and due dates are the usual suspects. | — |
| Is the object store **shared and already populated**? | Images/attachments are **not** in a schema dump and are not moved by this migration. Confirm the bucket and the key format before planning. | — |

> **The two things that cost the most time on previous projects were not data problems.**
> They were: (1) a **digest pin** that decided the image actually deployed, and
> (2) **secrets** that were absent or mis-keyed. Budget your attention there, not on the
> copy — Move's 216 rows copied in **9 seconds**.

---

## Two hard rules, learned the expensive way

**Never rehearse against `localhost:5432`.** On a workstation that port is often a cluster
port-forward, so it reaches **production**, not your local container. This copied 24,532
rows into a live database while reporting `MIGRATION VERIFIED`. Publish the rehearsal
PostgreSQL on **5433** and prove which database you are talking to before every run —
`CUTOVER_LESSONS.md` §2.1 has the exact commands.

**Rehearse against a copy of the real database.** An empty test database cannot find
schema problems: BFS had zero rows in its second schema and passed every check, while
Gelosorio's 24,532 rows exposed three separate engine bugs. Likewise Move's `DateOnly` bug
was invisible to an empty database. Take a `.dacpac` (or equivalent) snapshot before you
start, and treat it as a **rehearsal convenience only** — never as the source of truth.
The live catalog is the contract.
