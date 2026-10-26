using System;
using System.Collections.Generic;
using EasyFinance.Persistence;
using EasyFinance.Persistence.DatabaseContext;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace EasyFinance.Server.Tests
{
    /// <summary>
    /// Guards the move from <b>compile-time</b> to <b>runtime</b> provider selection.
    ///
    /// <para>
    /// Provider selection used to be a <c>#if DEBUG</c> branch in
    /// <c>PersistenceServiceRegistration</c>, which made the provider a build
    /// property: a Debug build could not be pointed at a real database at all. The
    /// same mistake previously broke another project's test suite on this programme.
    /// </para>
    ///
    /// <para>
    /// The critical property these tests pin is <b>agreement</b>: the value recorded
    /// in <see cref="DatabaseProviderInfo"/> must be the one the <c>DbContext</c> was
    /// actually built with. A singleton that merely restates configuration would let
    /// the health check probe SQL Server while the app talks to PostgreSQL — which
    /// fails at startup in production and passes every unit test that does not check.
    /// </para>
    /// </summary>
    public class PersistenceProviderSelectionTests : IDisposable
    {
        private readonly string? originalConnectionString;

        public PersistenceProviderSelectionTests()
        {
            // The relational providers register a health check, which rejects an empty
            // connection string. Set a syntactically valid value for the duration of
            // each test and restore whatever was there before.
            originalConnectionString = Environment.GetEnvironmentVariable(
                PersistenceServiceRegistration.ConnectionStringVariable);

            Environment.SetEnvironmentVariable(
                PersistenceServiceRegistration.ConnectionStringVariable,
                "Host=localhost;Port=5433;Database=econoflow;Username=test;Password=test");
        }

        public void Dispose()
        {
            Environment.SetEnvironmentVariable(
                PersistenceServiceRegistration.ConnectionStringVariable,
                originalConnectionString);

            GC.SuppressFinalize(this);
        }

        private static IConfiguration ConfigurationWith(DatabaseProvider? provider)
        {
            var values = new Dictionary<string, string?>();

            if (provider.HasValue)
                values[PersistenceServiceRegistration.ProviderConfigurationKey] = provider.Value.ToString();

            return new ConfigurationBuilder().AddInMemoryCollection(values).Build();
        }

        [Theory]
        [InlineData(DatabaseProvider.InMemory, "InMemory")]
        [InlineData(DatabaseProvider.PostgreSql, "Npgsql")]
        public void AddPersistenceServices_ShouldBuildTheContextWithTheConfiguredProvider(
            DatabaseProvider provider,
            string expectedProviderNameFragment)
        {
            var services = new ServiceCollection();
            services.AddLogging();
            services.AddPersistenceServices(ConfigurationWith(provider), providerOverride: provider);

            using var serviceProvider = services.BuildServiceProvider();
            using var scope = serviceProvider.CreateScope();

            // MyKeysContext is only registered on the relational branch, so assert
            // against EasyFinanceDatabaseContext, which exists on every provider.
            var context = scope.ServiceProvider.GetRequiredService<EasyFinanceDatabaseContext>();

            context.Database.ProviderName.Should().Contain(
                expectedProviderNameFragment,
                $"'{PersistenceServiceRegistration.ProviderConfigurationKey}={provider}' must "
                + "build the DbContext with that provider");
        }

        [Theory]
        [InlineData(DatabaseProvider.InMemory)]
        [InlineData(DatabaseProvider.PostgreSql)]
        public void DatabaseProviderInfo_ShouldAgreeWithTheContextItWasRegisteredWith(DatabaseProvider provider)
        {
            // This is the anti-divergence test, and the reason DatabaseProviderInfo
            // exists at all.
            var services = new ServiceCollection();
            services.AddLogging();
            services.AddPersistenceServices(ConfigurationWith(provider), providerOverride: provider);

            using var serviceProvider = services.BuildServiceProvider();
            using var scope = serviceProvider.CreateScope();

            var info = serviceProvider.GetRequiredService<DatabaseProviderInfo>();
            var context = scope.ServiceProvider.GetRequiredService<EasyFinanceDatabaseContext>();

            info.Provider.Should().Be(provider);
            context.Database.ProviderName.Should().Contain(
                info.ProviderNameFragment,
                "the recorded provider must be the one the DbContext was actually built "
                + "with — otherwise the health check can probe a different database than "
                + "the application uses");
        }

        [Fact]
        public void AddPersistenceServices_ShouldResolveTheProviderFromConfiguration()
        {
            var services = new ServiceCollection();
            services.AddLogging();

            // No override: the value must come from configuration.
            services.AddPersistenceServices(ConfigurationWith(DatabaseProvider.PostgreSql));

            using var serviceProvider = services.BuildServiceProvider();

            serviceProvider.GetRequiredService<DatabaseProviderInfo>().Provider
                .Should().Be(DatabaseProvider.PostgreSql);
        }

        [Fact]
        public void ExplicitOverride_ShouldBeatConfiguration()
        {
            var services = new ServiceCollection();
            services.AddLogging();

            services.AddPersistenceServices(
                ConfigurationWith(DatabaseProvider.PostgreSql),
                providerOverride: DatabaseProvider.InMemory);

            using var serviceProvider = services.BuildServiceProvider();

            serviceProvider.GetRequiredService<DatabaseProviderInfo>().Provider
                .Should().Be(
                    DatabaseProvider.InMemory,
                    "tests must be able to force the in-memory store deterministically");
        }

        /// <summary>
        /// Runs <paramref name="assertion"/> with <c>EasyFinanceDB</c> cleared, so the
        /// connection-string sniffing fallback cannot mask the behaviour under test.
        /// </summary>
        private static void WithoutConnectionString(Action assertion)
        {
            var previous = Environment.GetEnvironmentVariable(
                PersistenceServiceRegistration.ConnectionStringVariable);

            try
            {
                Environment.SetEnvironmentVariable(
                    PersistenceServiceRegistration.ConnectionStringVariable,
                    null);

                assertion();
            }
            finally
            {
                Environment.SetEnvironmentVariable(
                    PersistenceServiceRegistration.ConnectionStringVariable,
                    previous);
            }
        }

        [Fact]
        public void AddPersistenceServices_WithoutAnyProviderOutsideDevelopment_ShouldThrow()
        {
            WithoutConnectionString(() =>
            {
                // The dangerous failure mode this guards: a production pod that silently
                // falls back to the in-memory store reports healthy while persisting
                // nothing, and the data is gone on the next restart.
                var services = new ServiceCollection();
                services.AddLogging();

                var act = () => services.AddPersistenceServices(
                    ConfigurationWith(provider: null),
                    isDevelopment: false);

                act.Should().Throw<InvalidOperationException>()
                    .WithMessage($"*{PersistenceServiceRegistration.ProviderConfigurationKey}*");
            });
        }

        [Fact]
        public void AddPersistenceServices_WithoutAnyProviderInDevelopment_ShouldDefaultToInMemory()
        {
            WithoutConnectionString(() =>
            {
                // Preserves today's `dotnet run` behaviour, which the #if DEBUG branch gave.
                var services = new ServiceCollection();
                services.AddLogging();
                services.AddPersistenceServices(ConfigurationWith(provider: null), isDevelopment: true);

                using var serviceProvider = services.BuildServiceProvider();

                serviceProvider.GetRequiredService<DatabaseProviderInfo>().Provider
                    .Should().Be(DatabaseProvider.InMemory);
            });
        }

        [Fact]
        public void AddPersistenceServices_ShouldInferPostgreSqlFromAConnectionString()
        {
            // The transition-window path: an existing deployment that only sets
            // EasyFinanceDB must keep working without also setting Database:Provider.
            var services = new ServiceCollection();
            services.AddLogging();

            WithoutConnectionString(() =>
            {
                Environment.SetEnvironmentVariable(
                    PersistenceServiceRegistration.ConnectionStringVariable,
                    "Host=localhost;Port=5433;Database=econoflow;Username=test;Password=test");

                services.AddPersistenceServices(
                    ConfigurationWith(provider: null),
                    providerOverride: null,
                    isDevelopment: false);

                using var serviceProvider = services.BuildServiceProvider();

                serviceProvider.GetRequiredService<DatabaseProviderInfo>().Provider
                    .Should().Be(DatabaseProvider.PostgreSql);
            });
        }

        [Fact]
        public void AddPersistenceServices_ShouldRefuseASqlServerConnectionString()
        {
            // The exact shape that used to be production. It must now FAIL rather than
            // resolve to a provider: SQL Server is retired, and the old inference rule
            // would otherwise select a provider the application can no longer build a
            // context for — a startup crash a long way from the cause.
            var services = new ServiceCollection();
            services.AddLogging();

            WithoutConnectionString(() =>
            {
                Environment.SetEnvironmentVariable(
                    PersistenceServiceRegistration.ConnectionStringVariable,
                    "Server=mssql.shared-services.svc.cluster.local,1433;Database=econoflow;User Id=x;Password=y;TrustServerCertificate=true");

                var act = () => services.AddPersistenceServices(
                    ConfigurationWith(provider: null),
                    providerOverride: null,
                    isDevelopment: false);

                act.Should().Throw<InvalidOperationException>()
                    .WithMessage(
                        "*No database provider could be resolved*",
                        "a SQL Server connection string is no longer a provider this "
                        + "application can use, and silence would aim it at nothing");
            });
        }

        [Fact]
        public void AddPersistenceServices_WithUnrecognisedProvider_ShouldThrowAndNameTheAcceptedValues()
        {
            var configuration = new ConfigurationBuilder()
                .AddInMemoryCollection(new Dictionary<string, string?>
                {
                    [PersistenceServiceRegistration.ProviderConfigurationKey] = "MySql"
                })
                .Build();

            var services = new ServiceCollection();
            services.AddLogging();

            var act = () => services.AddPersistenceServices(configuration);

            act.Should().Throw<ArgumentException>()
                .WithMessage("*MySql*")
                .WithMessage("*PostgreSql*");
        }

        [Theory]
        [InlineData("PostgreSql", DatabaseProvider.PostgreSql)]
        [InlineData("postgresql", DatabaseProvider.PostgreSql)]
        [InlineData("Postgres", DatabaseProvider.PostgreSql)]
        [InlineData("InMemory", DatabaseProvider.InMemory)]
        public void ProviderNames_ShouldParseCaseInsensitively(string configured, DatabaseProvider expected)
        {
            DatabaseProviderInfo.Parse(configured).Should().Be(expected);
        }

        [Theory]
        [InlineData(null)]
        [InlineData("")]
        [InlineData("   ")]
        public void Parse_WithMissingValue_ShouldThrow(string? value)
        {
            var act = () => DatabaseProviderInfo.Parse(value);
            act.Should().Throw<ArgumentException>();
        }

        [Theory]
        [InlineData(DatabaseProvider.InMemory, false, false)]
        [InlineData(DatabaseProvider.PostgreSql, true, true)]
        public void DatabaseProviderInfo_ShouldReportRelationalCapabilities(
            DatabaseProvider provider,
            bool expectedRelational,
            bool expectedMigrations)
        {
            var info = new DatabaseProviderInfo(provider);

            info.IsRelational.Should().Be(expectedRelational);
            info.SupportsMigrations.Should().Be(
                expectedMigrations,
                "the in-memory store has no migrations, so UseMigration() must skip it");
        }

        [Fact]
        public void AddPersistenceServices_WithRelationalProviderAndNoConnectionString_ShouldThrow()
        {
            // Guards against a health-check package throwing an opaque ArgumentException
            // from inside its own registration when the real problem is a missing
            // EasyFinanceDB value.
            var previous = Environment.GetEnvironmentVariable(
                PersistenceServiceRegistration.ConnectionStringVariable);

            try
            {
                Environment.SetEnvironmentVariable(
                    PersistenceServiceRegistration.ConnectionStringVariable,
                    string.Empty);

                var services = new ServiceCollection();
                services.AddLogging();

                var act = () => services.AddPersistenceServices(
                    ConfigurationWith(DatabaseProvider.PostgreSql),
                    providerOverride: DatabaseProvider.PostgreSql);

                act.Should().Throw<InvalidOperationException>()
                    .WithMessage($"*{PersistenceServiceRegistration.ConnectionStringVariable}*");
            }
            finally
            {
                Environment.SetEnvironmentVariable(
                    PersistenceServiceRegistration.ConnectionStringVariable,
                    previous);
            }
        }

        [Fact]
        public void AcceptedNames_ShouldCoverEveryProvider()
        {
            // AcceptedNames is what Parse consults, and what the start-up error message
            // lists to an operator. If a provider were added without an entry here, the
            // enum value would be selectable in code yet unreachable from configuration,
            // and the only symptom would be "unrecognised database provider" at deploy
            // time - a long way from the missing line.
            var declared = Enum.GetValues<DatabaseProvider>().ToList();
            var accepted = DatabaseProviderInfo.AcceptedNames.Values.Distinct().ToList();

            accepted.Should().BeEquivalentTo(
                declared,
                "every DatabaseProvider value must be reachable by name from "
                + $"{PersistenceServiceRegistration.ProviderConfigurationKey}");

            // "Postgres" is a deliberate convenience alias for PostgreSql, not a typo.
            DatabaseProviderInfo.AcceptedNames.Should().ContainKey("Postgres");
            DatabaseProviderInfo.AcceptedNames["Postgres"].Should().Be(DatabaseProvider.PostgreSql);
        }

        [Fact]
        public void AcceptedNames_ShouldNotCollideCaseInsensitively()
        {
            // The dictionary is OrdinalIgnoreCase, so two keys differing only in case
            // would make Parse's result depend on dictionary ordering - a silent,
            // configuration-dependent bug with no compile-time symptom.
            DatabaseProviderInfo.AcceptedNames.Keys.Should().OnlyHaveUniqueItems(
                "two accepted names differing only in case would collide in the "
                + "case-insensitive lookup Parse uses");
        }
    }
}
