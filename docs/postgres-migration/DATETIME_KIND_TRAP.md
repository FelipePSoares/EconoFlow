# The `DateTime.Kind` trap — the app-side half of it

**Audience:** whoever migrates EconoFlow to PostgreSQL.
**Status:** a pre-emptive finding, not a bug report against EconoFlow.

The rest of this pack covers `DateTime` handling **from the migration engine's side** —
copying legacy rows across, where the engine forces `SpecifyKind(v, Utc)` on write
(`DATABASE_MIGRATION.md` §3.3, `MIGRATION_TEMPLATE.md`, `ECONOFLOW_PREFLIGHT.md`). That
guidance is correct and it is not what this file is about.

This file is about the **application's own running code**, which is a separate surface and
which no amount of engine correctness protects. WhiteLabel's cutover passed every data check
and then failed in production on the first sale registered, because of one line of app code
that the migration engine never touches. Verified live, reproduced, and fixed — see §4.

---

## 1. The failure, in one line

Npgsql 6+ maps CLR `DateTime` to PostgreSQL `timestamp with time zone`, and that type
accepts **only** `DateTimeKind.Utc`:

```
System.ArgumentException: Cannot write DateTime with Kind=Unspecified to PostgreSQL type
'timestamp with time zone', only UTC is supported.
```

`DateTime.Now` (Kind=**Local**) and `DateTime.Today` (Kind=**Unspecified**) are both
rejected. SQL Server's `datetime`/`datetime2` accept all three Kinds silently, so this class
of defect is **invisible until the provider changes** — and then it appears at runtime, on
whichever code path happens to touch a timestamp column first.

Two properties make it nasty out of proportion to its size:

1. **It fires on reads as well as writes.** WhiteLabel's crash was in a `SELECT EXISTS`
   guard that compared `o.CreatedDate > DateTime.Now.AddMinutes(-2)`. A parameter in a
   `WHERE` clause is still a parameter Npgsql must serialize.
2. **It is usually swallowed.** WhiteLabel's page had a `try/catch (Exception)` that logged
   the real message server-side and showed the user *"Erro ao tentar inserir, por favor tente
   novamente!"* — so the symptom in the UI looked like a generic insert failure, and the
   actual cause was only visible in the pod logs.

### The grep that finds it, and the grep that does not

```powershell
# Catches the direct calls.
rg -n "DateTime\.(Now|Today)" --glob '*.cs'

# ALSO check for a clock abstraction that may or may not be UTC-safe.
rg -n "SystemClock|TimeProvider|IClock|ISystemClock" --glob '*.cs'
```

Then confirm the **Kind**, not just the method name. A helper is only UTC-safe if it
returns a UTC-Kind value:

```csharp
provider.GetUtcNow().UtcDateTime      // Kind=Utc      OK
provider.GetUtcNow().UtcDateTime.Date // Kind=Utc      OK  (Date PRESERVES Kind)
DateTime.SpecifyKind(x.Date, DateTimeKind.Utc)             // OK
DateTime.Now                                               // Kind=Local    REJECTED
DateTime.Today                                             // Kind=Unspecified REJECTED
DateOnly.FromDateTime(...)                                 // maps to `date`, safe
```

> **A trap worth stating explicitly:** it is tempting to assume `.Date` strips the Kind down
> to `Unspecified`. It does **not** — `DateTime.Date` preserves `Kind`. This was checked by
> running it, not by reading the docs:
>
> ```
> UtcNow.UtcDateTime.Date -> Kind=Utc   IsUtc=True
> ```
>
> This matters because it means the `.UtcNow.UtcDateTime.Date` idiom — used by both Move and
> EconoFlow for "today" — is genuinely safe and does **not** need changing. Do not "fix" it.

---

## 2. What the two completed projects did — copy from these

Both are already clean. Neither has produced this error in production (verified: zero
occurrences of `Cannot write DateTime` in either project's logs, 30-day window).

### Move — the pattern to copy

`Move/Move.Domain/Shared/SystemClock.cs` is a swappable clock whose "today" is UTC:

```csharp
public static DateTime UtcNowDateTime => provider.GetUtcNow().UtcDateTime;
public static DateTime Today => provider.GetUtcNow().UtcDateTime.Date;   // Kind=Utc
public static DateOnly TodayDate => DateOnly.FromDateTime(provider.GetUtcNow().UtcDateTime);
```

Every timestamp in `Move.Domain` defaults from it (`BaseEntity.CreatedDate`,
`MoveMember.SentAt`, `BoxImage.UploadedAt`), and `UnitOfWork` uses
`SystemClock.UtcNowDateTime` for its audit stamps. There is **no** raw `DateTime.Now` or
`DateTime.Today` anywhere in `Move.Domain` or `Move.Persistence`, and no model-bound
`DateTime` arrives over HTTP — so no Kind=Unspecified value can reach a
`timestamp with time zone` column.

### CesarBarbosa — the belt-and-braces layer

Same idea, plus a coercion at the **migration** boundary that normalises on the way across
(`tools/CesarBarbosa.DataMigration/MigrationPlan.cs`):

```csharp
private static ColumnPlan Timestamp(string name)
    => new(name, name, NpgsqlDbType.TimestampTz,
           Coerce: value => value switch
           {
               DateTime dateTime => DateTime.SpecifyKind(dateTime, DateTimeKind.Utc),
               DateTimeOffset offset => offset.UtcDateTime,
               _ => value,
           });
```

The only `DateTimeKind.Local` values in the whole repository are in
`DevelopmentDataSeeder.cs`, which `Program.cs:215` guards so it runs **only** against the
in-memory store (`if (!database.IsRelational || DevelopmentDataSeeder.IsForced)`) — so they
can never reach PostgreSQL. Worth copying that guard's *shape* if EconoFlow has a seeder.

---

## 3. EconoFlow's position today: **structurally the safest of the three**

This was checked against the source, not assumed. EconoFlow is in materially better shape
than WhiteLabel was.

| Surface | EconoFlow | Verdict |
|---|---|---|
| Clock abstraction | `SystemClock.UtcNowDateTime` / `.TodayDate`, same as Move | **Safe** |
| Raw `DateTime.Now` / `DateTime.Today` | **zero occurrences** in the solution | **Safe** |
| Audit stamps | `BaseEntity` defaults from `SystemClock`; `UnitOfWork:72` uses `SystemClock.UtcNowDateTime` | **Safe** |
| Financial dates (`Date`) | **already `DateOnly`** → Postgres `date` | **Safe — see below** |
| `ExpiresAt` (Notification) | `DateOnly?`, compared to `SystemClock.TodayDate` | **Safe** (types match) |
| `EmailLockedUntil` | `DateTime?` set from `SystemClock.UtcNowDateTime` | **Safe** |
| `DateTimeOffset.Now` in `AccessControlController` (×2) | cookie `Expires` only — never persisted | **Not a migration risk** |
| Dev seeder | `DevelopmentTestDataSeeder.cs`, uses `SystemClock.TodayDate` | **Safe** |

### The `DateOnly` point is the single biggest reason this may be a non-event

Migration `20250206230206_RemovedTimezoneProperty` already converted `Incomes.Date`,
`Expenses.Date` and `ExpenseItems.Date` **from `datetime2` to `DateOnly`** (Postgres `date`).
That is exactly the "calendar date is not an instant" distinction that WhiteLabel had to
bolt on afterwards — EconoFlow made the correct modelling choice years earlier.

Consequences worth knowing before you plan:

- `date` columns carry **no Kind and no offset**, so this entire class of bug cannot occur on
  them. The `Notification.ExpiresAt > SystemClock.TodayDate` query filter is comparing
  `DateOnly` to `DateOnly` and is fine.
- But `date` columns are precisely what makes **engine 1.1.3 mandatory** — see `README.md`.
  Financial period boundaries, statement dates and due dates are the usual `date` suspects,
  and EconoFlow is a finance app, so expect several.

### The one thing that will still bite

`DateTime` audit columns (`CreatedDate`, `ModifiedAt`, `ExpiresAt`'s neighbours,
`EmailLockedUntil`, `SentAt`, `AcceptedAt`, `RevokedAt`, `LastUsedAt`) become
`timestamp with time zone`. They are safe **today only because every writer goes through
`SystemClock`**. So the real risk is not the migration — it is **regression**:

> Anyone who later writes `DateTime.Now` or `DateTime.Today` next to one of these columns
> reintroduces the WhiteLabel bug, and it will surface at runtime on a live site, not at
> build time.

Guard this with a test rather than discipline. A cheap architectural test — scan the
solution's source for `DateTime\.(Now|Today)` outside test projects and fail the build —
costs a few minutes and removes the entire class of defect permanently. CesarBarbosa's
`Coerce` on the migration side is the other half of the same idea.

---

## 4. If it does happen: how to diagnose and fix it

### Diagnose

The error names the Kind and the type, so the message is self-explanatory once you find it.
What hides it is the catching. Two things to do:

```powershell
# 1. Grep the pod logs for the real message rather than trusting the UI.
kubectl logs -n <ns> deploy/<app> --since=48h | Select-String "Cannot write DateTime"

# 2. The EF-wrapped form names the ActionName and RequestPath — that is your call site.
#    Look for: "An exception occurred while iterating over the results of a query"
#    and the "Failed executing DbCommand" line just above it, which prints the SQL and
#    the parameter list with the DbType of each parameter.
```

The `Failed executing DbCommand` line is the most useful artefact: it shows the exact SQL
and which parameters were bound. In WhiteLabel's case it was unambiguous:

```
SELECT EXISTS (SELECT 1 FROM "Admin"."Orders" AS o
  WHERE o."Date" = @order_Date AND o."ClientId" = @order_ClientId
    AND o."CreatedDate" > @filterDateTime)
```

### Fix — and the decision that matters

`AppContext.SetSwitch("Npgsql.EnableLegacyTimestampBehavior", true)` restores the pre-Npgsql-6
behaviour and makes the error go away **everywhere at once**. It was deliberately **not**
chosen for WhiteLabel, and the reason generalises:

> **A blind `UtcNow` swap is not the fix either.** WhiteLabel's `Date` columns held a
> *calendar day*, and existing rows stored it as the **local** wall-clock reading
> (`2026-10-09 01:00:00+01` for a date entered as 9 October). Replacing `DateTime.Today` with
> `DateTime.UtcNow` would have shifted every stored date by the offset and silently broken
> the `o.Date == order.Date` duplicate check — turning a loud crash into quiet data
> corruption. The working fix preserved the **day component** and normalised only the Kind:

```csharp
public static DateTime ToUtcCalendarDate(this DateTime date)
    => DateTime.SpecifyKind(date.Date, DateTimeKind.Utc);

public static DateTime UtcToday
    => DateTime.SpecifyKind(DateTime.UtcNow.Date, DateTimeKind.Utc);
```

Classify each column first — **instant** (audit, expiry, lock) vs **calendar date** (period,
transaction, due) — then apply `UtcNow` to the first and day-preserving normalisation to the
second. Getting this backwards is worse than the original bug, because it does not throw.

EconoFlow has already made this classification correctly via `DateOnly`, which is why the
expectation here is a **regression test**, not a fix.

### Verify by running, not by reading

Do not accept "the Kind is right now" from inspection. WhiteLabel's fix was confirmed against
a real PostgreSQL instance carrying the production schema, the production `TimeZone`
(`Europe/Lisbon`) and a production-shaped row:

- pre-fix predicate → reproduced the original `ArgumentException`;
- post-fix predicate → accepted, and the stored day round-tripped **unchanged**;
- duplicate guard → `False` for an old row, `True` immediately after an insert.

That last pair is the part a compile-and-hope check would have missed. If EconoFlow's
migration touches any timestamp comparison, reproduce it against a copy of real data before
the cutover window — see the rehearsal rules in `README.md`.

---

## 5. Checklist for EconoFlow

- [ ] Run the two greps in §1 and record the output. Confirm **zero** raw
      `DateTime.Now` / `DateTime.Today` in non-test projects.
- [ ] Confirm every `SystemClock`-style helper returns a **UTC-Kind** value. Verify by
      running, not by reading — see the `.Date` trap in §1.
- [ ] List every `DateTime` column that will become `timestamp with time zone`. For each,
      write down **instant** or **calendar date**. Do not skip this; it is the decision that
      WhiteLabel got wrong and that EconoFlow has already got right.
- [ ] Confirm the `DateOnly` → `date` columns stay `DateOnly`. If anyone "modernises" them
      back to `DateTime`, the trap returns immediately.
- [ ] Confirm the seeder cannot reach a relational database (copy CesarBarbosa's
      `if (!database.IsRelational || ...)` guard shape).
- [ ] Confirm the health check does not open a raw connection that could hide a Kind problem
      (`ECONOFLOW_PREFLIGHT.md` Q7 already flags a SQL Server-tied health check).
- [ ] **Add the architectural test** that fails the build on `DateTime\.(Now|Today)` outside
      test projects. This is the only item here that prevents future regressions, and it is
      the reason this file exists.
- [ ] Include a timestamp-comparing query in the post-cutover smoke test — ideally a
      create-then-reject-duplicate path, since that is the shape that caught WhiteLabel.

---

## 6. Related material

- `DATABASE_MIGRATION.md` §3.3 — precision and Kind **on the engine/copy side**.
- `MIGRATION_TEMPLATE.md` — the `DateTime` checklist item, and why never to call
  `ToUniversalTime()` on legacy values.
- `CUTOVER_LESSONS.md` §2.4 — the Kerberos native-library warning that appears at startup
  and is **not** fatal. It is adjacent to this topic and looks alarming; it is a red herring.
  Verified on WhiteLabel's post-fix rollout: the app logged it and started cleanly one second
  later with zero errors.
- `WHITELABEL_NOTES.md` — the multi-schema worked example.
