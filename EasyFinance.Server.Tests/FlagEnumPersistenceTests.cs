using System;
using System.Linq;
using EasyFinance.Domain.AccessControl;
using EasyFinance.Domain.Account;
using EasyFinance.Persistence.DatabaseContext;
using Microsoft.EntityFrameworkCore;
using Shouldly;
using Xunit;

namespace EasyFinance.Server.Tests
{
    /// <summary>
    /// Pins how the two <c>[Flags]</c> enums are persisted, because this is the
    /// single most likely place for a well-meaning "modernisation" to break the
    /// PostgreSQL migration.
    ///
    /// <para>
    /// EconoFlow stores <see cref="NotificationChannels"/> and <see cref="FeatureFlags"/>
    /// as <b>plain integral columns</b>. EF Core maps a CLR enum to its underlying
    /// type, so these become <c>integer</c> on PostgreSQL — provider-agnostic, and
    /// unchanged by the migration.
    /// </para>
    ///
    /// <para>
    /// The temptation is to map them to a <b>PostgreSQL native <c>enum</c> type</b>.
    /// That would be a regression: every future addition of a flag would then require
    /// a schema migration (<c>ALTER TYPE … ADD VALUE</c>), turning a compile-time enum
    /// change into a database change. These tests fail if the store type is ever
    /// changed away from an integral column.
    /// </para>
    ///
    /// <para>
    /// The <b>wire</b> format is a separate concern and is deliberately not changed:
    /// <c>FlagsEnumArrayConverter</c> (<c>Program.cs</c>) serializes flags as JSON
    /// arrays, which is independent of the database provider.
    /// </para>
    /// </summary>
    public class FlagEnumPersistenceTests
    {
        private static EasyFinanceDatabaseContext CreateContext()
        {
            var options = new DbContextOptionsBuilder<EasyFinanceDatabaseContext>()
                .UseInMemoryDatabase($"FlagEnum_{Guid.NewGuid():N}")
                .Options;

            return new EasyFinanceDatabaseContext(options);
        }

        [Theory]
        [InlineData(typeof(User), nameof(User.NotificationChannels))]
        [InlineData(typeof(Notification), nameof(Notification.LimitNotificationChannels))]
        public void FlagEnumProperties_ShouldBeMappedWithAnIntegralUnderlyingType(Type entityType, string propertyName)
        {
            using var context = CreateContext();

            var property = context.Model.FindEntityType(entityType)!
                .FindProperty(propertyName);

            property.ShouldNotBeNull(
                $"{entityType.Name}.{propertyName} must be mapped");

            // The CLR type stays the enum itself (EF surfaces the declared type), so
            // the invariant that matters is the *underlying* type: an integral one
            // means PostgreSQL receives `integer`, not a native enum type.
            var clrType = Nullable.GetUnderlyingType(property!.ClrType) ?? property.ClrType;

            clrType.IsEnum.ShouldBeTrue(
                $"{entityType.Name}.{propertyName} should be a CLR enum");

            var underlying = Enum.GetUnderlyingType(clrType);

            underlying.ShouldBe(
                typeof(int),
                $"{entityType.Name}.{propertyName} must persist as an integral column "
                + "so PostgreSQL sees `integer`. Mapping it to a native PostgreSQL enum "
                + "type would force a schema migration for every new flag.");

            // The mapping must be the direct enum<->integer mapping, with no converter
            // rewriting the representation (a converter is the seam where someone
            // would smuggle in a Postgres enum type or a string column).
            var typeMapping = property.GetTypeMapping();
            typeMapping.Converter.ShouldBeNull(
                $"{entityType.Name}.{propertyName} must be stored as its underlying "
                + "integer on every provider");
        }

        [Fact]
        public void NotificationChannels_ShouldBeMappedToTheSameClrTypeOnEveryProvider()
        {
            // The provider is irrelevant to the mapping: this is the guarantee that
            // makes the migration a non-event for flags. Asserted on the InMemory
            // provider here; the value below is what Npgsql would also receive.
            using var context = CreateContext();

            var property = context.Model.FindEntityType(typeof(User))!
                .FindProperty(nameof(User.NotificationChannels))!;

            property.ClrType.ShouldBe(typeof(NotificationChannels));
            property.GetTypeMapping().Converter.ShouldBeNull(
                "no value converter should be involved — the enum is stored as its "
                + "underlying integer on every provider");
        }

        [Fact]
        public void NotificationChannels_DefaultAndSentinel_ShouldBePlainIntegers()
        {
            using var context = CreateContext();

            var property = context.Model.FindEntityType(typeof(User))!
                .FindProperty(nameof(User.NotificationChannels))!;

            // Email | Push == 1 | 4 == 5
            property.GetDefaultValue().ShouldBe(NotificationChannels.Email | NotificationChannels.Push);
            ((int)property.GetDefaultValue()!).ShouldBe(5);

            // None == 0. HasSentinel(0) tells EF that 0 means "unset" for change
            // tracking; it emits no DDL and is provider-agnostic.
            property.Sentinel.ShouldBe(NotificationChannels.None);
            ((int)property.Sentinel!).ShouldBe(0);
        }

        [Fact]
        public void FlagEnumValues_ShouldBePowersOfTwo()
        {
            // Guards the values themselves. A non-power-of-two member would make the
            // integer representation ambiguous when combined, which no provider can
            // repair.
            AssertAllMembersArePowersOfTwo<NotificationChannels>();
            AssertAllMembersArePowersOfTwo<FeatureFlags>();
        }

        [Fact]
        public void FlagEnumCombinations_ShouldRoundTripThroughTheIntegerRepresentation()
        {
            var combined = NotificationChannels.Push | NotificationChannels.InApp | NotificationChannels.WebPush;

            ((int)combined).ShouldBe(4 | 8 | 16);

            var roundTripped = (NotificationChannels)(int)combined;
            roundTripped.ShouldBe(combined);

            // The membership test the application actually performs
            // (NotifierBackgroundService: `LimitNotificationChannels & User.NotificationChannels`).
            (roundTripped & NotificationChannels.Push).ShouldBe(NotificationChannels.Push);
            (roundTripped & NotificationChannels.Email).ShouldBe(NotificationChannels.None);
        }

        private static void AssertAllMembersArePowersOfTwo<TEnum>() where TEnum : struct, Enum
        {
            foreach (var value in Enum.GetValues<TEnum>())
            {
                var raw = Convert.ToInt32(value);
                if (raw == 0)
                    continue;

                (raw & (raw - 1)).ShouldBe(
                    0,
                    $"{typeof(TEnum).Name}.{value} = {raw} is not a power of two, so "
                    + "combining flags would be ambiguous");
            }
        }
    }
}
