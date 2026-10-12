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
    /// Both contexts share this one variable. The engine migrates exactly one context
    /// per profile, and this profile migrates <see cref="EasyFinanceDatabaseContext"/>
    /// only — see <c>MigrationPlan.cs</c> for why <c>MyKeysContext</c> is excluded.
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
    /// </summary>
    protected override DbContext CreateContext(string connectionString)
    {
        var options = new DbContextOptionsBuilder<EasyFinanceDatabaseContext>()
            .UseNpgsql(connectionString, npgsql => npgsql
                .MigrationsAssembly("EasyFinance.Persistence.Postgres")
                .CommandTimeout(300))
            .Options;

        return new EasyFinanceDatabaseContext(options);
    }
}
