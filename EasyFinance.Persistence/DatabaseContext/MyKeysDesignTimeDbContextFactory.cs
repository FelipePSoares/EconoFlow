using System;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace EasyFinance.Persistence.DatabaseContext
{
    /// <summary>
    /// Design-time factory for <see cref="MyKeysContext"/>, the Data Protection key-ring
    /// context.
    ///
    /// <para>
    /// This exists because EF Core migrates <b>exactly one context per command</b>, so
    /// each context needs its own migration set and its own history table. EconoFlow has
    /// two contexts, so it has two sets.
    /// </para>
    ///
    /// <para>
    /// A separate factory (rather than one that branches on a context name) is
    /// deliberate: the factory is what decides the generated DDL's dialect, and the two
    /// sets must never be able to contaminate each other.
    /// </para>
    ///
    /// <para>
    /// Deliberately <b>not</b> <c>#if DEBUG</c>-dependent, for the same reason as
    /// <see cref="EasyFinanceDatabaseContextFactory"/>.
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

        public MyKeysContext CreateDbContext(string[] args)
        {
            var connectionString = Environment.GetEnvironmentVariable(ConnectionOverrideVariable);

            if (string.IsNullOrWhiteSpace(connectionString))
                connectionString = EasyFinanceDatabaseContextFactory.DefaultConnection;

            // MigrationsAssembly is intentionally NOT set: the migrations live in this
            // assembly, beside the context, so EF's default is already correct.
            var options = new DbContextOptionsBuilder<MyKeysContext>()
                .UseNpgsql(connectionString)
                .Options;

            return new MyKeysContext(options);
        }
    }
}
