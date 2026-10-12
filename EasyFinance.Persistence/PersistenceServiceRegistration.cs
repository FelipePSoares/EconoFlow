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
    public static class PersistenceServiceRegistration
    {
        /// <summary>
        /// Configuration key that selects the EF Core provider.
        /// Values: <c>InMemory</c>, <c>SqlServer</c>, <c>PostgreSql</c>
        /// (see <see cref="DatabaseProviderInfo.AcceptedNames"/>).
        /// </summary>
        public const string ProviderConfigurationKey = "Database:Provider";

        /// <summary>
        /// The connection-string environment variable. Kept under its existing name so
        /// the PostgreSQL cutover is a <b>value</b> change, not a key rename plus a
        /// value change (docs/postgres-migration/ECONOFLOW_PREFLIGHT.md §10).
        /// </summary>
        public const string ConnectionStringVariable = "EasyFinanceDB";

        /// <summary>
        /// Registers the persistence layer.
        ///
        /// <para>
        /// Provider selection is a <b>runtime</b> decision. It used to be a
        /// <c>#if DEBUG</c> branch, which made the provider a build property — a Debug
        /// build could not be pointed at a real database at all, and nothing kept the
        /// contexts, the health check and the migrations pointing the same way.
        /// </para>
        ///
        /// <para>Resolution order, highest precedence first:</para>
        /// <list type="number">
        ///   <item>an explicit <paramref name="providerOverride"/> (used by tests),</item>
        ///   <item>the <see cref="ProviderConfigurationKey"/> configuration value,</item>
        ///   <item>the shape of the connection string, for the transition window.</item>
        /// </list>
        /// </summary>
        /// <exception cref="InvalidOperationException">
        /// Thrown when no provider can be resolved and the environment is not
        /// Development. Defaulting to the in-memory store outside Development would
        /// produce a pod that reports healthy while persisting nothing.
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

                case DatabaseProvider.SqlServer:
                    RegisterSqlServer(services, connectionString);
                    break;

                case DatabaseProvider.PostgreSql:
                    RegisterPostgreSql(services, connectionString);
                    break;

                default:
                    throw new NotSupportedException($"Unsupported database provider '{provider}'.");
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
        /// Infers the provider from the connection string's shape, so an existing
        /// deployment that only sets <c>EasyFinanceDB</c> keeps working across the
        /// transition without also having to set <see cref="ProviderConfigurationKey"/>.
        /// </summary>
        private static DatabaseProvider? ResolveProviderFromConnectionString(string connectionString)
        {
            if (string.IsNullOrWhiteSpace(connectionString))
                return null;

            // PostgreSQL uses "Host=". SQL Server uses "Server=" or "Data Source=".
            // Check the PostgreSQL marker first: it is unambiguous.
            if (connectionString.Contains("Host=", StringComparison.OrdinalIgnoreCase))
                return DatabaseProvider.PostgreSql;

            if (connectionString.Contains("Server=", StringComparison.OrdinalIgnoreCase)
                || connectionString.Contains("Data Source=", StringComparison.OrdinalIgnoreCase))
            {
                return DatabaseProvider.SqlServer;
            }

            return null;
        }

        private static DatabaseProvider ResolveDefaultProvider(bool isDevelopment)
        {
            // Development keeps today's behaviour (the #if DEBUG branch used the
            // in-memory store) so `dotnet run` needs no configuration change.
            if (isDevelopment)
                return DatabaseProvider.InMemory;

            throw new InvalidOperationException(
                $"No database provider could be resolved. Set '{ProviderConfigurationKey}' to one of "
                + $"{string.Join(", ", DatabaseProviderInfo.AcceptedNames.Keys)}, or set the "
                + $"{ConnectionStringVariable} environment variable to a connection string whose "
                + "provider can be inferred. Refusing to start rather than falling back to an "
                + "in-memory store, which would appear healthy while persisting nothing.");
        }

        private static void RegisterInMemory(IServiceCollection services)
        {
            services.AddDbContext<EasyFinanceDatabaseContext>(options => options
                .UseInMemoryDatabase("AppDb")
                .EnableSensitiveDataLogging());

            // MyKeysContext has no in-memory equivalent in use today: Data Protection
            // keys are only persisted outside Development (Program.cs), and this
            // context was previously registered only on the relational branch.
        }

        private static void RegisterSqlServer(IServiceCollection services, string connectionString)
        {
            services.AddDbContext<EasyFinanceDatabaseContext>(
                options => options.UseSqlServer(connectionString, sqlOptions =>
                    sqlOptions.UseQuerySplittingBehavior(QuerySplittingBehavior.SplitQuery)));

            services.AddDbContext<MyKeysContext>(
                options => options.UseSqlServer(connectionString));
        }

        private static void RegisterPostgreSql(IServiceCollection services, string connectionString)
        {
            services.AddDbContext<EasyFinanceDatabaseContext>(
                options => options.UseNpgsql(connectionString, npgsqlOptions =>
                    npgsqlOptions.UseQuerySplittingBehavior(QuerySplittingBehavior.SplitQuery)));

            services.AddDbContext<MyKeysContext>(
                options => options.UseNpgsql(connectionString));
        }

        /// <summary>
        /// Registers the database health check matching the resolved provider. A SQL
        /// Server probe pointed at a PostgreSQL connection string fails at startup, so
        /// this must never be hardcoded to one provider.
        /// </summary>
        private static void RegisterHealthCheck(
            IServiceCollection services,
            DatabaseProviderInfo providerInfo,
            string connectionString)
        {
            if (providerInfo.IsInMemory)
                return;

            // Every one of these probes rejects an empty connection string at
            // registration time, so a missing EasyFinanceDB would surface as an
            // ArgumentException from inside a health-check package rather than as a
            // statement about the missing configuration.
            if (string.IsNullOrWhiteSpace(connectionString))
            {
                throw new InvalidOperationException(
                    $"The {ConnectionStringVariable} environment variable is empty, so the "
                    + $"{providerInfo.Provider} health check cannot be registered. Set it to a "
                    + "valid connection string.");
            }

            var healthChecksBuilder = services.AddHealthChecks();

            switch (providerInfo.HealthCheckProvider)
            {
                case DatabaseProvider.SqlServer:
                    healthChecksBuilder.AddSqlServer(connectionString);
                    break;

                case DatabaseProvider.PostgreSql:
                    healthChecksBuilder.AddNpgSql(connectionString);
                    break;

                default:
                    throw new NotSupportedException(
                        $"No health check is implemented for provider '{providerInfo.Provider}'.");
            }
        }

        public static IApplicationBuilder UseMigration(this IApplicationBuilder app)
        {
            var providerInfo = app.ApplicationServices.GetRequiredService<DatabaseProviderInfo>();

            // The in-memory store has no migrations; calling Migrate() against it throws.
            if (!providerInfo.SupportsMigrations)
                return app;

            using (var serviceScope = app.ApplicationServices.CreateScope())
            {
                var dbContext = serviceScope.ServiceProvider.GetRequiredService<EasyFinanceDatabaseContext>();
                dbContext.Database.Migrate();

                var myKeysDbContext = serviceScope.ServiceProvider.GetRequiredService<MyKeysContext>();
                myKeysDbContext.Database.Migrate();
            }

            return app;
        }
    }
}
