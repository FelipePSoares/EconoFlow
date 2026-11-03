using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using EasyFinance.Application.Contracts.Persistence;
using EasyFinance.Domain.AccessControl;
using EasyFinance.Domain.Shared;
using EasyFinance.Persistence.DatabaseContext;
using EasyFinance.Persistence.Repositories;
using FluentAssertions;
using FpsSoftware.Chassis;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Xunit;

namespace EasyFinance.Server.Tests
{
    /// <summary>
    /// Runs <c>DevelopmentTestDataSeeder</c> for real, against a relational-shaped store.
    ///
    /// <para>
    /// <b>The stack was unusable, and no test noticed.</b> The seeder created its two users
    /// through <c>UserManager</c>, which saves them in its OWN <c>DbContext</c>, then added
    /// <see cref="UserProject"/> rows that reference those users to a context that never
    /// tracked them. Against the in-memory store that passes - it has no foreign keys - but
    /// against PostgreSQL the users arrive as untracked inserts with empty ids and
    /// <c>SaveChangesAsync</c> throws:
    /// </para>
    ///
    /// <code>
    /// System.InvalidOperationException: The value of 'IdentityUserRole&lt;Guid&gt;.UserId' is
    /// unknown when attempting to save changes. This is because the property is also part of a
    /// foreign key for which the principal entity in the relationship is not known.
    /// </code>
    ///
    /// <para>
    /// Reproduced with <c>docker compose -f docker-compose.dev.yml up --build -d</c>: the app
    /// container restarted forever and the stack never served a request. The existing tests
    /// guarded the seeder's <i>policy</i> (<see cref="DevelopmentSeederSafetyTests"/>) but
    /// never ran it, so the fixture's own graph was unverified.
    /// </para>
    ///
    /// <para>
    /// These tests call the seeder the way <c>Program.cs</c> does and then assert on what a
    /// caller would actually observe: it reports success, and the users it reports are the
    /// principals of the data it wrote. The service graph below is the minimum the seeder
    /// resolves - the database context and a <c>UserManager</c> - so nothing else can
    /// mask the graph bug.
    /// </para>
    /// </summary>
    public class DevelopmentTestDataSeederGraphTests
    {
        /// <summary>
        /// A store that fails like a relational one for the shape of bug here: it refuses a
        /// dependent whose principal was never made known to it, i.e. the
        /// <c>IdentityUserRole.UserId</c> failure. The in-memory provider accepts anything, so
        /// using it alone would keep this test green while the container crash-loops.
        /// </summary>
        private sealed class TrackingPrincipalEnforcingInterceptor : SaveChangesInterceptor
        {
            public override InterceptionResult<int> SavingChanges(
                DbContextEventData eventData,
                InterceptionResult<int> result)
            {
                ThrowIfAnEntityIsSavedWithAnEmptyKey(eventData.Context);
                return result;
            }

            public override ValueTask<InterceptionResult<int>> SavingChangesAsync(
                DbContextEventData eventData,
                InterceptionResult<int> result,
                CancellationToken cancellationToken = default)
            {
                ThrowIfAnEntityIsSavedWithAnEmptyKey(eventData.Context);
                return ValueTask.FromResult(result);
            }

            private static void ThrowIfAnEntityIsSavedWithAnEmptyKey(DbContext? context)
            {
                if (context is null)
                    return;

                var unsavedPrincipals = context.ChangeTracker
                    .Entries<User>()
                    .Where(entry => entry.State == EntityState.Added && entry.Property(nameof(User.Id)).CurrentValue is Guid id && id == Guid.Empty)
                    .Select(entry => entry.Entity.UserName)
                    .ToList();

                if (unsavedPrincipals.Count > 0)
                {
                    throw new InvalidOperationException(
                        "The value of 'IdentityUserRole<Guid>.UserId' is unknown when attempting to "
                        + "save changes. This is because the property is also part of a foreign key "
                        + "for which the principal entity in the relationship is not known. "
                        + $"Unknown users: {string.Join(", ", unsavedPrincipals)}");
                }
            }
        }

        private static ServiceProvider BuildSeederServices(string databaseName)
        {
            var services = new ServiceCollection();

            services.AddLogging(logging => logging.SetMinimumLevel(LogLevel.Warning));
            services.AddDbContext<EasyFinanceDatabaseContext>((serviceProvider, options) =>
                options
                    .UseInMemoryDatabase(databaseName)
                    .AddInterceptors(new TrackingPrincipalEnforcingInterceptor()));
            services.AddScoped<IUnitOfWork, UnitOfWork>();
            services.AddIdentityCore<User>()
                    .AddRoles<IdentityRole<Guid>>()
                    .AddEntityFrameworkStores<EasyFinanceDatabaseContext>();

            return services.BuildServiceProvider();
        }

        [Fact]
        public async Task SeedAsync_ShouldSucceed()
        {
            var databaseName = $"SeederGraph_{Guid.NewGuid():N}";
            await using var provider = BuildSeederServices(databaseName);

            using (var scope = provider.CreateScope())
            {
                var context = scope.ServiceProvider.GetRequiredService<EasyFinanceDatabaseContext>();
                await context.Database.EnsureCreatedAsync();

                // Program.cs creates the system roles before seeding (the fixture user is made a
                // BetaTester), so the test starts from the same state.
                var roleManager = scope.ServiceProvider.GetRequiredService<RoleManager<IdentityRole<Guid>>>();
                if (!await roleManager.RoleExistsAsync(SystemRoles.BetaTester))
                {
                    await roleManager.CreateAsync(new IdentityRole<Guid>(SystemRoles.BetaTester));
                }
            }

            var result = await EasyFinance.Server.Config.DevelopmentTestDataSeeder.SeedAsync(provider);

            result.Succeeded.Should().BeTrue(
                "the container restarts forever when the seeder throws on SaveChangesAsync; "
                + "a failed start-up must be reported by the seeder, not by the exception "
                + $"that killed the process. Errors: {DescribeMessages(result)}");
        }

        [Fact]
        public async Task SeedAsync_ShouldReportTheUsersItCreated()
        {
            // The caller needs the users to know what was seeded - Program.cs logs them, and a
            // test proves the fixture exists without guessing user names from the source.
            var databaseName = $"SeederGraph_{Guid.NewGuid():N}";
            await using var provider = BuildSeederServices(databaseName);

            using (var scope = provider.CreateScope())
            {
                var context = scope.ServiceProvider.GetRequiredService<EasyFinanceDatabaseContext>();
                await context.Database.EnsureCreatedAsync();

                // Program.cs creates the system roles before seeding (the fixture user is made a
                // BetaTester), so the test starts from the same state.
                var roleManager = scope.ServiceProvider.GetRequiredService<RoleManager<IdentityRole<Guid>>>();
                if (!await roleManager.RoleExistsAsync(SystemRoles.BetaTester))
                {
                    await roleManager.CreateAsync(new IdentityRole<Guid>(SystemRoles.BetaTester));
                }
            }

            var result = await EasyFinance.Server.Config.DevelopmentTestDataSeeder.SeedAsync(provider);

            result.Data.Should().NotBeEmpty(
                "the seeder creates the fixture user the end-to-end suite signs in as");
        }

        [Fact]
        public async Task SeedAsync_ShouldMakeTheSeededUsersThePrincipalsOfTheDataItWrites()
        {
            // THE REGRESSION. Every row the seeder writes that names a user - the UserProject
            // memberships, and each expense/income's CreatedBy - has to be written in the same
            // unit of work that created that user. Otherwise the store is asked to save a
            // dependent whose principal it has never seen, which PostgreSQL rejects outright
            // and which silently produces orphan/duplicate user rows when it does not.
            var databaseName = $"SeederGraph_{Guid.NewGuid():N}";
            await using var provider = BuildSeederServices(databaseName);

            using (var scope = provider.CreateScope())
            {
                var context = scope.ServiceProvider.GetRequiredService<EasyFinanceDatabaseContext>();
                await context.Database.EnsureCreatedAsync();

                // Program.cs creates the system roles before seeding (the fixture user is made a
                // BetaTester), so the test starts from the same state.
                var roleManager = scope.ServiceProvider.GetRequiredService<RoleManager<IdentityRole<Guid>>>();
                if (!await roleManager.RoleExistsAsync(SystemRoles.BetaTester))
                {
                    await roleManager.CreateAsync(new IdentityRole<Guid>(SystemRoles.BetaTester));
                }
            }

            var result = await EasyFinance.Server.Config.DevelopmentTestDataSeeder.SeedAsync(provider);

            result.Succeeded.Should().BeTrue(
                $"the fixture graph has to persist as one unit of work. Errors: {DescribeMessages(result)}");

            using (var scope = provider.CreateScope())
            {
                var context = scope.ServiceProvider.GetRequiredService<EasyFinanceDatabaseContext>();

                // One user row per seeded user: a re-added principal with a fresh empty id
                // would put extra rows here, or none at all if the save never happened.
                foreach (var user in result.Data)
                {
                    var persisted = await context.Users
                        .SingleOrDefaultAsync(candidate => candidate.UserName == user.UserName);

                    persisted.Should().NotBeNull();
                    persisted!.Id.Should().Be(user.Id,
                        "the id the seeder reports must be the id the store has, or every row "
                        + "that references the user points at nothing");
                }

                var userIds = result.Data.Select(u => u.Id).ToList();

                var memberships = await context.Set<UserProject>()
                    .IgnoreQueryFilters()
                    .Where(userProject => userProject.User != null)
                    .Select(userProject => userProject.User.Id)
                    .ToListAsync();

                memberships.Should().NotBeEmpty(
                    "the seeded project is shared with the fixture users, and the end-to-end "
                    + "suite signs in as one of them");

                memberships.Should().OnlyContain(id => userIds.Contains(id),
                    "a membership must reference a seeded user, never a phantom row created "
                    + "because the principal was not tracked");
            }
        }

        /// <summary>
        /// The fixture user must be findable the way the login finds a customer.
        ///
        /// <para>
        /// <b>Every mobile end-to-end spec signs in as <c>test1@test.com</c>, and could not.</b>
        /// <c>AccessControlController.ValidateSignInAsync</c> resolves the customer with
        /// <c>UserManager.FindByEmailAsync</c>, which queries <c>NormalizedEmail</c> — the
        /// column Identity fills in <c>CreateAsync</c>/<c>UpdateAsync</c>, and nowhere else.
        /// The seeder writes its users with <c>context.Add</c> (that is the #1118 fix), so
        /// <c>NormalizedEmail</c> and <c>NormalizedUserName</c> were written as <c>NULL</c>:
        /// the row exists, the password hash is correct, and every login still answers
        /// <c>401 InvalidCredentials</c>. On screen that is
        /// <c>"Incorrect login information!"</c>, which reads exactly like a bad password.
        /// </para>
        ///
        /// <para>
        /// Confirmed against the dev stack before the fix — the two users disagreed:
        /// </para>
        ///
        /// <code>
        ///  Email          | NormalizedEmail | NormalizedUserName
        ///  test@test.com  | TEST@TEST.COM   | TEST@TEST.COM
        ///  test1@test.com | &lt;NULL&gt;          | &lt;NULL&gt;
        /// </code>
        ///
        /// <para>
        /// The in-memory store does not normalize either, so this test fails for the same
        /// reason the dev stack did rather than passing on a lenient provider.
        /// </para>
        /// </summary>
        [Fact]
        public async Task SeedAsync_ShouldWriteUsersTheLoginCanFind()
        {
            var databaseName = $"SeederGraph_{Guid.NewGuid():N}";
            await using var provider = BuildSeederServices(databaseName);

            await PrepareRolesAsync(provider);

            var result = await EasyFinance.Server.Config.DevelopmentTestDataSeeder.SeedAsync(provider);

            result.Succeeded.Should().BeTrue($"Errors: {DescribeMessages(result)}");

            using (var scope = provider.CreateScope())
            {
                var context = scope.ServiceProvider.GetRequiredService<EasyFinanceDatabaseContext>();
                var userManager = scope.ServiceProvider.GetRequiredService<UserManager<User>>();

                foreach (var seeded in result.Data)
                {
                    // Exactly what ValidateSignInAsync does.
                    var found = await userManager.FindByEmailAsync(seeded.Email!);

                    found.Should().NotBeNull(
                        $"{seeded.Email} is a fixture the end-to-end suite signs in as, and "
                        + "UserManager.FindByEmailAsync only matches a user whose NormalizedEmail "
                        + "is populated — a row written straight through the DbContext has none");

                    found!.Id.Should().Be(seeded.Id);

                    var foundByName = await userManager.FindByNameAsync(seeded.UserName!);

                    foundByName.Should().NotBeNull(
                        $"{seeded.UserName} must also be findable by user name, which Identity "
                        + "matches through NormalizedUserName");
                }
            }
        }

        /// <summary>
        /// The columns the lookup depends on hold Identity's normalized form of the values.
        ///
        /// <para>
        /// Asserted on the stored row, not only through the manager: the columns are what a
        /// later <c>FindByEmailAsync</c> reads, and a test that only went through the manager
        /// could be satisfied by a mock or a coincidental case-insensitive comparison.
        /// </para>
        /// </summary>
        [Fact]
        public async Task SeedAsync_ShouldStoreTheNormalizedNameAndEmail()
        {
            var databaseName = $"SeederGraph_{Guid.NewGuid():N}";
            await using var provider = BuildSeederServices(databaseName);

            await PrepareRolesAsync(provider);

            var result = await EasyFinance.Server.Config.DevelopmentTestDataSeeder.SeedAsync(provider);

            result.Succeeded.Should().BeTrue($"Errors: {DescribeMessages(result)}");

            using (var scope = provider.CreateScope())
            {
                var context = scope.ServiceProvider.GetRequiredService<EasyFinanceDatabaseContext>();
                // The same service Identity's UserManager normalizes with.
                var normalizer = scope.ServiceProvider.GetRequiredService<ILookupNormalizer>();

                var persisted = await context.Users.ToListAsync();

                persisted.Should().HaveCount(result.Data.Count());

                foreach (var user in persisted)
                {
                    user.NormalizedEmail.Should().Be(
                        normalizer.NormalizeEmail(user.Email),
                        "Identity's email lookup is an exact match on this column");

                    user.NormalizedUserName.Should().Be(
                        normalizer.NormalizeName(user.UserName),
                        "Identity's user-name lookup is an exact match on this column");
                }
            }
        }

        /// <summary>
        /// Creates the system roles the seeder assigns, the way
        /// <c>Program.cs</c> does before it seeds.
        /// </summary>
        private static async Task PrepareRolesAsync(ServiceProvider provider)
        {
            using var scope = provider.CreateScope();
            var context = scope.ServiceProvider.GetRequiredService<EasyFinanceDatabaseContext>();
            await context.Database.EnsureCreatedAsync();

            var roleManager = scope.ServiceProvider.GetRequiredService<RoleManager<IdentityRole<Guid>>>();
            if (!await roleManager.RoleExistsAsync(SystemRoles.BetaTester))
            {
                await roleManager.CreateAsync(new IdentityRole<Guid>(SystemRoles.BetaTester));
            }
        }

        private static string DescribeMessages(AppResponse response) =>
            response is null
                ? "(no response)"
                : string.Join(" | ", response.Messages.Select(message => message.Description));
    }
}
