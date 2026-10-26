using System;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace EasyFinance.Persistence.DatabaseContext
{
    /// <summary>
    /// Design-time factory for <see cref="EasyFinanceDatabaseContext"/>.
    ///
    /// <para>
    /// <b>Why this file matters more than it looks:</b> it decides the SQL dialect of
    /// every migration EF Core generates. It was the SQL Server factory until the
    /// migration finished; if it ever points back at SQL Server, the next generated
    /// migration would contain <c>nvarchar</c>, <c>datetime2</c> and
    /// <c>SqlServer:Identity</c> — none of which run on PostgreSQL.
    /// </para>
    ///
    /// <para>
    /// It is deliberately <b>not</b> <c>#if DEBUG</c>-dependent: a build-flag-dependent
    /// factory would make the generated dialect a property of how the tooling was
    /// compiled.
    /// </para>
    ///
    /// <para>
    /// Override the target with <c>ECONOFLOW_DESIGN_TIME_CONNECTION</c>. The default uses
    /// PostgreSQL on port <b>5433</b>, never 5432 — on a workstation 5432 is often a
    /// cluster port-forward, so it reaches <b>production</b> rather than a local
    /// container. Migrations are generated from the model and never read the connection,
    /// but the port still matters for any command that touches a database.
    /// </para>
    /// </summary>
    public class EasyFinanceDatabaseContextFactory : IDesignTimeDbContextFactory<EasyFinanceDatabaseContext>
    {
        private const string ConnectionOverrideVariable = "ECONOFLOW_DESIGN_TIME_CONNECTION";

        internal const string DefaultConnection =
            "Host=localhost;Port=5433;Database=econoflow_local;Username=postgres;Password=Rehearsal!Passw0rd";

        public EasyFinanceDatabaseContext CreateDbContext(string[] args)
        {
            var connectionString = Environment.GetEnvironmentVariable(ConnectionOverrideVariable);

            if (string.IsNullOrWhiteSpace(connectionString))
                connectionString = DefaultConnection;

            // MigrationsAssembly is intentionally NOT set: the migrations live in this
            // assembly, beside the context, so EF's default is already correct.
            var options = new DbContextOptionsBuilder<EasyFinanceDatabaseContext>()
                .UseNpgsql(connectionString, npgsql => npgsql
                    .UseQuerySplittingBehavior(QuerySplittingBehavior.SplitQuery))
                .Options;

            return new EasyFinanceDatabaseContext(options);
        }
    }
}
