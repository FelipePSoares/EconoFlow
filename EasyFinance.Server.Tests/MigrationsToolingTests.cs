using System;
using System.IO;
using FluentAssertions;
using Xunit;

namespace EasyFinance.Server.Tests
{
    /// <summary>
    /// Guards the migration tooling itself, which the PostgreSQL-only consolidation
    /// silently took with it.
    ///
    /// <para>
    /// The design-time factories (<c>EasyFinanceDatabaseContextFactory</c>,
    /// <c>MyKeysDesignTimeDbContextFactory</c>) implement
    /// <c>IDesignTimeDbContextFactory</c> from the <c>Microsoft.EntityFrameworkCore.Design</c>
    /// package. That package arrived transitively with the deleted
    /// <c>EasyFinance.Persistence.Postgres</c> project, so nobody had to reference it
    /// explicitly. With that project gone, <c>EasyFinance.Persistence</c> imports the
    /// namespace <c>Microsoft.EntityFrameworkCore.Design</c> — its <i>own</i> namespace —
    /// and compiles, while <c>dotnet ef</c> refuses to run:
    /// </para>
    ///
    /// <code>
    /// Your startup project 'EasyFinance.Persistence' doesn't reference
    /// Microsoft.EntityFrameworkCore.Design. This package is required for the Entity
    /// Framework Core Tools to work.
    /// </code>
    ///
    /// <para>
    /// The consequence is not cosmetic: no migration can be generated until it is fixed,
    /// and the documentation's first migration command — copied unchanged from the
    /// CLAUDE.md quick reference — fails. These are file-level assertions because the
    /// package is a build input of the tooling, not something loadable at test run time.
    /// </para>
    /// </summary>
    public class MigrationsToolingTests
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

        private static string PersistenceProject() =>
            File.ReadAllText(Path.Combine(
                RepoRoot(),
                "EasyFinance.Persistence",
                "EasyFinance.Persistence.csproj"));

        [Fact]
        public void PersistenceProject_ShouldReferenceTheEfCoreDesignPackage()
        {
            // The project holds the DbContexts, both design-time factories and both
            // migration sets, so it is also the project `dotnet ef` is run against.
            PersistenceProject().Should().Contain(
                "Microsoft.EntityFrameworkCore.Design",
                "dotnet ef refuses to run against a startup project that does not "
                + "reference Microsoft.EntityFrameworkCore.Design; the package used to "
                + "arrive transitively from the deleted EasyFinance.Persistence.Postgres "
                + "project");
        }

        [Fact]
        public void TheDocumentedMigrationCommand_ShouldPassTheDesignTimeCheck()
        {
            // The check `dotnet ef` performs before doing any work. Without the design
            // package it stops here regardless of the command that follows, so the
            // documented command cannot have been re-run since the consolidation.
            var project = PersistenceProject();

            (project.Contains("Microsoft.EntityFrameworkCore.Design", StringComparison.Ordinal)
                || File.ReadAllText(Path.Combine(
                    RepoRoot(),
                    "Directory.Build.props"))
                    .Contains("Microsoft.EntityFrameworkCore.Design", StringComparison.Ordinal))
                .Should().BeTrue(
                    "`dotnet ef migrations add ... --project EasyFinance.Persistence "
                    + "--startup-project EasyFinance.Persistence` is the command CLAUDE.md "
                    + "documents, and it must be runnable after the consolidation");
        }
    }
}
