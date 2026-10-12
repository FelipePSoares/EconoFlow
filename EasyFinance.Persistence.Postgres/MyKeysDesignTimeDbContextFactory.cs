using System;
using EasyFinance.Persistence.DatabaseContext;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace EasyFinance.Persistence.Postgres
{
    /// <summary>
    /// Design-time factory for <see cref="MyKeysContext"/>, targeting the
    /// <b>PostgreSQL</b> migration set.
    ///
    /// <para>
    /// This exists because the migration engine migrates <b>exactly one context per
    /// profile</b>, so each context needs its own migration set and its own history
    /// table. This is WhiteLabel's shape, and EconoFlow has the same two-context
    /// structure.
    /// </para>
    ///
    /// <para>
    /// A separate factory (rather than one that branches on a context name) is
    /// deliberate: the factory is what decides the generated DDL's dialect, and the
    /// two sets must never be able to contaminate each other.
    /// </para>
    ///
    /// <para>
    /// Deliberately <b>not</b> <c>#if DEBUG</c>-dependent, for the same reason as
    /// <see cref="PostgresDesignTimeDbContextFactory"/>.
    /// </para>
    ///
    /// <para>
    /// Override the target with <c>ECONOFLOW_DESIGN_TIME_CONNECTION</c>. The default is
    /// PostgreSQL on port <b>5433</b>, never 5432.
    /// </para>
    /// </summary>
    public class MyKeysDesignTimeDbContextFactory : IDesignTimeDbContextFactory<MyKeysContext>
    {
        private const string ConnectionOverrideVariable = "ECONOFLOW_DESIGN_TIME_CONNECTION";

        /// <summary>
        /// Rehearsal default, matching <see cref="PostgresDesignTimeDbContextFactory"/>.
        /// </summary>
        public const string DefaultConnection =
            "Host=localhost;Port=5433;Database=econoflow_rehearsal;Username=postgres;Password=Rehearsal!Passw0rd";

        public MyKeysContext CreateDbContext(string[] args)
        {
            var connectionString = Environment.GetEnvironmentVariable(ConnectionOverrideVariable);

            if (string.IsNullOrWhiteSpace(connectionString))
                connectionString = DefaultConnection;

            var options = new DbContextOptionsBuilder<MyKeysContext>()
                .UseNpgsql(connectionString, npgsql => npgsql
                    .MigrationsAssembly(PostgresMigrations.AssemblyName))
                .Options;

            return new MyKeysContext(options);
        }
    }
}
