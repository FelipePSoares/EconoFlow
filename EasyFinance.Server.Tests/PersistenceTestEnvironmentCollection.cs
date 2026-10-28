using Xunit;

namespace EasyFinance.Server.Tests
{
    /// <summary>
    /// The name of the collection defined by
    /// <see cref="PersistenceTestEnvironmentCollection"/>, which the affected test classes
    /// reference. Kept separate because a collection definition must be a static class.
    /// </summary>
    public static class PersistenceTestEnvironment
    {
        /// <summary>The collection name.</summary>
        public const string CollectionName = "Persistence environment variable";
    }

    /// <summary>
    /// Serialises the test classes that mutate the <c>EasyFinanceDB</c> environment variable.
    ///
    /// <para>
    /// It is process-wide state, and two of those classes rely on opposite values of it:
    /// <see cref="PostgreSqlOnlyPersistenceTests"/> needs a connection string to build a
    /// PostgreSQL context, while <see cref="PersistenceProviderSelectionTests"/> clears it to
    /// prove the "no provider configured" path. Run in parallel — xUnit's default across
    /// classes — one clears the variable while the other depends on it, and the suite fails
    /// intermittently. Both classes therefore belong to this collection.
    /// </para>
    /// </summary>
    [CollectionDefinition(PersistenceTestEnvironment.CollectionName, DisableParallelization = true)]
    public static class PersistenceTestEnvironmentCollection
    {
    }
}
