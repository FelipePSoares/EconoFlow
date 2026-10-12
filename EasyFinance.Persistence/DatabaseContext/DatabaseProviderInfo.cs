using System;
using System.Collections.Generic;

namespace EasyFinance.Persistence.DatabaseContext
{
    /// <summary>
    /// The EF Core provider EconoFlow was configured with.
    /// </summary>
    public enum DatabaseProvider
    {
        /// <summary>EF Core in-memory store. Development and tests only — never a real database.</summary>
        InMemory = 0,

        /// <summary>SQL Server. Kept for the migration transition window.</summary>
        SqlServer = 1,

        /// <summary>PostgreSQL. The migration target.</summary>
        PostgreSql = 2
    }

    /// <summary>
    /// Records which provider the <c>DbContext</c>s were actually built with, so
    /// startup can branch on the <b>same</b> value rather than re-deriving it from
    /// configuration and risking a disagreement.
    ///
    /// <para>
    /// This exists because provider selection used to be a compile-time decision
    /// (<c>#if DEBUG</c>), which made the provider a build property: a Debug build
    /// could not be pointed at a real database at all, and the health check and the
    /// context could be configured for different providers without anything noticing.
    /// Registering this as a singleton makes the decision a value that is inspectable
    /// at runtime and assertable in tests.
    /// </para>
    /// </summary>
    public sealed class DatabaseProviderInfo
    {
        public DatabaseProviderInfo(DatabaseProvider provider)
        {
            Provider = provider;
        }

        /// <summary>The provider the contexts were registered with.</summary>
        public DatabaseProvider Provider { get; }

        /// <summary>
        /// Whether the provider is a real relational database. <c>InMemory</c> is not,
        /// so anything that assumes relational semantics must check this first.
        /// </summary>
        public bool IsRelational => Provider != DatabaseProvider.InMemory;

        /// <summary>
        /// Whether <c>Database.Migrate()</c> is meaningful. False for <c>InMemory</c>,
        /// which has no migrations — calling <c>Migrate()</c> against it throws.
        /// </summary>
        public bool SupportsMigrations => IsRelational;

        public bool IsInMemory => Provider == DatabaseProvider.InMemory;

        public bool IsSqlServer => Provider == DatabaseProvider.SqlServer;

        public bool IsPostgreSql => Provider == DatabaseProvider.PostgreSql;

        /// <summary>
        /// The value the health check must probe with. A SQL Server probe pointed at a
        /// PostgreSQL connection string fails at startup, so this must always agree
        /// with the provider the contexts were built with.
        /// </summary>
        public DatabaseProvider HealthCheckProvider => Provider;

        /// <summary>
        /// The name fragment EF Core reports in <c>Database.ProviderName</c> for this
        /// provider. Used by tests to prove the registered info agrees with the
        /// context rather than merely restating the configuration.
        /// </summary>
        public string ProviderNameFragment => Provider switch
        {
            DatabaseProvider.InMemory => "InMemory",
            DatabaseProvider.SqlServer => "SqlServer",
            DatabaseProvider.PostgreSql => "Npgsql",
            _ => throw new NotSupportedException($"Unknown provider '{Provider}'.")
        };

        /// <summary>
        /// Configuration values accepted for the <c>Database:Provider</c> key, in the
        /// casing a deployment may reasonably use.
        /// </summary>
        public static IReadOnlyDictionary<string, DatabaseProvider> AcceptedNames { get; } =
            new Dictionary<string, DatabaseProvider>(StringComparer.OrdinalIgnoreCase)
            {
                ["InMemory"] = DatabaseProvider.InMemory,
                ["SqlServer"] = DatabaseProvider.SqlServer,
                ["PostgreSql"] = DatabaseProvider.PostgreSql,
                ["Postgres"] = DatabaseProvider.PostgreSql
            };

        /// <summary>
        /// Parses a configured provider name.
        /// </summary>
        /// <exception cref="ArgumentException">
        /// Thrown for an unrecognised value. Failing loudly is deliberate: silently
        /// falling back would aim a production deployment at the wrong database, and
        /// the wrong fallback (InMemory) looks healthy while storing nothing.
        /// </exception>
        public static DatabaseProvider Parse(string? value)
        {
            if (string.IsNullOrWhiteSpace(value))
                throw new ArgumentException("A database provider name is required.", nameof(value));

            if (AcceptedNames.TryGetValue(value.Trim(), out var provider))
                return provider;

            throw new ArgumentException(
                $"Unrecognised database provider '{value}'. "
                + $"Accepted values: {string.Join(", ", AcceptedNames.Keys)}.",
                nameof(value));
        }
    }
}
