using System.Globalization;
using EasyFinance.Domain.AccessControl;
using EasyFinance.Domain.Account;
using EasyFinance.Domain.Financial;
using EasyFinance.Domain.FinancialProject;
using EasyFinance.Domain.Shared;
using EasyFinance.Persistence.DatabaseContext;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.DependencyInjection;

namespace EasyFinance.Server.Config
{
    public static class DevelopmentTestDataSeeder
    {
        /// <summary>
        /// Whether seeding must be skipped for the given provider.
        ///
        /// <para>
        /// The fixtures below are development scaffolding: a fixed set of users,
        /// projects and expenses. Running them against a real database duplicates rows
        /// over live data, or fails outright on the identities they assume are absent.
        /// </para>
        ///
        /// <para>
        /// This guard did not exist while provider selection was a compile-time
        /// <c>#if DEBUG</c> branch: a Debug build always received the in-memory store,
        /// so the seeder could not reach SQL Server even in principle. Once the provider
        /// became a runtime decision, running locally with <c>EasyFinanceDB</c> set gave
        /// Development a real PostgreSQL connection — and the seeder ran with it,
        /// failing start-up with <c>"The value of 'IdentityUserRole&lt;Guid&gt;.UserId'
        /// is unknown when attempting to save changes"</c>. So this is not defensive
        /// coding; it closes a hole the provider change opened.
        /// </para>
        ///
        /// <para>
        /// Exposed as a value rather than inlined at the call site so the rule is
        /// assertable. <c>DATETIME_KIND_TRAP.md</c> §2 records the same guard shape in
        /// CesarBarbosa (<c>if (!database.IsRelational || DevelopmentDataSeeder.IsForced)</c>).
        /// </para>
        /// </summary>
        public static bool IsUnsafeFor(DatabaseProviderInfo providerInfo)
            => providerInfo is not null && providerInfo.IsRelational;

        /// <summary>
        /// Writes the development fixtures.
        ///
        /// <para>
        /// <b>The fixtures are added to the change tracker, never through
        /// <c>IGenericRepository.Insert</c>.</b> That method calls <c>Add()</c> only under
        /// <c>#if DEBUG</c> and returns the entity untouched in a Release build, which is what
        /// every image is. A graph that references entities it has just "inserted" then loses
        /// its principals: against the in-memory store nothing noticed, because that store has
        /// no foreign keys. Against PostgreSQL the project was never written, and the last
        /// line — setting the user's default project — failed with
        /// <c>FK_AspNetUsers_Projects_DefaultProjectId</c>. <c>Program.cs</c> catches that as a
        /// fatal start-up error, so the container restarted, seeded nothing again, and exited
        /// again: the stack served 502 until the fixture's fixed user was removed.
        /// </para>
        ///
        /// <para>
        /// Adding through the context is what the production services rely on as well
        /// (<c>InsertOrUpdate</c> tracks), so the fixtures take the same path the application
        /// does. The single <c>SaveChangesAsync</c> at the end also makes the whole fixture a
        /// single transaction, so a failure leaves no half-seeded database behind.
        /// </para>
        /// </summary>
        public static async Task SeedAsync(IServiceProvider services)
        {
            using var serviceScope = services.CreateScope();
            var context = serviceScope.ServiceProvider.GetRequiredService<EasyFinanceDatabaseContext>();
            var userManager = serviceScope.ServiceProvider.GetRequiredService<UserManager<User>>();
            var today = SystemClock.TodayDate;
            var random = new Random(20260223);

            DateOnly DateInMonth(DateOnly date, int day)
            {
                var daysInMonth = DateTime.DaysInMonth(date.Year, date.Month);
                var maxAllowedDay = daysInMonth;

                if (date.Year == today.Year && date.Month == today.Month)
                {
                    maxAllowedDay = Math.Min(maxAllowedDay, today.Day);
                }

                var safeDay = Math.Max(1, Math.Min(day, maxAllowedDay));
                return new DateOnly(date.Year, date.Month, safeDay);
            }

            var user = new User(firstName: "Test", lastName: "Admin", enabled: true)
            {
                UserName = "test@test.com",
                Email = "test@test.com",
                EmailConfirmed = true
            };
            user.SetLanguageCode("en");
            await userManager.CreateAsync(user, "Passw0rd!");
            await userManager.AddToRoleAsync(user, SystemRoles.BetaTester);

            var user2 = new User(firstName: "Second", lastName: "User", enabled: true)
            {
                UserName = "test1@test.com",
                Email = "test1@test.com",
                EmailConfirmed = true
            };
            user2.SetLanguageCode("en");
            await userManager.CreateAsync(user2, "Passw0rd!");

            var notification = new Notification(user, "WelcomeMessage", NotificationType.Information, NotificationCategory.System, limitNotificationChannels: NotificationChannels.InApp);
            context.Add(notification);
            var notification2 = new Notification(user, "ConfirmEmailMessage", NotificationType.EmailConfirmation, NotificationCategory.Security, "ButtonConfirmEmail", NotificationChannels.InApp, isSticky: true, isActionRequired: true);
            context.Add(notification2);
            var notification3 = new Notification(user, "LanguagePreferenceNowAvailableMessage", NotificationType.Information, NotificationCategory.System, "ButtonMyProfile", NotificationChannels.InApp);
            context.Add(notification3);
            var notification5 = new Notification(user, "TwoFactorNowAvailableAnnouncementMessage", NotificationType.Information, NotificationCategory.Security, "ButtonConfigureTwoFactor", metadata: $"{{\"firstName\":\"{user.FirstName}\"}}", isSticky: false);
            notification5.MarkEmailAsSent();
            context.Add(notification5);
            var notification6 = new Notification(user, "EnableTwoFactorRecommendationMessage", NotificationType.Information, NotificationCategory.Security, "ButtonConfigureTwoFactor", NotificationChannels.InApp, isSticky: false);
            context.Add(notification6);

            var income = new Income("Investiments", today, 3000, user);
            income.SetId(new Guid("0bb277f9-a858-4306-148f-08dcf739f7a1"));
            context.Add(income);

            var income2 = new Income("Investiments", today.AddMonths(-1), 3000, user);
            context.Add(income2);

            var expense = new Expense("Rent", today, 700, user, budget: 700, isDeductible: true);
            context.Add(expense);

            var expense2 = new Expense("Groceries", today, 0, user, budget: 450);
            var expenseItem = new ExpenseItem("Pingo Doce", today, 100, user, isDeductible: true);
            expenseItem.SetId(new Guid("16ddf6c1-6b33-4563-dac4-08dcf73a4157"));
            var expenseItem2 = new ExpenseItem("Continente", today, 150, user);
            expense2.SetId(new Guid("75436cec-70f6-420f-ee8a-08dce6424079"));
            expense2.AddItem(expenseItem);
            expense2.AddItem(expenseItem2);
            context.Add(expense2);

            var category = new Category("Fixed Costs", displayOrder: 0);
            category.SetId(new Guid("ac795272-1ee2-456c-1fa2-08dcbc8250c1"));
            category.AddExpense(expense);
            category.AddExpense(expense2);
            context.Add(category);

            var ri = new RegionInfo("pt");
            var project = new Project(name: "Family", preferredCurrency: ri.ISOCurrencySymbol);
            project.SetId(new Guid("bf060bc8-48bf-4f5b-3761-08dc54ba19f4"));
            project.AddIncome(income);
            project.AddIncome(income2);
            project.AddCategory(category);
            context.Add(project);

            var defaultCategoryRecommendations = Category.GetAllDefaultCategories().ToArray();
            var categoriesByName = new Dictionary<string, Category>(StringComparer.OrdinalIgnoreCase)
            {
                [category.Name] = category
            };

            for (var categoryIndex = 0; categoryIndex < defaultCategoryRecommendations.Length; categoryIndex++)
            {
                var recommendedCategoryName = defaultCategoryRecommendations[categoryIndex].category.Name;
                if (string.Equals(recommendedCategoryName, category.Name, StringComparison.OrdinalIgnoreCase))
                {
                    category.SetDisplayOrder(categoryIndex);
                    continue;
                }

                var recommendedCategory = new Category(name: recommendedCategoryName, displayOrder: categoryIndex);
                categoriesByName[recommendedCategoryName] = recommendedCategory;
                project.AddCategory(recommendedCategory);
                context.Add(recommendedCategory);
            }

            const int monthsToSeed = 18;
            for (var monthsAgo = monthsToSeed; monthsAgo >= 0; monthsAgo--)
            {
                var monthDate = today.AddMonths(-monthsAgo);
                var trendFactor = 1m + ((monthsToSeed - monthsAgo) * 0.004m);

                var salaryAmount = Math.Round((5200m + random.Next(-120, 180)) * trendFactor, 2);
                var salary = new Income("Primary Salary", DateInMonth(monthDate, 5), salaryAmount, user);
                project.AddIncome(salary);
                context.Add(salary);

                var dividendsAmount = Math.Round((260m + random.Next(-35, 70)) * trendFactor, 2);
                var dividends = new Income("Dividends", DateInMonth(monthDate, 24), dividendsAmount, user);
                project.AddIncome(dividends);
                context.Add(dividends);

                decimal bonusAmount = 0m;
                if (monthDate.Month % 3 == 0)
                {
                    bonusAmount = Math.Round((950m + random.Next(0, 550)) * trendFactor, 2);
                    var quarterlyBonus = new Income("Quarterly Bonus", DateInMonth(monthDate, 18), bonusAmount, user);
                    project.AddIncome(quarterlyBonus);
                    context.Add(quarterlyBonus);
                }

                decimal freelanceAmount = 0m;
                if (monthsAgo % 2 == 0)
                {
                    freelanceAmount = Math.Round((420m + random.Next(0, 460)) * trendFactor, 2);
                    var freelance = new Income("Freelance Work", DateInMonth(monthDate, 12), freelanceAmount, user);
                    project.AddIncome(freelance);
                    context.Add(freelance);
                }

                var annualIncomeForBudget = (salaryAmount + dividendsAmount + (bonusAmount / 3m) + (freelanceAmount / 2m)) * 12m;
                foreach (var recommendation in defaultCategoryRecommendations)
                {
                    var recommendedCategoryName = recommendation.category.Name;
                    if (!categoriesByName.TryGetValue(recommendedCategoryName, out var targetCategory))
                    {
                        continue;
                    }

                    var categoryWithRecommendedExpenses = Category.CreateDefaultCategoryWithExpense(
                        user,
                        recommendedCategoryName,
                        recommendation.percentage,
                        annualIncomeForBudget,
                        monthDate);

                    foreach (var seededExpense in categoryWithRecommendedExpenses.Expenses)
                    {
                        var expenseDate = DateInMonth(monthDate, random.Next(4, 25));
                        seededExpense.SetDate(expenseDate);
                        var expectedAmount = Math.Round(seededExpense.Budget * (0.82m + (decimal)random.NextDouble() * 0.34m), 2);
                        var splitIntoItems = seededExpense.Budget >= 120 && random.NextDouble() >= 0.35;
                        var markExpenseAsDeductible = random.NextDouble() < 0.20;
                        seededExpense.SetIsDeductible(markExpenseAsDeductible);

                        if (splitIntoItems)
                        {
                            var remaining = expectedAmount;
                            var itemCount = random.Next(2, 5);
                            for (var itemIndex = 0; itemIndex < itemCount; itemIndex++)
                            {
                                var isLastItem = itemIndex == itemCount - 1;
                                decimal itemAmount;

                                if (isLastItem)
                                {
                                    itemAmount = remaining;
                                }
                                else
                                {
                                    var slotsLeft = itemCount - itemIndex;
                                    var averageAmount = remaining / slotsLeft;
                                    itemAmount = Math.Round(averageAmount * (0.75m + (decimal)random.NextDouble() * 0.5m), 2);
                                    itemAmount = Math.Max(1m, Math.Min(itemAmount, remaining));
                                }

                                remaining = Math.Round(remaining - itemAmount, 2);
                                var itemDay = 4 + ((itemIndex + 1) * 6) + random.Next(0, 3);
                                var itemDate = DateInMonth(monthDate, itemDay);
                                var itemName = $"{seededExpense.Name} #{itemIndex + 1}";
                                var markExpenseItemAsDeductible = !markExpenseAsDeductible && itemIndex == 0 && random.NextDouble() < 0.55;
                                seededExpense.AddItem(new ExpenseItem(itemName, itemDate, itemAmount, user, isDeductible: markExpenseItemAsDeductible));
                            }

                            if (remaining > 0)
                            {
                                seededExpense.AddItem(new ExpenseItem("Other", DateInMonth(monthDate, 27), remaining, user));
                            }
                        }
                        else
                        {
                            seededExpense.SetAmount(expectedAmount);
                        }

                        targetCategory.AddExpense(seededExpense);
                        context.Add(seededExpense);
                    }
                }
            }

            var userProject = new UserProject(user, project, Role.Admin);
            userProject.SetAccepted();
            context.Add(userProject);

            var userProject2 = new UserProject(user2, project, Role.Manager);
            userProject2.SetAccepted();
            context.Add(userProject2);

            await context.SaveChangesAsync();

            user.SetDefaultProject(project.Id);
            await userManager.UpdateAsync(user);
        }
    }
}
