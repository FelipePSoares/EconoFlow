using System;
using System.Collections.Generic;

namespace EasyFinance.Persistence.DatabaseContext
{
    /// <summary>
    /// The store EconoFlow was configured with.
    ///
    /// <para>
    /// PostgreSQL is the product database. <c>InMemory</c> is not a database choice — it
    /// is how the test suite and local Development run without infrastructure, and it has
    /// no migrations. SQL Server used to sit between them so the two databases could
    /// coexist during the migration; that window is closed and the value is gone.
    /// </para>
    /// </summary>
    public enum DatabaseProvider
    {
        /// <summary>EF Core in-memory store. Development and tests only — never a real database.</summary>
        InMemory = 0,

        /// <summary>PostgreSQL. The only relational database this application supports.</summary>
        PostgreSql = 2
    }

    /// <summary>
    /// Records which store the <c>DbContext</c>s were actually built with, so startup can
    /// branch on the <b>same</b> value rather than re-deriving it from configuration and
    /// risking a disagreement.
    ///
    /// <para>
    /// This exists because store selection used to be a compile-time decision
    /// (<c>#if DEBUG</c>), which made it a build property: a Debug build could not be
    /// pointed at a real database at all, and the health check and the context could be
    /// configured differently without anything noticing. Registering this as a singleton
    /// makes the decision a value that is inspectable at runtime and assertable in tests.
    /// </para>
    /// </summary>
    public sealed class DatabaseProviderInfo
    {
        public DatabaseProviderInfo(DatabaseProvider provider)
        {
            Provider = provider;
        }

        /// <summary>The store the contexts were registered with.</summary>
        public DatabaseProvider Provider { get; }

        /// <summary>
        /// Whether the store is a real relational database. <c>InMemory</c> is not, so
        /// anything that assumes relational semantics must check this first.
        /// </summary>
        public bool IsRelational => Provider != DatabaseProvider.InMemory;

        /// <summary>
        /// Whether <c>Database.Migrate()</c> is meaningful. False for <c>InMemory</c>,
        /// which has no migrations — calling <c>Migrate()</c> against it throws.
        /// </summary>
        public bool SupportsMigrations => IsRelational;

        /// <summary>
        /// Whether the in-memory store is in use. Read by the health-check registration
        /// and by <c>UseMigration()</c>, both of which must skip it.
        /// </summary>
        public bool IsInMemory => Provider == DatabaseProvider.InMemory;

        /// <summary>
        /// The name fragment EF Core reports in <c>Database.ProviderName</c> for this
        /// store. Used by tests to prove the registered info agrees with the context
        /// rather than merely restating the configuration.
        /// </summary>
        public string ProviderNameFragment => Provider switch
        {
            DatabaseProvider.InMemory => "InMemory",
            DatabaseProvider.PostgreSql => "Npgsql",
            _ => throw new NotSupportedException($"Unknown provider '{Provider}'.")
        };

        /// <summary>
        /// Configuration values accepted for the <c>Database:Provider</c> key, in the
        /// casing a deployment may reasonably use. <c>Postgres</c> is a convenience alias,
        /// not a typo.
        /// </summary>
        public static IReadOnlyDictionary<string, DatabaseProvider> AcceptedNames { get; } =
            new Dictionary<string, DatabaseProvider>(StringComparer.OrdinalIgnoreCase)
            {
                ["InMemory"] = DatabaseProvider.InMemory,
                ["PostgreSql"] = DatabaseProvider.PostgreSql,
                ["Postgres"] = DatabaseProvider.PostgreSql
            };

        /// <summary>
        /// Parses a configured provider name.
        /// </summary>
        /// <exception cref="ArgumentException">
        /// Thrown for an unrecognised value. Failing loudly is deliberate: silently
        /// falling back would aim a production deployment at the wrong database, and the
        /// wrong fallback (InMemory) looks healthy while storing nothing.
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
