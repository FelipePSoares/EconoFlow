using System;
using EasyFinance.Persistence.DatabaseContext;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace EasyFinance.Persistence.Postgres
{
    /// <summary>
    /// The name of the migrations assembly holding the PostgreSQL migrations.
    /// </summary>
    public static class PostgresMigrations
    {
        public const string AssemblyName = "EasyFinance.Persistence.Postgres";
    }

    /// <summary>
    /// Design-time factory for <see cref="EasyFinanceDatabaseContext"/> that targets
    /// the <b>PostgreSQL</b> migration set.
    ///
    /// <para>
    /// This is the file that decides the SQL dialect of every migration generated
    /// through it. Running <c>dotnet ef migrations add</c> against
    /// <c>EasyFinance.Persistence</c> would generate SQL Server DDL; running it here
    /// generates PostgreSQL DDL, because the provider and the
    /// <see cref="RelationalDbContextOptionsBuilder{TBuilder,TExtension}.MigrationsAssembly"/>
    /// both point at PostgreSQL.
    /// </para>
    ///
    /// <para>
    /// Deliberately <b>not</b> <c>#if DEBUG</c>-dependent: making the generated dialect
    /// depend on how the tooling was compiled is the exact trap this migration exists
    /// to remove (<c>MIGRATION_TEMPLATE.md</c> §4).
    /// </para>
    ///
    /// <para>
    /// Override the target with <c>ECONOFLOW_DESIGN_TIME_CONNECTION</c>. The default is
    /// PostgreSQL on port <b>5433</b>, never 5432 — on a workstation 5432 is often a
    /// cluster port-forward and reaches production
    /// (<c>docs/postgres-migration/README.md</c>, "Two hard rules").
    /// </para>
    /// </summary>
    public class PostgresDesignTimeDbContextFactory : IDesignTimeDbContextFactory<EasyFinanceDatabaseContext>
    {
        private const string ConnectionOverrideVariable = "ECONOFLOW_DESIGN_TIME_CONNECTION";

        /// <summary>
        /// Rehearsal default. A design-time factory is only ever used by tooling, and
        /// the connection is never used to write data — but it still points at the
        /// rehearsal port so a mistaken run cannot reach a real database.
        /// </summary>
        public const string DefaultConnection =
            "Host=localhost;Port=5433;Database=econoflow_rehearsal;Username=postgres;Password=Rehearsal!Passw0rd";

        public EasyFinanceDatabaseContext CreateDbContext(string[] args)
        {
            var connectionString = Environment.GetEnvironmentVariable(ConnectionOverrideVariable);

            if (string.IsNullOrWhiteSpace(connectionString))
                connectionString = DefaultConnection;

            var options = new DbContextOptionsBuilder<EasyFinanceDatabaseContext>()
                .UseNpgsql(connectionString, npgsql => npgsql
                    .UseQuerySplittingBehavior(QuerySplittingBehavior.SplitQuery)
                    .MigrationsAssembly(PostgresMigrations.AssemblyName))
                .Options;

            return new EasyFinanceDatabaseContext(options);
        }
    }
}
