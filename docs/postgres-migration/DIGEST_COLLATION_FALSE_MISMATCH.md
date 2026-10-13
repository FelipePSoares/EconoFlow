# Verification digest vs. collation — a false MISMATCH

**Status: FIXED in engine 1.1.4.** Diagnosed, root-caused, reproduced, and fixed in the
shared package. EconoFlow now reports `MIGRATION VERIFIED` for all 23 tables.

**Symptom (before the fix).** `--migrate` reported

```
AspNetUserTokens   21   21   bbd956a34b3ac5ba / 28587b63a85a76cf   MISMATCH
MIGRATION FAILED: 1 table(s) mismatched, 0 error(s).
```

The data was **not** wrong. 22 of 23 tables verified `ok`.

---

## 1. It is not a copy problem — proved independently

Read through .NET (no `sqlcmd`, no truncation) and compared every row:

| Check | Result |
|---|---|
| Row count | 21 = 21 |
| Keys only in source | **0** |
| Keys only in target | **0** |
| Values differing | **0** |

`RESULT: IDENTICAL - the data is faithfully copied; the MISMATCH is a verifier artefact`

> `sqlcmd` truncates column output at **256 characters**. That manufactured 17 phantom
> "value differences" on first inspection and cost real time. Do not diagnose this
> class of problem through `sqlcmd`; read the tables through a driver.

## 2. Root cause: the digest is collation-dependent

The verifier hashes each table's rows **in the order its `ORDER BY` returns them**.
That `ORDER BY` is built by `Verifier.BuildOrderBy`, which emits the plan's
`KeyColumns` more or less literally — text columns unmodified:

```
source ORDER BY: "LoginProvider", "Name", CONVERT(varchar(36), "UserId")
target ORDER BY: "LoginProvider", "Name", "UserId"::text
```

The two engines therefore sort the **same rows into a different sequence**:

| Value | SQL Server (`_CI_AS`) | PostgreSQL (`LC_COLLATE 'C'`) |
|---|---|---|
| `[AspNetUserStore]` vs `REFRESHTOKENPROVIDER` | `[` sorts **before** letters | `[` is ASCII 91 → sorts **after** `R` |
| `healthcare` vs `REFRESHTOKENPROVIDER` | case-**insensitive** → `healthcare` first | case-**sensitive** → `R` (82) before `h` (104) |

Measured on the rehearsal:

```
SQL Server order : [AspNetUserStore]  <  REFRESHTOKENPROVIDER
PostgreSQL order : REFRESHTOKENPROVIDER  <  [AspNetUserStore]
```

Same rows, same values, different order → different SHA-256 → `MISMATCH`.

The digest inputs are byte-length identical (**5891 = 5891**) and differ only in
sequence, which is the signature of an ordering difference rather than data loss.

## 3. Scope

Any table whose `KeyColumns` include a **text** column is affected, whenever its
values differ by case or leading punctuation. In this schema that is exactly:

| Table | Key columns | State |
|---|---|---|
| `AspNetUserTokens` | `LoginProvider`, `Name`, `UserId` | **fails** (21 rows) |
| `AspNetUserLogins` | `LoginProvider`, `ProviderKey` | passes **vacuously** — 0 rows |

Every other table keys on `Id`, a UUID, which is collation-independent.

> `AspNetUserLogins` will start failing the moment it has data.

## 4. What was ruled out

| Hypothesis | Why it is not the cause |
|---|---|
| Data corruption | Values compare identical through a driver |
| Value normalisation | `ReadValue`/`Normalise` produce identical output on both sides |
| UUID ordering (`uniqueidentifier` vs `uuid`) | The engine already casts to text on both sides |
| Column type in the plan | `Text`/`Varchar`/`Citext` all produce the same `ORDER BY` |
| `KeyColumns` ordering | The engine **reorders keys itself** — `BuildOrderBy` puts text first regardless of the order declared in the plan |

That last one is worth recording: an earlier attempt "fixed" this by reordering
`KeyColumns`, which had **no effect at all**. The change was reverted.

## 5. The fix (shipped in engine 1.1.4)

Order text key columns by their **raw bytes**, which no collation affects:

```sql
-- source
CAST("LoginProvider" AS varbinary(max))
-- target
convert_to("LoginProvider", 'UTF8')
```

Scoped to character types only (`Text`, `Varchar`, `Char`, `Citext`, `Name`).
Numeric, boolean, date and uuid keys already sort identically on both engines — and
casting those to bytes is not even expressible on the target, since
`convert_to(integer, 'UTF8')` does not exist. An initial version of the fix applied the
cast to every key column and failed on `DataProtectionKeys.Id`; the scoping was added
because of that failure.

The package is `fpssoftware.datamigration` **1.1.4**, in the pilot repository
(`FelipePSoares/CesarBarbosa`), commit `96b7332`. That is where the engine lives — the
package is published from there, and EconoFlow only consumes it. This is why the fix
could not be made locally in EconoFlow.

### Verification

| Check | Result |
|---|---|
| `--migrate --truncate` | **MIGRATION VERIFIED**, 23/23 tables `ok` |
| Repeatable from a dropped schema | yes — dropped both migration histories, re-applied, re-copied, re-verified |
| Packaged engine (not just a local build) | `ProductVersion 1.1.4+96b7332`, verified |
| Independent row-count check (no engine involved) | 23/23 tables, 5,203 rows |
| `citext` on the migrated data | `'HEALTH INSURANCE'` still finds the row stored as `Health Insurance` |

### An alternative considered and rejected

Hashing rows as a **set** (sorting the normalised row strings before hashing) also
removes the dependency, and is arguably more correct still — no engine guarantees
physical row order, and a parallel scan can change it. It was tested and it worked:

| Table | Rows | In returned order | Sorted-set |
|---|---|---|---|
| `AspNetUserTokens` | 21 | MISMATCH | match |
| `AspNetUserLogins` | 0 | match | match |

It was also confirmed not to be a weaker check — tampering with one `Value` still
changed the digest, and restoring it restored the digest. It is left as a note rather
than the shipped fix because the byte-ordering change is smaller and keeps the digest
comparable with earlier runs; the set-hash would change every digest in the programme.

## 6. Scope

Any table whose `KeyColumns` include a **text** column was affected, whenever its values
differ by case or leading punctuation:

| Table | Key columns | Before 1.1.4 | After |
|---|---|---|---|
| `AspNetUserTokens` | `LoginProvider`, `Name`, `UserId` | **fails** (21 rows) | ok |
| `AspNetUserLogins` | `LoginProvider`, `ProviderKey` | passed **vacuously** (0 rows) | ok |

`AspNetUserLogins` would have started failing the moment it had data. Every other table
keys on `Id`, a UUID.

## 7. Wider lesson for this programme

Any project whose schema has a text key column can hit this, and the failure mode is
the worst kind: a red gate on correct data, during a cutover window, when the operator
has least time to investigate. Two habits prevent the wasted effort:

1. **Never diagnose a digest mismatch through `sqlcmd`.** It truncates column output at
   256 characters, which manufactured 17 phantom "value differences" here and cost real
   time. Read both tables through a driver and compare row-by-row.
2. **Compare concatenation LENGTHS first.** Identical lengths that differ in content is
   the signature of an ordering difference; different lengths means real data loss.
   `5891 = 5891` and "differs at char 0" pointed straight at ordering.

## 8. Reproducing

```powershell
# source: SQL Server on 14330 loaded from .backup/dump.dacpac
# target: postgres:18-alpine on 5433, database econoflow (LC_COLLATE 'C')
dotnet run --project tools/EconoFlow.DataMigration -- --migrate --truncate
# with engine 1.1.3 -> AspNetUserTokens ... MISMATCH
# with engine 1.1.4 -> MIGRATION VERIFIED
```
