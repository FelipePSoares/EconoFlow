using System;
using System.Collections.Generic;
using System.Linq;
using EconoFlow.DataMigration;
using FluentAssertions;
using FpsSoftware.DataMigration;
using Xunit;

namespace EasyFinance.Server.Tests
{
    /// <summary>
    /// Guards that the data-migration plan carries the Data Protection key ring.
    ///
    /// <para>
    /// <c>DataProtectionKeys</c> holds the ASP.NET Core Data Protection key ring. Every
    /// auth cookie, antiforgery token, 2FA token and email-confirmation link is
    /// encrypted with it. If the keys are not migrated, the new PostgreSQL instance
    /// starts a <b>fresh</b> key ring and every token minted by the old instance becomes
    /// undecryptable — so every signed-in user is silently logged out at cutover, and
    /// any in-flight confirmation link stops working.
    /// </para>
    ///
    /// <para>
    /// The keys are <b>portable</b> in this deployment and therefore safe to copy:
    /// <c>Program.cs</c> calls <c>ProtectKeysWithDpapi</c> only when
    /// <c>OperatingSystem.IsWindows()</c> <i>and</i>
    /// <c>EconoFlow_KEY_ENCRYPT_ACTIVE</c> is true. The production image is Linux, and
    /// the stored <c>Xml</c> in the source database is plaintext key XML
    /// (<c>&lt;key id="..." version="1"&gt;</c>), not DPAPI ciphertext.
    /// </para>
    ///
    /// <para>
    /// This plan is a plain C# class with no runtime dependencies, so it can be asserted
    /// directly without a database.
    /// </para>
    /// </summary>
    public class DataProtectionKeyMigrationTests
    {
        private static IEnumerable<TablePlan> Tables => MigrationPlan.Tables;

        [Fact]
        public void Plan_ShouldCopyDataProtectionKeys()
        {
            Tables.Select(table => table.SourceTable)
                .Should().Contain(
                    "dbo.DataProtectionKeys",
                    "the Data Protection key ring must move with the application, or every "
                    + "signed-in user is logged out at cutover and existing auth cookies "
                    + "become undecryptable");
        }

        [Fact]
        public void Plan_ShouldStillExcludeTheMigrationHistoryTable()
        {
            // The negative case: __EFMigrationsHistory must NOT be copied. Copying the
            // SQL Server history would assert that the PostgreSQL migrations are already
            // applied, and EF would then skip creating the application schema.
            Tables.Select(table => table.SourceTable)
                .Should().NotContain(
                    "dbo.__EFMigrationsHistory",
                    "EF bookkeeping is created by --migrate applying the baseline, never copied");
        }

        [Fact]
        public void DataProtectionKeys_ShouldResyncItsIdentitySequence()
        {
            // COPY inserts explicit values and never advances the backing sequence, so
            // the application's first new key would collide with a migrated one.
            MigrationPlan.SequencesToResync.Should().ContainKey(
                "DataProtectionKeys",
                "the table has an integer identity Id, so its sequence must be resynced "
                + "after the copy or the next inserted key collides");
        }

        [Fact]
        public void DataProtectionKeys_ShouldMapTheKeyRingColumnsNotDropThem()
        {
            var table = Tables.SingleOrDefault(t => t.SourceTable == "dbo.DataProtectionKeys");

            table.Should().NotBeNull();

            var targets = table!.Columns.Select(column => column.TargetColumn).ToList();

            // All three columns matter: Id links nothing but must be faithful, FriendlyName
            // is the key name, and Xml is the key material itself. Dropping Xml would copy
            // rows that cannot protect anything.
            targets.Should().Contain(["Id", "FriendlyName", "Xml"]);
        }
    }
}
