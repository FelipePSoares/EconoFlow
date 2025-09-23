using System.Globalization;
using System.Net;
using EasyFinance.Application;
using EasyFinance.Application.Contracts.Persistence;
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

    if (bool.Parse(Environment.GetEnvironmentVariable("EconoFlow_KEY_ENCRYPT_ACTIVE")))
        keys.ProtectKeysWithDpapi(false);
}

try
{
    var app = builder.Build();
    app.UseCorrelationId();
    app.UseSerilogRequestLogging();
    app.UseCustomExceptionHandler();

    app.UseSafeHeaders();

    // Configure the HTTP request pipeline.
    if (app.Environment.IsDevelopment())
    {
        app.UseSwagger();
        app.UseSwaggerUI();

        using var serviceScope = app.Services.CreateScope();
        var unitOfWork = serviceScope.ServiceProvider.GetRequiredService<IUnitOfWork>();
        var userManager = serviceScope.ServiceProvider.GetRequiredService<UserManager<User>>();
        var user = new User(firstName: "Test", lastName: "Admin", enabled: true)
        {
            UserName = "test@test.com",
            Email = "test@test.com",
            EmailConfirmed = true
        };
        userManager.CreateAsync(user, "Passw0rd!").GetAwaiter().GetResult();

        var user2 = new User(firstName: "Second", lastName: "User", enabled: true)
        {
            UserName = "test1@test.com",
            Email = "test1@test.com",
            EmailConfirmed = true
        };
        userManager.CreateAsync(user2, "Passw0rd!").GetAwaiter().GetResult();

        var notification = new Notification(user, "WelcomeMessage", NotificationType.WelcomeMessage, NotificationCategory.System);
        unitOfWork.NotificationRepository.Insert(notification);
        var notification2 = new Notification(user, "ConfirmEmailMessage", NotificationType.EmailConfirmation, NotificationCategory.Security, "ButtonConfirmEmail");
        unitOfWork.NotificationRepository.Insert(notification2);

        var income = new Income("Investiments", DateOnly.FromDateTime(DateTime.Now), 3000, user);
        income.SetId(new Guid("0bb277f9-a858-4306-148f-08dcf739f7a1"));
        unitOfWork.IncomeRepository.Insert(income);

        var income2 = new Income("Investiments", DateOnly.FromDateTime(DateTime.Now.AddMonths(-1)), 3000, user);
        unitOfWork.IncomeRepository.Insert(income2);

        var expense = new Expense("Rent", DateOnly.FromDateTime(DateTime.Now), 700, user, budget: 700);
        unitOfWork.ExpenseRepository.Insert(expense);

        var expense2 = new Expense("Groceries", DateOnly.FromDateTime(DateTime.Now), 0, user, budget: 450);
        var expenseItem = new ExpenseItem("Pingo Doce", DateOnly.FromDateTime(DateTime.Now), 100, user);
        expenseItem.SetId(new Guid("16ddf6c1-6b33-4563-dac4-08dcf73a4157"));
        var expenseItem2 = new ExpenseItem("Continente", DateOnly.FromDateTime(DateTime.Now), 150, user);
        expense2.SetId(new Guid("75436cec-70f6-420f-ee8a-08dce6424079"));
        expense2.AddItem(expenseItem);
        expense2.AddItem(expenseItem2);
        unitOfWork.ExpenseRepository.Insert(expense2);

        var category = new Category("Fixed Costs");
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