using System;
using System.IO;
using System.Linq;
using FluentAssertions;
using Xunit;

namespace EasyFinance.Server.Tests
{
    /// <summary>
    /// Guards the requirements the Alpine runtime puts on the application.
    ///
    /// <para>
    /// The Debian ASP.NET image carried full ICU and a time-zone database. The plain Alpine
    /// one carries neither, and sets <c>DOTNET_SYSTEM_GLOBALIZATION_INVARIANT=true</c>: the
    /// runtime then throws <c>Could not find a part of the path '/usr/share/zoneinfo'</c> on
    /// the first <c>TimeZoneInfo</c> lookup. The application converts times for display and
    /// computes "today" from the clock, so moving to Alpine is a decision about globalization,
    /// not only about image size — and it has to be made in two places at once, or the image
    /// builds and then fails at start-up.
    /// </para>
    /// </summary>
    public class AlpineRuntimeTests
    {
        private static string RepoRoot()
        {
            var directory = new DirectoryInfo(AppContext.BaseDirectory);

            while (directory != null)
            {
                if (File.Exists(Path.Combine(directory.FullName, "EasyFinance.sln")))
                    return directory.FullName;

                directory = directory.Parent;
            }

            throw new InvalidOperationException(
                $"Could not locate the repository root above '{AppContext.BaseDirectory}'.");
        }

        private static string Read(params string[] parts) =>
            File.ReadAllText(Path.Combine([RepoRoot(), .. parts]));

        [Fact]
        public void TheApplication_ShouldNotOptIntoGlobalizationInvariantMode()
        {
            // The property overrides the base image's environment variable, so this is what
            // decides whether the published application gets ICU. Without it the Alpine
            // default applies and every culture-aware call falls back to invariant behaviour.
            var csproj = Read("EasyFinance.Server", "EasyFinance.Server.csproj");

            csproj.Should().Contain(
                "<InvariantGlobalization>false</InvariantGlobalization>",
                "the application formats currency and dates for the user's culture");

            csproj.Should().Contain(
                "<InvariantTimezone>false</InvariantTimezone>",
                "a time zone database has to be loadable, or TimeZoneInfo throws on Alpine");
        }

        [Fact]
        public void TheImage_ShouldUseTheRuntimeVariantThatHasIcuAndTzdata()
        {
            // The `-extra` variant of the Alpine runtime-deps image is the one that installs
            // icu-libs, icu-data-full and tzdata. The plain `alpine` tag sets
            // DOTNET_SYSTEM_GLOBALIZATION_INVARIANT and ships no zone database - right for a
            // service that only speaks numbers, wrong for this one. "Alpine" alone is not the
            // requirement; "Alpine with the dependencies this application needs" is.
            var dockerfile = string.Join(
                "\n",
                Read("Dockerfile")
                    .Split('\n')
                    .Where(line => !line.TrimStart().StartsWith("#", StringComparison.Ordinal)));

            dockerfile.Should().Contain(
                "mcr.microsoft.com/dotnet/aspnet:10.0-alpine-extra",
                "the plain Alpine tag has neither ICU nor tzdata: without them TimeZoneInfo "
                + "throws at the first culture-aware or time-zone-aware call");

            // ...and the dev image runs the same runtime, or the stack a developer tests on is
            // not the runtime the release image ships.
            Read("docker", "Dockerfile.dev").Should().Contain(
                "mcr.microsoft.com/dotnet/aspnet:10.0-alpine-extra",
                "the Development image must run the same runtime as the release image");
        }
    }
}
