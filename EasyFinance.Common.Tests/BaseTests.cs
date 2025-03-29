using System.Collections.Generic;
using System;
using System.Linq;
using AutoFixture;
using EasyFinance.Application.Contracts.Persistence;
using EasyFinance.Application.Features.ProjectService;
using EasyFinance.Common.Tests.AccessControl;
using EasyFinance.Common.Tests.Financial;
using EasyFinance.Common.Tests.FinancialProject;
using EasyFinance.Domain.AccessControl;
using EasyFinance.Domain.Financial;
using EasyFinance.Domain.FinancialProject;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.DependencyInjection;
using EasyFinance.Persistence.DatabaseContext;
using Microsoft.EntityFrameworkCore;
using EasyFinance.Persistence.Repositories;
using Xunit;
using EasyFinance.Application.Features.IncomeService;
using EasyFinance.Application.Features.ExpenseService;
using EasyFinance.Application.Features.ExpenseItemService;

namespace EasyFinance.Common.Tests
{
    public class BaseTests
    {
        private readonly object fixtureLock = new();
        private Fixture? fixture;

        protected ServiceProvider serviceProvider;
        protected User user1;
        protected User user2;
        protected User user3;
        protected Project project1;
        protected Project project2;
        protected Project project3;

        protected Fixture Fixture
        {
            get
            {
                lock (fixtureLock)
                {
                    if (fixture == null)
                    {
                        fixture = new Fixture();
                        fixture.Behaviors.OfType<ThrowingRecursionBehavior>().ToList().ForEach(b => fixture.Behaviors.Remove(b));
                        fixture.Behaviors.Add(new OmitOnRecursionBehavior());
                    }

                    return fixture;
                }
            }
        }

        protected void PrepareInMemoryDatabase()
        {
            var services = new ServiceCollection();
            services.AddDbContext<EasyFinanceDatabaseContext>(options =>
                options.UseInMemoryDatabase("TestDb"));

            services.AddScoped<IUnitOfWork, UnitOfWork>();
            services.AddScoped<IProjectService, ProjectService>();
            services.AddScoped<IExpenseService, ExpenseService>();
            services.AddScoped<IExpenseItemService, ExpenseItemService>();
            services.AddScoped<IIncomeService, IncomeService>();

            services.AddIdentityCore<User>()
                    .AddEntityFrameworkStores<EasyFinanceDatabaseContext>();

            serviceProvider = services.BuildServiceProvider();

            using var scope = serviceProvider.CreateScope();
            var scopedServices = scope.ServiceProvider;
            var unitOfWork = scopedServices.GetRequiredService<IUnitOfWork>();
            var userManager = scopedServices.GetRequiredService<UserManager<User>>();
            var context = scopedServices.GetRequiredService<EasyFinanceDatabaseContext>();

            context.Database.EnsureDeleted();

            user1 = new UserBuilder().Build();
            userManager.CreateAsync(user1, "Passw0rd!").GetAwaiter().GetResult();
            user2 = new UserBuilder().Build();
            userManager.CreateAsync(user2, "Passw0rd!").GetAwaiter().GetResult();
            user3 = new UserBuilder().Build();
            userManager.CreateAsync(user3, "Passw0rd!").GetAwaiter().GetResult();

            var expenseItem1 = new ExpenseItemBuilder().AddName("Expense Item").AddCreatedBy(user3).AddDate(DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-1))).Build();
            var expense1 = new ExpenseBuilder().AddName("Expense").AddCreatedBy(user2).AddDate(DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-1))).Build();
            expense1.SetItems([expenseItem1]);
            var category1 = new CategoryBuilder().AddName("Category").AddExpenses(new List<Expense>() { expense1 }).Build();
            var income1 = new IncomeBuilder().AddName("Income").AddCreatedBy(user1).AddDate(DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-1))).Build();
            project1 = unitOfWork.ProjectRepository.InsertOrUpdate(new ProjectBuilder().AddCategory(category1).AddIncome(income1).Build()).Data;

            var expenseItem2 = new ExpenseItemBuilder().AddName("Expense Item").AddCreatedBy(user2).AddDate(DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-1))).Build();
            var expense2 = new ExpenseBuilder().AddName("Expense").AddCreatedBy(user1).AddDate(DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-1))).Build();
            expense2.SetItems([expenseItem2]);
            var category2 = new CategoryBuilder().AddName("Category").AddExpenses(new List<Expense>() { expense2 }).Build();
            var income2 = new IncomeBuilder().AddName("Income").AddCreatedBy(user2).AddDate(DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-1))).Build();
            project2 = unitOfWork.ProjectRepository.InsertOrUpdate(new ProjectBuilder().AddCategory(category2).AddIncome(income2).Build()).Data;

            var expenseItem3 = new ExpenseItemBuilder().AddName("Expense Item").AddCreatedBy(user1).AddDate(DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-1))).Build();
            var expense3 = new ExpenseBuilder().AddName("Expense").AddCreatedBy(user3).AddDate(DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-1))).Build();
            expense3.SetItems([expenseItem3]);
            var category3 = new CategoryBuilder().AddName("Category").AddExpenses(new List<Expense>() { expense3 }).Build();
            var income3 = new IncomeBuilder().AddName("Income").AddCreatedBy(user3).AddDate(DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-1))).Build();
            project3 = unitOfWork.ProjectRepository.InsertOrUpdate(new ProjectBuilder().AddCategory(category3).AddIncome(income3).Build()).Data;

            unitOfWork.UserProjectRepository.InsertOrUpdate(new UserProjectBuilder().AddProject(project1).AddUser(user1).AddRole(Role.Admin).AddAccepted().Build());
            unitOfWork.UserProjectRepository.InsertOrUpdate(new UserProjectBuilder().AddProject(project2).AddUser(user1).AddRole(Role.Admin).AddAccepted().Build());
            unitOfWork.UserProjectRepository.InsertOrUpdate(new UserProjectBuilder().AddProject(project3).AddUser(user1).AddRole(Role.Admin).AddAccepted().Build());

            unitOfWork.UserProjectRepository.InsertOrUpdate(new UserProjectBuilder().AddProject(project1).AddUser(user2).AddRole(Role.Manager).AddAccepted().Build());
            unitOfWork.UserProjectRepository.InsertOrUpdate(new UserProjectBuilder().AddProject(project2).AddUser(user2).AddRole(Role.Viewer).AddAccepted().Build());
            unitOfWork.UserProjectRepository.InsertOrUpdate(new UserProjectBuilder().AddProject(project3).AddUser(user2).AddRole(Role.Admin).AddAccepted().Build());

            unitOfWork.UserProjectRepository.InsertOrUpdate(new UserProjectBuilder().AddProject(project1).AddUser(user3).AddRole(Role.Viewer).AddAccepted().Build());
            unitOfWork.UserProjectRepository.InsertOrUpdate(new UserProjectBuilder().AddProject(project2).AddUser(user3).AddRole(Role.Viewer).AddAccepted().Build());
            unitOfWork.UserProjectRepository.InsertOrUpdate(new UserProjectBuilder().AddProject(project3).AddUser(user3).AddRole(Role.Viewer).AddAccepted().Build());

            unitOfWork.CommitAsync();
        }

        public static TheoryData<DateOnly> OlderDates =>
            [
                DateOnly.FromDateTime(DateTime.Today.ToUniversalTime().AddYears(-5).AddDays(-2)),
                DateOnly.FromDateTime(DateTime.Today.ToUniversalTime().AddYears(-15)),
                DateOnly.FromDateTime(DateTime.Today.ToUniversalTime().AddYears(-200))
            ];

        public static TheoryData<DateOnly> FutureDates =>
            [
                DateOnly.FromDateTime(DateTime.Today.ToUniversalTime().AddDays(2)),
                DateOnly.FromDateTime(DateTime.Today.ToUniversalTime().AddDays(5))
            ];
    }
}
