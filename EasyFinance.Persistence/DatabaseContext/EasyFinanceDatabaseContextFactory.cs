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
    /// every migration EF Core generates. If it points at SQL Server, the generated
    /// migration contains <c>nvarchar</c>, <c>datetime2</c> and <c>SqlServer:Identity</c>
    /// — none of which run on PostgreSQL.
    /// </para>
    ///
    /// <para>
    /// It is deliberately <b>not</b> <c>#if DEBUG</c>-dependent: a build-flag-dependent
    /// factory would make the generated dialect a property of how the tooling was
    /// compiled, which is exactly the trap this migration is removing.
    /// </para>
    ///
    /// <para>
    /// Override the target with <c>ECONOFLOW_DESIGN_TIME_CONNECTION</c>; the default
    /// uses PostgreSQL on port <b>5433</b>, never 5432, per the rehearsal rule in
    /// <c>docs/postgres-migration/README.md</c>.
    /// </para>
    /// </summary>
    public class EasyFinanceDatabaseContextFactory : IDesignTimeDbContextFactory<EasyFinanceDatabaseContext>
    {
        private const string ConnectionOverrideVariable = "ECONOFLOW_DESIGN_TIME_CONNECTION";

        internal const string DefaultConnection =
            "Host=localhost;Port=5433;Database=econoflow_rehearsal;Username=postgres;Password=Rehearsal!Passw0rd";

        public EasyFinanceDatabaseContext CreateDbContext(string[] args)
        {
            var connectionString = Environment.GetEnvironmentVariable(ConnectionOverrideVariable);

            if (string.IsNullOrWhiteSpace(connectionString))
                connectionString = DefaultConnection;

            var options = new DbContextOptionsBuilder<EasyFinanceDatabaseContext>()
                .UseNpgsql(connectionString, npgsql => npgsql
                    .UseQuerySplittingBehavior(QuerySplittingBehavior.SplitQuery)
                    .MigrationsAssembly(typeof(EasyFinanceDatabaseContext).Assembly.GetName().Name))
                .Options;

            return new EasyFinanceDatabaseContext(options);
        }
    }
}
