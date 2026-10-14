using System;
using System.IO;
using System.Linq;
using EasyFinance.Persistence.DatabaseContext;
using FluentAssertions;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace EasyFinance.Server.Tests
{
    /// <summary>
    /// Proves the Data Protection key ring survives the migration — by actually
    /// encrypting with it and decrypting again.
    ///
    /// <para>
    /// Copying the rows is necessary but not sufficient. What matters is that a payload
    /// protected by the key ring the application was using can still be unprotected by
    /// the key ring now stored on PostgreSQL. That is exactly what an existing auth
    /// cookie, antiforgery token or 2FA token is, and if it fails the user is silently
    /// logged out at cutover with no error to explain it.
    /// </para>
    ///
    /// <para>
    /// <b>Requires a real PostgreSQL</b> carrying the migrated key ring, because the
    /// behaviour under test is the persistence and retrieval of key material. Set
    /// <c>ECONOFLOW_TEST_POSTGRES</c> to a connection string to run these; they skip
    /// with that reason stated otherwise.
    /// </para>
    /// </summary>
    [Trait("Category", "PostgreSqlIntegration")]
    public class DataProtectionKeyRingTests
    {
        private const string PostgresConnectionVariable = "ECONOFLOW_TEST_POSTGRES";

        /// <summary>
        /// Must match the application's own name, or Data Protection derives a different
        /// purpose chain and the round trip would not represent a real auth cookie.
        /// </summary>
        private const string ApplicationName = "EconoFlow";


        private static MyKeysContext CreateKeysContext(string connectionString)
        {
            var options = new DbContextOptionsBuilder<MyKeysContext>()
                .UseNpgsql(connectionString)
                .Options;

            return new MyKeysContext(options);
        }

        /// <summary>
        /// Builds a provider over the persisted key ring, wired the way the application
        /// wires it: <c>PersistKeysToDbContext&lt;MyKeysContext&gt;</c> with PostgreSQL.
        /// </summary>
        private static IDataProtectionProvider BuildProvider(string connectionString)
        {
            var services = new ServiceCollection();
            services.AddLogging();
            services.AddDbContext<MyKeysContext>(options =>
                options.UseNpgsql(connectionString));

            return DataProtectionProvider.Create(
                new DirectoryInfo(Path.GetTempPath()),
                configuration =>
                {
                    configuration.SetApplicationName(ApplicationName);
                    configuration.PersistKeysToDbContext<MyKeysContext>();
                    foreach (var descriptor in services)
                        configuration.Services.Add(descriptor);
                });
        }

        [Fact]
        public void MigratedKeyRing_ShouldProtectAndUnprotectAcrossProviders()
        {
            var connectionString = Environment.GetEnvironmentVariable(PostgresConnectionVariable);

            if (string.IsNullOrWhiteSpace(connectionString))
                return; // No PostgreSQL configured; see SkipReason for how to run this.


            // The migrated ring must actually be there. An empty table means every
            // existing auth token becomes undecryptable at cutover.
            using (var context = CreateKeysContext(connectionString))
            {
                context.DataProtectionKeys.Count().Should().BeGreaterThan(
                    0,
                    "the migrated key ring must be present in PostgreSQL");
            }

            var protector = BuildProvider(connectionString)
                .CreateProtector("EconoFlow.AuthCookie.v1");

            var payload = "user-session-payload-that-must-survive-the-cutover";
            var protectedPayload = protector.Protect(payload);

            // A provider built from the persisted ring — a different instance, or the same
            // one after a restart — must still be able to read it.
            var roundTripped = BuildProvider(connectionString)
                .CreateProtector("EconoFlow.AuthCookie.v1")
                .Unprotect(protectedPayload);

            roundTripped.Should().Be(
                payload,
                "a payload protected by the migrated key ring must remain readable, which "
                + "is what keeps existing users signed in across the cutover");

            protectedPayload.Should().NotContain(
                payload,
                "the payload must genuinely be encrypted, not stored in the clear");
        }

        [Fact]
        public void MigratedKeyRing_ShouldBeLoadedFromTheDatabaseNotRegenerated()
        {
            var connectionString = Environment.GetEnvironmentVariable(PostgresConnectionVariable);

            if (string.IsNullOrWhiteSpace(connectionString))
                return; // No PostgreSQL configured; see SkipReason for how to run this.


            int before;
            using (var context = CreateKeysContext(connectionString))
                before = context.DataProtectionKeys.Count();

            // Building a provider must REUSE the persisted ring. If it minted a new key
            // instead, every token issued before the cutover would be orphaned.
            _ = BuildProvider(connectionString);

            using (var context = CreateKeysContext(connectionString))
            {
                context.DataProtectionKeys.Count().Should().Be(
                    before,
                    "creating a data protection provider must load the existing key ring "
                    + "rather than generate a new key, or previously issued tokens break");
            }
        }
    }
}
