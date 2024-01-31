using System.Security.Claims;
using EasyFinance.Domain.Models.AccessControl;
using EasyFinance.Server.Context;
using EasyFinance.Server.Extensions;
using Microsoft.AspNetCore.Authentication.BearerToken;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc.Authorization;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddControllers(config =>
{
    var policy = new AuthorizationPolicyBuilder()
                     .RequireAuthenticatedUser()
                     .Build();
    config.Filters.Add(new AuthorizeFilter(policy));
});

// Learn more about configuring Swagger/OpenAPI at https://aka.ms/aspnetcore/swashbuckle
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwagger();

builder.Services.AddAuthorizationBuilder();

#if DEBUG
builder.Services.AddDbContext<AppDbContext>(
    options => options.UseInMemoryDatabase("AppDb"));
#else
builder.Services.AddHealthChecks()
    .AddSqlServer(Environment.GetEnvironmentVariable("EasyFinanceDB"));

builder.Services.AddDbContext<AppDbContext>(
    options => options.UseSqlServer(Environment.GetEnvironmentVariable("EasyFinanceDB")));
#endif

builder.Services
    .AddAuthentication(IdentityConstants.ApplicationScheme)
    .AddIdentityCookies();

builder.Services.AddIdentityCore<User>()
    .AddEntityFrameworkStores<AppDbContext>()
    .AddClaimsPrincipalFactory<CustomClaimsPrincipalFactory>()
    .AddApiEndpoints();

builder.Services.Configure<IdentityOptions>(options =>
{
    // Default Password settings.
    options.Password.RequireDigit = true;
    options.Password.RequireLowercase = true;
    options.Password.RequireUppercase = true;
    options.Password.RequireNonAlphanumeric = true;
    options.Password.RequiredLength = 8;
    // Default SignIn settings.
    options.SignIn.RequireConfirmedEmail = false;
    options.User.RequireUniqueEmail = true;
});

var app = builder.Build();

app.UseDefaultFiles();
app.UseStaticFiles();

app.MapGroup("/api/account")
    .MapIdentityApi<User>()
    .WithTags("AccessControl");

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

#if (!DEBUG)
using (var serviceScope = app.Services.CreateScope())
{
    var dbContext = serviceScope.ServiceProvider.GetRequiredService<AppDbContext>();
    dbContext.Database.Migrate();
}

app.MapHealthChecks("/healthcheck/readness");
#endif

app.UseHttpsRedirection();

app.UseAuthorization();

app.MapControllers();

app.MapFallbackToFile("/index.html");

app.Run();
