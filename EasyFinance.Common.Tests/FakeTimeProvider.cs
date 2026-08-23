using System;

namespace EasyFinance.Common.Tests
{
    /// <summary>
    /// A deterministic <see cref="TimeProvider"/> for tests. Returns a fixed "now"
    /// so that date/time-dependent logic is reproducible regardless of the wall clock.
    /// </summary>
    public sealed class FakeTimeProvider : TimeProvider
    {
        private DateTimeOffset now;

        public FakeTimeProvider(DateTimeOffset now)
        {
            this.now = now;
        }

        public override DateTimeOffset GetUtcNow() => now;

        /// <summary>Moves the fake clock forward/backward by the given span.</summary>
        public void Advance(TimeSpan span) => now = now.Add(span);

        public DateTime Today => now.Date;
        public DateOnly TodayDate => DateOnly.FromDateTime(now.DateTime);
    }
}
