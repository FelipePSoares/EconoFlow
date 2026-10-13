using System;
using System.Collections.Generic;
using EasyFinance.Persistence.DatabaseContext;
using FpsSoftware.DataMigration;
using Microsoft.EntityFrameworkCore;

namespace EconoFlow.DataMigration;

/// <summary>
/// EconoFlow's values for the shared migration engine.
///
/// <para>
/// This is one of only three project-specific files; everything else comes from the
/// <c>fpssoftware.datamigration</c> package. See
/// <c>docs/postgres-migration/MIGRATION_TEMPLATE.md</c> §1.
/// </para>
/// </summary>
internal sealed class EconoFlowMigrationProfile : MigrationProfile
{
    /// <summary>
    /// The connection-string variable the deployment already sets. Deliberately
    /// <b>unchanged</b>: keeping the name means the cutover is a <i>value</i> change,
    /// not a key rename plus a value change
    /// (<c>docs/postgres-migration/ECONOFLOW_PREFLIGHT.md</c> §10).
    ///
    /// <para>
    /// Both contexts share this one variable, and the engine migrates exactly one
    /// context per profile — this profile exists to migrate
    /// <see cref="EasyFinanceDatabaseContext"/>, because that is the context those EF
    /// migrations belong to.
    /// </para>
    ///
    /// <para>
    /// <b>The Data Protection key ring IS migrated.</b> <c>MyKeysContext</c> has its own
    /// PostgreSQL migration set, and its table (<c>DataProtectionKeys</c>) is copied by
    /// this plan like any other — see <c>MigrationPlan.cs</c>. An earlier revision
    /// excluded it, on the mistaken assumption that the values were DPAPI-encrypted and
    /// therefore machine-bound; they are plaintext in this deployment, and excluding
    /// them would have logged every signed-in user out at cutover.
    /// </para>
    /// </summary>
    public override string AppConnectionVariable => "EasyFinanceDB";

    /// <summary>
    /// Rehearsal default for the SQL Server source. Only ever a fallback: the engine
    /// prefers <c>MIGRATION_SOURCE</c>. Port <b>14330</b> is the rehearsal container,
    /// so a mistaken run cannot reach a real server.
    /// </summary>
    public override string DefaultSource =>
        "Server=localhost,14330;Database=EconoFlowRehearsal;User Id=sa;"
        + "Password=Rehearsal!Passw0rd;TrustServerCertificate=true";

    /// <summary>
    /// Rehearsal default for the PostgreSQL target. Port <b>5433</b>, never 5432: on a
    /// workstation 5432 is frequently a cluster port-forward that reaches
    /// <b>production</b>, and this mistake has previously copied 24,532 rows into a
    /// live database while reporting MIGRATION VERIFIED
    /// (<c>docs/postgres-migration/README.md</c>, "Two hard rules").
    /// </summary>
    public override string DefaultTarget =>
        "Host=localhost;Port=5433;Database=econoflow_rehearsal;"
        + "Username=postgres;Password=Rehearsal!Passw0rd";

    /// <summary>
    /// <c>citext</c> only.
    ///
    /// <para>
    /// It is required because <c>DeductibleGroups.Name</c> is user-supplied, compared
    /// for equality, and covered by a unique index
    /// <c>(ProjectId, TaxYearId, Name)</c>. SQL Server's default <c>_CI_AS</c>
    /// collation made that comparison case-insensitive; PostgreSQL's <c>text</c> does
    /// not, which would let "Travel" and "travel" coexist as two rows. Verified on a
    /// real PostgreSQL: with <c>citext</c> the case-variant insert is rejected, with
    /// plain <c>text</c> it stores a second row.
    /// </para>
    ///
    /// <para>
    /// <c>pg_trgm</c> is deliberately <b>not</b> listed. EconoFlow has no
    /// leading-wildcard search — every <c>.Contains()</c> in the codebase is in-memory
    /// collection membership, not a SQL <c>LIKE</c> — so no trigram index is needed.
    /// It would also be wasted on a <c>citext</c> column, which cannot use
    /// <c>pg_trgm</c> operator classes.
    /// </para>
    /// </summary>
    public override IReadOnlyList<string> RequiredExtensions => ["citext"];

    public override IReadOnlyList<TablePlan> Tables => MigrationPlan.Tables;

    /// <summary>
    /// Tables whose integer identity column must keep its original values.
    ///
    /// <para>
    /// A binary COPY inserts explicit values and never advances the backing sequence,
    /// so without a resync the application's next INSERT collides with an existing
    /// primary key. Verified against the live catalog: exactly three integer identity
    /// columns exist, all on ASP.NET Identity claim tables. Every other key in the
    /// schema is a UUID, which has no sequence and therefore needs no entry.
    /// </para>
    /// </summary>
    public override IReadOnlyDictionary<string, string> SequencesToResync => MigrationPlan.SequencesToResync;

    /// <summary>
    /// Supplies the context the engine applies EF migrations with.
    ///
    /// <para>
    /// This hook is why the engine can be a shared package: without it, the file that
    /// applies a project's migrations would have to name that project's
    /// <c>DbContext</c>. The migrations are the PostgreSQL set in
    /// <c>EasyFinance.Persistence.Postgres</c>, not the SQL Server set in
    /// <c>EasyFinance.Persistence</c>.
    /// </para>
    ///
    /// <para>
    /// Returns <see cref="EasyFinanceDatabaseContext"/> only, because that is the one
    /// context the engine migrates — the <c>MyKeys</c> set is applied as a side effect
    /// below, for the reason given there.
    /// </para>
    /// </summary>
    protected override DbContext CreateContext(string connectionString)
    {
        var options = new DbContextOptionsBuilder<EasyFinanceDatabaseContext>()
            .UseNpgsql(connectionString, npgsql => npgsql
                .MigrationsAssembly("EasyFinance.Persistence.Postgres")
                .CommandTimeout(300))
            .Options;

        var context = new EasyFinanceDatabaseContext(options);

        // The engine migrates exactly ONE context, so the MyKeys set would silently
        // never be applied - and the copy then fails with
        // 'relation "DataProtectionKeys" does not exist', because the plan maps that
        // table like any other.
        //
        // Reproduced in production, not theorised: the first cutover attempt applied
        // 1 migration, created 23 tables, and died on exactly that error. The
        // rehearsal had masked it by applying both contexts by hand with
        // `dotnet ef database update`, which is not what the tool does.
        ApplyMyKeysSchema(context.Database.GetDbConnection().ConnectionString);

        return context;
    }

    /// <summary>
    /// Applies the <c>MyKeysContext</c> migration set, which the engine cannot reach.
    ///
    /// <para>
    /// <c>MyKeysContext</c> is the Data Protection key-ring context. Its PostgreSQL
    /// migration lives in <c>Migrations/MyKeys/</c> of the same assembly, under its own
    /// history table, and the engine's single-context hook means it is never applied by
    /// <c>--migrate</c>. Without this the <c>DataProtectionKeys</c> table does not
    /// exist and the copy fails on it — and even if the plan omitted the table, the
    /// application would start with no key ring and log every user out.
    /// </para>
    ///
    /// <para>
    /// Idempotent: <c>Migrate()</c> is a no-op when the history is current, so this is
    /// safe on every run.
    /// </para>
    /// </summary>
    private static void ApplyMyKeysSchema(string connectionString)
    {
        var options = new DbContextOptionsBuilder<MyKeysContext>()
            .UseNpgsql(connectionString, npgsql => npgsql
                .MigrationsAssembly("EasyFinance.Persistence.Postgres")
                .CommandTimeout(300))
            .Options;

        using var myKeysContext = new MyKeysContext(options);

        myKeysContext.Database.Migrate();
    }
}
