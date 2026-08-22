using System;

namespace EasyFinance.Domain.Shared
{
    /// <summary>
    /// Provides a single, swappable source of "now" for the application.
    /// Defaults to <see cref="TimeProvider.System"/> but can be replaced in tests
    /// with a deterministic fake, eliminating time-dependent test failures.
    /// </summary>
    public static class SystemClock
    {
        private static TimeProvider provider = TimeProvider.System;

        /// <summary>The current <see cref="TimeProvider"/> in use by the application.</summary>
        public static TimeProvider Provider
        {
            get => provider;
            set => provider = value ?? throw new ArgumentNullException(nameof(value));
        }

        /// <summary>Gets a <see cref="DateTimeOffset"/> whose date and time reflect the current instant (UTC).</summary>
        public static DateTimeOffset UtcNow => provider.GetUtcNow();

        /// <summary>Gets the current UTC <see cref="DateTime"/>.</summary>
        public static DateTime UtcNowDateTime => provider.GetUtcNow().UtcDateTime;

        /// <summary>Gets today's date in UTC, with the time component set to 00:00:00.</summary>
        public static DateTime Today => provider.GetUtcNow().UtcDateTime.Date;

        /// <summary>Gets today's <see cref="DateOnly"/> in UTC.</summary>
        public static DateOnly TodayDate => DateOnly.FromDateTime(provider.GetUtcNow().UtcDateTime);

        /// <summary>Resets the clock back to the system clock.</summary>
        public static void Reset() => provider = TimeProvider.System;
    }
}
