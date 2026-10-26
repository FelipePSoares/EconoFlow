using System;
using EasyFinance.Application.Contracts.Persistence;
using EasyFinance.Persistence.DatabaseContext;
using EasyFinance.Persistence.Repositories;
using Microsoft.AspNetCore.Builder;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace EasyFinance.Persistence
{
    /// <summary>
    /// Registers the persistence layer against PostgreSQL.
    ///
    /// <para>
    /// <b>PostgreSQL is the only database this application has.</b> It used to be a
    /// runtime choice between SQL Server and PostgreSQL so the two could coexist during
    /// the migration; that window is closed. The SQL Server provider, its migrations, and
    /// the separate <c>EasyFinance.Persistence.Postgres</c> project are all gone — the
    /// PostgreSQL migrations now live in this assembly, beside the contexts, exactly as
    /// the SQL Server ones used to.
    /// </para>
    ///
    /// <para>
    /// Two stores remain, and only one of them is a product of the migration:
    /// </para>
    /// <list type="bullet">
    ///   <item><b>PostgreSQL</b> — production.</item>
    ///   <item><b>In-memory</b> — the shared test fixture and the local Development
    ///   default. It is not a database choice; it is how the suite runs without
    ///   infrastructure, and it has no migrations.</item>
    /// </list>
    /// </summary>
    public static class PersistenceServiceRegistration
    {
        /// <summary>
        /// Configuration key that selects the store.
        /// Values: <c>InMemory</c>, <c>PostgreSql</c> (see
        /// <see cref="DatabaseProviderInfo.AcceptedNames"/>).
        /// </summary>
        public const string ProviderConfigurationKey = "Database:Provider";

        /// <summary>
        /// The connection-string environment variable. Kept under its existing name: it
        /// has held the production connection since before the migration, so renaming it
        /// would be a deployment change for no benefit.
        /// </summary>
        public const string ConnectionStringVariable = "EasyFinanceDB";

        /// <summary>
        /// Registers the persistence layer.
        ///
        /// <para>
        /// Store selection stays a <b>runtime</b> decision. It was a <c>#if DEBUG</c>
        /// branch once, which made it a build property — a Debug build could not be
        /// pointed at a real database at all, and nothing kept the contexts, the health
        /// check and the migrations pointing the same way. The choice that mattered
        /// (SQL Server vs PostgreSQL) is gone, but the mechanism stays because the test
        /// suite depends on it and because it is what keeps the health check and the
        /// contexts in agreement.
        /// </para>
        ///
        /// <para>Resolution order, highest precedence first:</para>
        /// <list type="number">
        ///   <item>an explicit <paramref name="providerOverride"/> (used by tests),</item>
        ///   <item>the <see cref="ProviderConfigurationKey"/> configuration value,</item>
        ///   <item>a <c>Host=</c> connection string, which implies PostgreSQL,</item>
        ///   <item>the in-memory store, in Development only.</item>
        /// </list>
        /// </summary>
        /// <exception cref="InvalidOperationException">
        /// Thrown when no store can be resolved outside Development. Defaulting to the
        /// in-memory store there would produce a pod that reports healthy while
        /// persisting nothing.
        /// </exception>
        public static IServiceCollection AddPersistenceServices(
            this IServiceCollection services,
            IConfiguration configuration,
            DatabaseProvider? providerOverride = null,
            bool isDevelopment = false)
        {
            var connectionString = Environment.GetEnvironmentVariable(ConnectionStringVariable) ?? string.Empty;

            var provider = providerOverride
                ?? ResolveProviderFromConfiguration(configuration)
                ?? ResolveProviderFromConnectionString(connectionString)
                ?? ResolveDefaultProvider(isDevelopment);

            var providerInfo = new DatabaseProviderInfo(provider);
            services.AddSingleton(providerInfo);

            switch (provider)
            {
                case DatabaseProvider.InMemory:
                    RegisterInMemory(services);
                    break;

                case DatabaseProvider.PostgreSql:
                    RegisterPostgreSql(services, connectionString);
                    break;

                default:
                    throw new NotSupportedException(
                        $"Unsupported database provider '{provider}'. PostgreSQL is the only "
                        + "database this application supports; the in-memory store exists for "
                        + "tests and for local Development.");
            }

            RegisterHealthCheck(services, providerInfo, connectionString);

            services.AddScoped<IUnitOfWork, UnitOfWork>();
            services.AddScoped<IAccessControlReadRepository, AccessControlReadRepository>();

            return services;
        }

        private static DatabaseProvider? ResolveProviderFromConfiguration(IConfiguration configuration)
        {
            var configured = configuration?[ProviderConfigurationKey];

            return string.IsNullOrWhiteSpace(configured)
                ? null
                : DatabaseProviderInfo.Parse(configured);
        }

        /// <summary>
        /// Infers the store from the connection string's shape, so a deployment that only
        /// sets <c>EasyFinanceDB</c> keeps working without also setting
        /// <see cref="ProviderConfigurationKey"/>.
        /// </summary>
        private static DatabaseProvider? ResolveProviderFromConnectionString(string connectionString)
        {
            if (string.IsNullOrWhiteSpace(connectionString))
                return null;

            // PostgreSQL uses "Host=". Anything else is not a store we support, and
            // returning null rather than guessing means the caller fails loudly below
            // instead of connecting somewhere unintended.
            return connectionString.Contains("Host=", StringComparison.OrdinalIgnoreCase)
                ? DatabaseProvider.PostgreSql
                : null;
        }

        private static DatabaseProvider ResolveDefaultProvider(bool isDevelopment)
        {
            // Development keeps the in-memory default so `dotnet run` needs no
            // configuration change.
            if (isDevelopment)
                return DatabaseProvider.InMemory;

            throw new InvalidOperationException(
                $"No database provider could be resolved. Set '{ProviderConfigurationKey}' to one of "
                + $"{string.Join(", ", DatabaseProviderInfo.AcceptedNames.Keys)}, or set the "
                + $"{ConnectionStringVariable} environment variable to a PostgreSQL connection "
                + "string (Host=…). Refusing to start rather than falling back to an in-memory "
                + "store, which would appear healthy while persisting nothing.");
        }

        private static void RegisterInMemory(IServiceCollection services)
        {
            services.AddDbContext<EasyFinanceDatabaseContext>(options => options
                .UseInMemoryDatabase("AppDb")
                .EnableSensitiveDataLogging());

            // MyKeysContext has no in-memory equivalent in use today: Data Protection
            // keys are only persisted outside Development (Program.cs).
        }

        private static void RegisterPostgreSql(IServiceCollection services, string connectionString)
        {
            // No MigrationsAssembly here, and its absence is deliberate. It was required
            // while the migrations lived in a separate project; now that they sit in this
            // assembly beside the contexts, EF's default resolves correctly. Naming a
            // project that no longer exists would fail at start-up with
            // FileNotFoundException — the exact production outage the consolidation fixes.
            services.AddDbContext<EasyFinanceDatabaseContext>(
                options => options.UseNpgsql(connectionString, npgsqlOptions =>
                    npgsqlOptions.UseQuerySplittingBehavior(QuerySplittingBehavior.SplitQuery)));

            services.AddDbContext<MyKeysContext>(
                options => options.UseNpgsql(connectionString));
        }

        /// <summary>
        /// Registers the database health check.
        ///
        /// <para>
        /// PostgreSQL is the only relational probe: there is no longer a second provider
        /// to mismatch it against. A SQL Server probe pointed at a PostgreSQL connection
        /// string was a real startup failure once, which is why the provider is still read
        /// from <see cref="DatabaseProviderInfo"/> rather than assumed.
        /// </para>
        /// </summary>
        private static void RegisterHealthCheck(
            IServiceCollection services,
            DatabaseProviderInfo providerInfo,
            string connectionString)
        {
            if (providerInfo.IsInMemory)
                return;

            // The Npgsql probe rejects an empty connection string at registration time, so
            // a missing EasyFinanceDB would otherwise surface as an ArgumentException from
            // inside a health-check package rather than as a statement about the missing
            // configuration.
            if (string.IsNullOrWhiteSpace(connectionString))
            {
                throw new InvalidOperationException(
                    $"The {ConnectionStringVariable} environment variable is empty, so the "
                    + "readiness probe would have nothing to check. Set it to the PostgreSQL "
                    + "connection string.");
            }

            services.AddHealthChecks().AddNpgSql(connectionString, name: "database");
        }

        /// <summary>
        /// Applies the EF Core migrations.
        ///
        /// <para>
        /// <b>Both contexts are migrated.</b> EF migrates only the context it is given, and
        /// the Data Protection key ring is a second context with its own migration set.
        /// Skipping it leaves the application with no key ring — which logs every
        /// signed-in user out — and, during the cutover, failed the data copy outright with
        /// <c>relation "DataProtectionKeys" does not exist</c>.
        /// </para>
        /// </summary>
        public static IApplicationBuilder UseMigration(this IApplicationBuilder app)
        {
            var providerInfo = app.ApplicationServices.GetRequiredService<DatabaseProviderInfo>();

            // The in-memory store has no migrations; calling Migrate() against it throws.
            if (!providerInfo.SupportsMigrations)
                return app;

            using var serviceScope = app.ApplicationServices.CreateScope();

            serviceScope.ServiceProvider
                .GetRequiredService<EasyFinanceDatabaseContext>()
                .Database.Migrate();

            // Idempotent: a no-op when the history is already current.
            serviceScope.ServiceProvider
                .GetRequiredService<MyKeysContext>()
                .Database.Migrate();

            return app;
        }
    }
}
