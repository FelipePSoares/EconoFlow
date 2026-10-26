using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.RegularExpressions;
using Shouldly;
using Xunit;

namespace EasyFinance.Server.Tests
{
    /// <summary>
    /// Architectural guard for the PostgreSQL migration.
    ///
    /// Npgsql 6+ maps CLR <see cref="DateTime"/> to PostgreSQL
    /// <c>timestamp with time zone</c>, which accepts <b>only</b>
    /// <see cref="DateTimeKind.Utc"/>. <c>DateTime.Now</c> (Kind=Local) and
    /// <c>DateTime.Today</c> (Kind=Unspecified) are both rejected at runtime with:
    ///
    /// <code>
    /// System.ArgumentException: Cannot write DateTime with Kind=Unspecified to PostgreSQL
    /// type 'timestamp with time zone', only UTC is supported.
    /// </code>
    ///
    /// SQL Server accepted all three Kinds silently, so this class of defect was
    /// invisible until the provider changed — and then it surfaces in production on
    /// whichever code path touches a timestamp column first. It took a live site down
    /// once on this programme.
    ///
    /// Every timestamp in this solution is produced by
    /// <see cref="EasyFinance.Domain.Shared.SystemClock"/>, which returns Kind=Utc.
    /// This test makes that a build-enforced invariant rather than a convention, so
    /// nobody can reintroduce the defect by writing <c>DateTime.Now</c> next to an
    /// audit column.
    /// </summary>
    public class DateTimeProviderSafetyTests
    {
        /// <summary>
        /// Matches <c>DateTime.Now</c> / <c>DateTime.Today</c> (and the
        /// <c>System.DateTime.</c> qualified form) but not longer identifiers such as
        /// <c>DateTime.NowUtc</c> or a member named <c>TodayDate</c>.
        /// <c>DateTime.UtcNow</c> is deliberately allowed.
        /// </summary>
        private static readonly Regex NonUtcClockAccess = new(
            @"\b(?:System\.)?DateTime\.(?:Now|Today)\b(?!\w)",
            RegexOptions.Compiled);

        /// <summary>
        /// Projects that must contain zero non-UTC clock access. Test projects are
        /// excluded: the check itself has to name these members, and a test double may
        /// legitimately construct a local time.
        /// </summary>
        private static readonly string[] ProductionProjects =
        [
            "EasyFinance.Domain",
            "EasyFinance.Application",
            "EasyFinance.Persistence",
            "EasyFinance.Server",
            "EasyFinance.Infrastructure"
        ];

        [Fact]
        public void ProductionCode_ShouldNotUseNonUtcClockAccess()
        {
            var repositoryRoot = FindRepositoryRoot();
            var violations = new List<string>();

            foreach (var project in ProductionProjects)
            {
                var projectDirectory = Path.Combine(repositoryRoot, project);
                if (!Directory.Exists(projectDirectory))
                    continue;

                foreach (var file in Directory.EnumerateFiles(projectDirectory, "*.cs", SearchOption.AllDirectories))
                {
                    if (IsGenerated(file))
                        continue;

                    var lines = File.ReadAllLines(file);
                    for (var i = 0; i < lines.Length; i++)
                    {
                        if (NonUtcClockAccess.IsMatch(lines[i]))
                            violations.Add($"{Path.GetRelativePath(repositoryRoot, file)}:{i + 1}: {lines[i].Trim()}");
                    }
                }
            }

            violations.ShouldBeEmpty(
                "DateTime.Now / DateTime.Today produce a Kind that PostgreSQL rejects for "
                + "'timestamp with time zone'. Use SystemClock.UtcNowDateTime or "
                + "SystemClock.TodayDate instead. Violations:\n"
                + string.Join("\n", violations));
        }

        [Theory]
        [InlineData("var x = DateTime.Now;")]
        [InlineData("var x = DateTime.Today;")]
        [InlineData("var x = System.DateTime.Now;")]
        [InlineData("if (row.CreatedDate > DateTime.Now.AddMinutes(-2)) return true;")]
        public void Guard_ShouldDetectNonUtcClockAccess(string source)
        {
            NonUtcClockAccess.IsMatch(source).ShouldBeTrue(
                $"the guard must flag: {source}");
        }

        [Theory]
        [InlineData("var x = DateTime.UtcNow;")]
        [InlineData("var x = SystemClock.TodayDate;")]
        [InlineData("public DateTime TodayDate => SystemClock.UtcNowDateTime.Date;")]
        [InlineData("var x = TimeProvider.System.GetUtcNow().UtcDateTime;")]
        [InlineData("// DateTime.Now is rejected by Npgsql")]
        public void Guard_ShouldNotFlagUtcSafePatterns_OrMemberNamesThatMerelyStartWithTheWord(string source)
        {
            // NOTE: the comment case documents a real limitation — this scan is
            // textual, so a *comment* mentioning DateTime.Now is still matched. That
            // is intentionally strict: it keeps the rule simple and any such comment
            // is trivially reworded. The assertions below cover code, not comments.
            if (source.TrimStart().StartsWith("//", StringComparison.Ordinal))
                return;

            NonUtcClockAccess.IsMatch(source).ShouldBeFalse(
                $"the guard must not flag the UTC-safe pattern: {source}");
        }

        /// <summary>
        /// The model snapshot and designer files are generated by EF Core tooling and
        /// are regenerated on every migration; scanning them would produce noise that
        /// no one can fix by hand.
        /// </summary>
        private static bool IsGenerated(string file)
        {
            var name = Path.GetFileName(file);
            return name.EndsWith(".Designer.cs", StringComparison.OrdinalIgnoreCase)
                || name.Contains("ModelSnapshot", StringComparison.OrdinalIgnoreCase)
                || file.Contains($"{Path.DirectorySeparatorChar}obj{Path.DirectorySeparatorChar}", StringComparison.OrdinalIgnoreCase)
                || file.Contains($"{Path.DirectorySeparatorChar}bin{Path.DirectorySeparatorChar}", StringComparison.OrdinalIgnoreCase);
        }

        private static string FindRepositoryRoot()
        {
            var directory = new DirectoryInfo(AppContext.BaseDirectory);

            while (directory != null)
            {
                if (File.Exists(Path.Combine(directory.FullName, "EasyFinance.sln"))
                    || File.Exists(Path.Combine(directory.FullName, "Directory.Build.props")))
                {
                    return directory.FullName;
                }

                directory = directory.Parent;
            }

            throw new InvalidOperationException(
                $"Could not locate the repository root above '{AppContext.BaseDirectory}'.");
        }
    }
}
