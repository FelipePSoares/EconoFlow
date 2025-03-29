using System.Globalization;
using EasyFinance.Application;
using EasyFinance.Application.Contracts.Persistence;
using EasyFinance.Domain.AccessControl;
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
using SendGrid.Extensions.DependencyInjection;
using Serilog;

var builder = WebApplication.CreateBuilder(args);

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
        setup.SerializerSettings.Converters.Add(new StringEnumConverter()));

// Learn more about configuring Swagger/OpenAPI at https://aka.ms/aspnetcore/swashbuckle
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwagger();

builder.Services.AddSendGrid(options =>
    options.ApiKey = Environment.GetEnvironmentVariable("SENDGRID_API_KEY") ?? "abc"
);

builder.Host.UseSerilog((context, configuration) =>
    configuration.ReadFrom.Configuration(context.Configuration));

if (!builder.Environment.IsDevelopment())
{
    var keys = builder.Services.AddDataProtection()
        .PersistKeysToDbContext<MyKeysContext>();

    if (bool.Parse(Environment.GetEnvironmentVariable("EconoFlow_KEY_ENCRYPT_ACTIVE")))
        keys.ProtectKeysWithCertificate(Environment.GetEnvironmentVariable("EconoFlow_CERT_THUMBPRINT"));
}

try
{
    var app = builder.Build();

    app.UseDefaultFiles();
    app.UseStaticFiles();

    app.UseSerilogRequestLogging();

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
        app.UseMigration();
    }

    app.UseHttpsRedirection();

    app.UseAuthorization();
    app.UseProjectAuthorization();

    app.UseLocationMiddleware();

    app.MapControllers();

    app.MapFallbackToFile("/index.html");

    app.UseCustomExceptionHandler();

    app.Run();
}
catch (Exception ex)
{
    Log.Fatal(ex, "A aplicação falhou ao iniciar.");
}
finally
{
    Log.CloseAndFlush(); // Fecha e envia todos os logs pendentes
}