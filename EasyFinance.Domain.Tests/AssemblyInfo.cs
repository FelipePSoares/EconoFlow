using Xunit;

// SystemClock.Provider is mutable static state. Tests that swap the clock (ExpenseTests,
// NotificationTests, SystemClockTests) would otherwise race with every other test class that
// reads it through domain validation, which is what made the date-boundary tests flaky.
[assembly: CollectionBehavior(DisableTestParallelization = true)]
