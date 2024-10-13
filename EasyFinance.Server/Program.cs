using EasyFinance.Application;
using EasyFinance.Application.Contracts.Persistence;
using EasyFinance.Domain.Models.AccessControl;
using EasyFinance.Domain.Models.Financial;
using EasyFinance.Domain.Models.FinancialProject;
using EasyFinance.Persistence;
using EasyFinance.Persistence.DatabaseContext;
using EasyFinance.Server.Config;
using EasyFinance.Server.Extensions;
using EasyFinance.Server.Middleware;
using EasyFinance.Server.MiddleWare;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.UI.Services;
using Microsoft.AspNetCore.Mvc.Authorization;
using Newtonsoft.Json.Converters;
using SendGrid.Extensions.DependencyInjection;
using Serilog;
using System.Net;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddPersistenceServices(builder.Configuration);
builder.Services.AddApplicationServices();

builder.Services.AddTransient<IEmailSender, EmailSender>();


// Add services to the container.
builder.Services.AddControllers(config =>
{
    var policy = new AuthorizationPolicyBuilder()
                     .RequireAuthenticatedUser()
                     .Build();
    config.Filters.Add(new AuthorizeFilter(policy));
})
    .AddNewtonsoftJson(setup =>
        setup.SerializerSettings.Converters.Add(new StringEnumConverter()));

// Learn more about configuring Swagger/OpenAPI at https://aka.ms/aspnetcore/swashbuckle
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwagger();

builder.Services.AddAuthorizationBuilder();
builder.Services.AddHttpContextAccessor();

builder.Services
    .AddAuthentication(IdentityConstants.ApplicationScheme)
    .AddIdentityCookies();

builder.Services.ConfigureApplicationCookie(options =>
    {
        options.Cookie.SameSite = SameSiteMode.Strict;
        options.Cookie.Name = "AuthCookie";
        options.ExpireTimeSpan = TimeSpan.FromDays(7);
        options.Events.OnRedirectToAccessDenied = UnAuthorizedResponse;
        options.Events.OnRedirectToLogin = UnAuthorizedResponse;
    });

builder.Services.AddIdentityCore<User>()
    .AddEntityFrameworkStores<EasyFinanceDatabaseContext>()
    .AddClaimsPrincipalFactory<CustomClaimsPrincipalFactory>()
    .AddApiEndpoints();

builder.Services.Configure<IdentityOptions>(options =>
{
    // Password settings.
    options.Password.RequireDigit = true;
    options.Password.RequireLowercase = true;
    options.Password.RequireUppercase = true;
    options.Password.RequireNonAlphanumeric = true;
    options.Password.RequiredLength = 8;

    // Lockout settings.
    options.Lockout.DefaultLockoutTimeSpan = TimeSpan.FromMinutes(5);
    options.Lockout.MaxFailedAccessAttempts = 5;
    options.Lockout.AllowedForNewUsers = true;

    // Default SignIn settings.
    options.SignIn.RequireConfirmedEmail = false;
    options.User.RequireUniqueEmail = true;
});

builder.Services.AddSendGrid(options =>
    options.ApiKey = Environment.GetEnvironmentVariable("SENDGRID_API_KEY")
);

builder.Host.UseSerilog((context, configuration) =>
    configuration.ReadFrom.Configuration(context.Configuration));

var app = builder.Build();

app.UseDefaultFiles();
app.UseStaticFiles();

app.MapGroup("/api/account")
    .MapIdentityApi<User>()
    .WithTags("AccessControl");

app.UseSerilogRequestLogging();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();

    using var serviceScope = app.Services.CreateScope();
    var unitOfWork = serviceScope.ServiceProvider.GetRequiredService<IUnitOfWork>();
    var userManager = serviceScope.ServiceProvider.GetRequiredService<UserManager<User>>();

    var user = new User("Teste", "Admin", true)
    {
        UserName = "teste@teste.com",
        Email = "teste@teste.com",
        EmailConfirmed = true
    };
    userManager.CreateAsync(user, "Passw0rd!").GetAwaiter().GetResult();

    var income = new Income("Salário", DateTime.Now, 3000, user);
    unitOfWork.IncomeRepository.InsertOrUpdate(income);

    var income2 = new Income("Salário", DateTime.Now.AddMonths(-1), 3000, user);
    unitOfWork.IncomeRepository.InsertOrUpdate(income2);

    var expense = new Expense("Aluguel", DateTime.Now, 700, user, budget: 700);
    unitOfWork.ExpenseRepository.InsertOrUpdate(expense);

    var expense2 = new Expense("Mercado", DateTime.Now, 0, user, budget: 450);
    var expenseItem = new ExpenseItem("Pingo Doce", DateTime.Now, 100, user);
    var expenseItem2 = new ExpenseItem("Continente", DateTime.Now, 150, user);
    expense2.AddItem(expenseItem);
    expense2.AddItem(expenseItem2);
    unitOfWork.ExpenseRepository.InsertOrUpdate(expense2);

    var category = new Category("Custos Fixos");
    category.AddExpense(expense);
    category.AddExpense(expense2);
    unitOfWork.CategoryRepository.InsertOrUpdate(category);

    var project = new Project(name: "Família", type: ProjectType.Personal);
    project.AddIncome(income);
    project.AddIncome(income2);
    project.AddCategory(category);
    unitOfWork.ProjectRepository.InsertOrUpdate(project);

    var userProject = new UserProject(user, project, Role.Admin);
    unitOfWork.UserProjectRepository.InsertOrUpdate(userProject);

    unitOfWork.CommitAsync().GetAwaiter().GetResult();
}
else
{
    app.UseMigration();
    app.MapHealthChecks("/healthcheck/readness");
}

app.UseHttpsRedirection();

app.UseAuthorization();
app.UseProjectAuthorization();

app.MapControllers();

app.MapFallbackToFile("/index.html");

app.UseCustomExceptionHandler();

app.Run();

static Task UnAuthorizedResponse(RedirectContext<CookieAuthenticationOptions> context)
{
    context.Response.StatusCode = (int)HttpStatusCode.Unauthorized;
    return Task.CompletedTask;
}