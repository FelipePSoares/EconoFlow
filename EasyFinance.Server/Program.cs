using System.Globalization;
using System.Net;
using EasyFinance.Application;
using EasyFinance.Application.BackgroundServices.NotifierBackgroundService;
using EasyFinance.Application.Contracts.Persistence;
using EasyFinance.Application.Features.WebPushService;
using EasyFinance.Domain.AccessControl;
using EasyFinance.Domain.Account;
using EasyFinance.Domain.Financial;
using EasyFinance.Domain.FinancialProject;
using EasyFinance.Persistence;
using EasyFinance.Persistence.DatabaseContext;
using EasyFinance.Server.Config;
using EasyFinance.Server.Extensions;
using EasyFinance.Server.Middleware;
using EasyFinance.Server.MiddleWare;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.UI.Services;
using Microsoft.AspNetCore.Mvc.Authorization;
using Newtonsoft.Json.Converters;
using Serilog;
using Smtp2Go.Api;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddHttpContextAccessor();
builder.Services.AddPersistenceServices(builder.Configuration);
builder.Services.AddApplicationServices();
builder.Services.Configure<NotifierFallbackOptions>(builder.Configuration.GetSection(NotifierFallbackOptions.SectionName));
builder.Services.Configure<WebPushOptions>(builder.Configuration.GetSection(WebPushOptions.SectionName));
builder.Services.AddAuthenticationServices(builder.Configuration, builder.Environment);
builder.Services.AddTransient<IEmailSender, EmailSender>();

// Add services to the container.
builder.Services.AddControllers(config =>
{
    var policy = new AuthorizationPolicyBuilder()
                     .RequireAuthenticatedUser()
                     .Build();
    config.Filters.Add(new AuthorizeFilter(policy));
    config.SuppressAsyncSuffixInActionNames = false; 
})
    .AddNewtonsoftJson(setup =>
    {
        setup.SerializerSettings.Converters.Add(new FlagsEnumArrayConverter());
        setup.SerializerSettings.Converters.Add(new StringEnumConverter());
    });

// Learn more about configuring Swagger/OpenAPI at https://aka.ms/aspnetcore/swashbuckle
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwagger();

builder.Services.AddSingleton<IApiService, Smtp2GoApiService>(x 
    => new Smtp2GoApiService(Environment.GetEnvironmentVariable("SMTP2GO_API_KEY") ?? "api-ADEE6A33004F4B178E20CEB4096CA4EA"));

builder.Host.UseSerilog((context, configuration) =>
    configuration.ReadFrom.Configuration(context.Configuration));

builder.Services.AddHsts(options =>
{
    options.Preload = true;
    options.IncludeSubDomains = true;
    options.MaxAge = TimeSpan.FromDays(365);
});

builder.Services.AddHttpsRedirection(options =>
{
    options.RedirectStatusCode = (int)HttpStatusCode.TemporaryRedirect;
    options.HttpsPort = 443;
});

if (!builder.Environment.IsDevelopment())
{
    var keys = builder.Services.AddDataProtection()
        .PersistKeysToDbContext<MyKeysContext>();

    if (bool.TryParse(Environment.GetEnvironmentVariable("EconoFlow_KEY_ENCRYPT_ACTIVE"), out var result) && result)
        keys.ProtectKeysWithDpapi(false);
}

try
{
    var app = builder.Build();
    app.UseSerilogRequestLogging();
    app.UseCustomExceptionHandler();

    app.UseSafeHeaders();

    if (app.Environment.IsDevelopment())
    {
        app.UseSwagger();
        app.UseSwaggerUI();

        using var serviceScope = app.Services.CreateScope();
        var unitOfWork = serviceScope.ServiceProvider.GetRequiredService<IUnitOfWork>();
        var userManager = serviceScope.ServiceProvider.GetRequiredService<UserManager<User>>();
        var today = DateOnly.FromDateTime(DateTime.Today);
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
        userManager.CreateAsync(user, "Passw0rd!").GetAwaiter().GetResult();

        var user2 = new User(firstName: "Second", lastName: "User", enabled: true)
        {
            UserName = "test1@test.com",
            Email = "test1@test.com",
            EmailConfirmed = true
        };
        user2.SetLanguageCode("en");
        userManager.CreateAsync(user2, "Passw0rd!").GetAwaiter().GetResult();

        var notification = new Notification(user, "WelcomeMessage", NotificationType.Information, NotificationCategory.System, limitNotificationChannels: NotificationChannels.InApp);
        unitOfWork.NotificationRepository.Insert(notification);
        var notification2 = new Notification(user, "ConfirmEmailMessage", NotificationType.EmailConfirmation, NotificationCategory.Security, "ButtonConfirmEmail", NotificationChannels.InApp, isSticky: true, isActionRequired: true);
        unitOfWork.NotificationRepository.Insert(notification2);
        var notification3 = new Notification(user, "LanguagePreferenceNowAvailableMessage", NotificationType.Information, NotificationCategory.System, "ButtonMyProfile", NotificationChannels.InApp);
        unitOfWork.NotificationRepository.Insert(notification3);
        var notification5 = new Notification(user, "TwoFactorNowAvailableAnnouncementMessage", NotificationType.Information, NotificationCategory.Security, "ButtonConfigureTwoFactor", metadata: $"{{\"firstName\":\"{user.FirstName}\"}}", isSticky: false);
        notification5.MarkEmailAsSent();
        unitOfWork.NotificationRepository.Insert(notification5);
        var notification6 = new Notification(user, "EnableTwoFactorRecommendationMessage", NotificationType.Information, NotificationCategory.Security, "ButtonConfigureTwoFactor", NotificationChannels.InApp, isSticky: false);
        unitOfWork.NotificationRepository.Insert(notification6);

        var income = new Income("Investiments", today, 3000, user);
        income.SetId(new Guid("0bb277f9-a858-4306-148f-08dcf739f7a1"));
        unitOfWork.IncomeRepository.Insert(income);

        var income2 = new Income("Investiments", today.AddMonths(-1), 3000, user);
        unitOfWork.IncomeRepository.Insert(income2);

        var expense = new Expense("Rent", today, 700, user, budget: 700);
        unitOfWork.ExpenseRepository.Insert(expense);

        var expense2 = new Expense("Groceries", today, 0, user, budget: 450);
        var expenseItem = new ExpenseItem("Pingo Doce", today, 100, user);
        expenseItem.SetId(new Guid("16ddf6c1-6b33-4563-dac4-08dcf73a4157"));
        var expenseItem2 = new ExpenseItem("Continente", today, 150, user);
        expense2.SetId(new Guid("75436cec-70f6-420f-ee8a-08dce6424079"));
        expense2.AddItem(expenseItem);
        expense2.AddItem(expenseItem2);
        unitOfWork.ExpenseRepository.Insert(expense2);

        var category = new Category("Fixed Costs", displayOrder: 0);
        category.SetId(new Guid("ac795272-1ee2-456c-1fa2-08dcbc8250c1"));
        category.AddExpense(expense);
        category.AddExpense(expense2);
        unitOfWork.CategoryRepository.Insert(category);

        var ri = new RegionInfo("pt");
        var project = new Project(name: "Family", preferredCurrency: ri.ISOCurrencySymbol);
        project.SetId(new Guid("bf060bc8-48bf-4f5b-3761-08dc54ba19f4"));
        project.AddIncome(income);
        project.AddIncome(income2);
        project.AddCategory(category);
        unitOfWork.ProjectRepository.Insert(project);

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
            unitOfWork.CategoryRepository.Insert(recommendedCategory);
        }

        const int monthsToSeed = 18;
        for (var monthsAgo = monthsToSeed; monthsAgo >= 0; monthsAgo--)
        {
            var monthDate = today.AddMonths(-monthsAgo);
            var trendFactor = 1m + ((monthsToSeed - monthsAgo) * 0.004m);

            var salaryAmount = Math.Round((5200m + random.Next(-120, 180)) * trendFactor, 2);
            var salary = new Income("Primary Salary", DateInMonth(monthDate, 5), salaryAmount, user);
            project.AddIncome(salary);
            unitOfWork.IncomeRepository.Insert(salary);

            var dividendsAmount = Math.Round((260m + random.Next(-35, 70)) * trendFactor, 2);
            var dividends = new Income("Dividends", DateInMonth(monthDate, 24), dividendsAmount, user);
            project.AddIncome(dividends);
            unitOfWork.IncomeRepository.Insert(dividends);

            decimal bonusAmount = 0m;
            if (monthDate.Month % 3 == 0)
            {
                bonusAmount = Math.Round((950m + random.Next(0, 550)) * trendFactor, 2);
                var quarterlyBonus = new Income("Quarterly Bonus", DateInMonth(monthDate, 18), bonusAmount, user);
                project.AddIncome(quarterlyBonus);
                unitOfWork.IncomeRepository.Insert(quarterlyBonus);
            }

            decimal freelanceAmount = 0m;
            if (monthsAgo % 2 == 0)
            {
                freelanceAmount = Math.Round((420m + random.Next(0, 460)) * trendFactor, 2);
                var freelance = new Income("Freelance Work", DateInMonth(monthDate, 12), freelanceAmount, user);
                project.AddIncome(freelance);
                unitOfWork.IncomeRepository.Insert(freelance);
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
                            seededExpense.AddItem(new ExpenseItem(itemName, itemDate, itemAmount, user));
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
                    unitOfWork.ExpenseRepository.Insert(seededExpense);
                }
            }
        }

        var userProject = new UserProject(user, project, Role.Admin);
        userProject.SetAccepted();
        unitOfWork.UserProjectRepository.Insert(userProject);

        var userProject2 = new UserProject(user2, project, Role.Manager);
        userProject2.SetAccepted();
        unitOfWork.UserProjectRepository.Insert(userProject2);

        unitOfWork.CommitAsync().GetAwaiter().GetResult();

        user.SetDefaultProject(project.Id);
        userManager.UpdateAsync(user).GetAwaiter().GetResult();
    }
    else
    {
        app.UseHsts();
        app.UseSecutiryPolicy();
        app.UseMigration();
    }

    app.UseDefaultFiles();
    app.UseStaticFiles();

    app.UseHttpsRedirection();

    app.UseAuthentication();
    app.UseCorrelationId();
    app.UseAuthorization();
    app.UseProjectAuthorization();

    app.UseLocationMiddleware();

    app.MapControllers();

    app.Run();
}
catch (Exception ex)
{
    Log.Fatal(ex, "The application fail during the start.");
}
finally
{
    Log.CloseAndFlush(); // Close and send all pendent logs to betterstack
}
