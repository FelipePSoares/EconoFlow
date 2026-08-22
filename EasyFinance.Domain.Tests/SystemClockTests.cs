using System;
using EasyFinance.Common.Tests;
using EasyFinance.Domain.Shared;
using FluentAssertions;

namespace EasyFinance.Domain.Tests
{
    public class SystemClockTests
    {
        [Fact]
        public void UtcNow_WithoutCustomProvider_UsesSystemTime()
        {
            // Act
            var now = SystemClock.UtcNow;

            // Assert
            now.Should().BeCloseTo(DateTimeOffset.UtcNow, TimeSpan.FromSeconds(10));
        }

        [Fact]
        public void WithCustomTimeProvider_ReturnsFakeMomentAndResets()
        {
            // Arrange
            var fake = new FakeTimeProvider(new DateTimeOffset(2024, 6, 15, 12, 0, 0, TimeSpan.Zero));
            SystemClock.Provider = fake;

            try
            {
                // Act / Assert
                SystemClock.UtcNowDateTime.Should().Be(new DateTime(2024, 6, 15, 12, 0, 0, DateTimeKind.Utc));
                SystemClock.TodayDate.Should().Be(new DateOnly(2024, 6, 15));
                SystemClock.UtcNow.Should().Be(new DateTimeOffset(2024, 6, 15, 12, 0, 0, TimeSpan.Zero));
            }
            finally
            {
                SystemClock.Reset();
            }

            // After reset the system clock is used again
            SystemClock.UtcNow.Should().BeCloseTo(DateTimeOffset.UtcNow, TimeSpan.FromSeconds(10));
        }

        [Fact]
        public void Provider_ShouldNotAcceptNull()
        {
            // Act
            var act = () => SystemClock.Provider = null!;

            // Assert
            act.Should().Throw<ArgumentNullException>();
        }
    }
}
