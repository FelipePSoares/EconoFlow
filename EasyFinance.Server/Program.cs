using EasyFinance.Domain.Models.AccessControl;
using EasyFinance.Server.Context;
using EasyFinance.Server.Extensions;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.

builder.Services.AddControllers();
// Learn more about configuring Swagger/OpenAPI at https://aka.ms/aspnetcore/swashbuckle
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwagger();

builder.Services
    .AddAuthentication(IdentityConstants.ApplicationScheme)
    .AddIdentityCookies();

builder.Services.AddAuthorizationBuilder(); 

builder.Services.AddDbContext<AppDbContext>(
    options => options.UseInMemoryDatabase("AppDb"));

builder.Services.AddIdentityCore<User>()
    .AddEntityFrameworkStores<AppDbContext>()
    .AddApiEndpoints();

var app = builder.Build();

app.UseDefaultFiles();
app.UseStaticFiles();

app.MapGroup("/api/account").MapIdentityApi<User>()
    .WithTags("AccessControl");

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseHttpsRedirection();

app.UseAuthorization();

app.MapControllers();

app.MapFallbackToFile("/index.html");

app.Run();
