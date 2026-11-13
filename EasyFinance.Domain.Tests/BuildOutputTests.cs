using System;
using System.IO;
using FluentAssertions;

namespace EasyFinance.Domain.Tests
{
    /// <summary>
    /// The test output must not carry a *.runtimeconfig.dev.json.
    ///
    /// When that file exists VSTest resolves testhost.dll from the additionalProbingPaths it
    /// holds. The dev file this repository's build produces carries no probing paths at all, and
    /// VSTest 18.7.1 -- the one bundled with .NET SDK 10.0.404 on the Linux runners -- throws
    /// NullReferenceException in DotnetTestHostManager.GetTestHostPath before a single test runs:
    /// the run aborts as "0 passed, 1 failed and 0 skipped" with no failing test, which reads like
    /// a broken suite rather than a broken host lookup. Without the file VSTest falls back to the
    /// testhost.dll that already sits next to the test assembly, and the same binaries pass.
    ///
    /// Directory.Build.props pins GenerateRuntimeConfigDevFile to false -- the SDK's own
    /// post-net6.0 default, which the Linux build did not honour here -- so builds started in this
    /// repository do not write the file; the unit-tests job also drops it from the downloaded
    /// artifact before running the tests.
    /// </summary>
    public class BuildOutputTests
    {
        [Fact]
        public void TestOutput_ShouldNotContainRuntimeConfigDevFile()
        {
            // Act
            var devFiles = Directory.GetFiles(
                AppContext.BaseDirectory,
                "*.runtimeconfig.dev.json",
                SearchOption.TopDirectoryOnly);

            // Assert
            devFiles.Should().BeEmpty(
                "VSTest aborts the whole run with a NullReferenceException when a runtimeconfig.dev.json without probing paths sits next to the test assembly");
        }
    }
}
