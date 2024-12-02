using EasyFinance.Application.Contracts.Persistence;
using EasyFinance.Application.Features.ProjectService;
using EasyFinance.Common.Tests.AccessControl;
using EasyFinance.Common.Tests.Financial;
using EasyFinance.Common.Tests.FinancialProject;
using EasyFinance.Domain.Models.AccessControl;
using EasyFinance.Domain.Models.Financial;
using EasyFinance.Domain.Models.FinancialProject;
using EasyFinance.Persistence.DatabaseContext;
using EasyFinance.Persistence.Repositories;
using FluentAssertions;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace EasyFinance.Application.Tests
{
    [Collection("Sequential")]
    public class ProjectServiceTests
    {
        private ServiceProvider serviceProvider;

        private readonly User user1;
        private readonly User user2;
        private readonly User user3;
        private readonly Project project1;
        private readonly Project project2;
        private readonly Project project3;

        public ProjectServiceTests()
        {
            var services = new ServiceCollection();
            services.AddDbContext<EasyFinanceDatabaseContext>(options =>
                options.UseInMemoryDatabase("TestDb"));

            services.AddScoped<IUnitOfWork, UnitOfWork>();
            services.AddScoped<IGenericRepository<Project>, GenericRepository<Project>>();
            services.AddScoped<IProjectService, ProjectService>();
            services.AddIdentityCore<User>()
                    .AddEntityFrameworkStores<EasyFinanceDatabaseContext>();

            serviceProvider = services.BuildServiceProvider();

            using var scope = this.serviceProvider.CreateScope();
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

            var expenseItem1 = new ExpenseItemBuilder().AddName("Expense Item").AddCreatedBy(user3).AddDate(DateTime.UtcNow.AddDays(-1)).Build();
            var expense1 = new ExpenseBuilder().AddName("Expense").AddCreatedBy(user2).AddDate(DateTime.UtcNow.AddDays(-1)).Build();
            expense1.SetItems([expenseItem1]);
            var category1 = new CategoryBuilder().AddName("Category").AddExpenses(new List<Expense>() { expense1 }).Build();

            project1 = unitOfWork.ProjectRepository.Insert(new ProjectBuilder().AddCategory(category1).Build());

            var expenseItem2 = new ExpenseItemBuilder().AddName("Expense Item").AddCreatedBy(user2).AddDate(DateTime.UtcNow.AddDays(-1)).Build();
            var expense2 = new ExpenseBuilder().AddName("Expense").AddCreatedBy(user1).AddDate(DateTime.UtcNow.AddDays(-1)).Build();
            expense2.SetItems([expenseItem2]);
            var category2 = new CategoryBuilder().AddName("Category").AddExpenses(new List<Expense>() { expense2 }).Build();
            project2 = unitOfWork.ProjectRepository.Insert(new ProjectBuilder().AddCategory(category2).Build());

            var expenseItem3 = new ExpenseItemBuilder().AddName("Expense Item").AddCreatedBy(user1).AddDate(DateTime.UtcNow.AddDays(-1)).Build();
            var expense3 = new ExpenseBuilder().AddName("Expense").AddCreatedBy(user3).AddDate(DateTime.UtcNow.AddDays(-1)).Build();
            expense3.SetItems([expenseItem3]);
            var category3 = new CategoryBuilder().AddName("Category").AddExpenses(new List<Expense>() { expense3 }).Build();
            project3 = unitOfWork.ProjectRepository.Insert(new ProjectBuilder().AddCategory(category3).Build());

            unitOfWork.UserProjectRepository.Insert(new UserProjectBuilder().AddProject(project1).AddUser(user1).AddRole(Role.Admin).Build());
            unitOfWork.UserProjectRepository.Insert(new UserProjectBuilder().AddProject(project2).AddUser(user1).AddRole(Role.Admin).Build());
            unitOfWork.UserProjectRepository.Insert(new UserProjectBuilder().AddProject(project3).AddUser(user1).AddRole(Role.Admin).Build());

            unitOfWork.UserProjectRepository.Insert(new UserProjectBuilder().AddProject(project1).AddUser(user2).AddRole(Role.Manager).Build());
            unitOfWork.UserProjectRepository.Insert(new UserProjectBuilder().AddProject(project2).AddUser(user2).AddRole(Role.Viewer).Build());
            unitOfWork.UserProjectRepository.Insert(new UserProjectBuilder().AddProject(project3).AddUser(user2).AddRole(Role.Admin).Build());

            unitOfWork.UserProjectRepository.Insert(new UserProjectBuilder().AddProject(project1).AddUser(user3).AddRole(Role.Viewer).Build());
            unitOfWork.UserProjectRepository.Insert(new UserProjectBuilder().AddProject(project2).AddUser(user3).AddRole(Role.Viewer).Build());
            unitOfWork.UserProjectRepository.Insert(new UserProjectBuilder().AddProject(project3).AddUser(user3).AddRole(Role.Viewer).Build());

            unitOfWork.CommitAsync();
        }

        [Fact]
        public async Task DeleteOrRemoveLinkAsync_RemoveUserSoleAdmin_ShouldDeleteProjects()
        {
            using var scope = this.serviceProvider.CreateScope();
            var scopedServices = scope.ServiceProvider;
            var projectService = scopedServices.GetRequiredService<IProjectService>();
            var unitOfWork = scopedServices.GetRequiredService<IUnitOfWork>();
            var userManager = scopedServices.GetRequiredService<UserManager<User>>();

            // Arrange
            // Act
            await projectService.DeleteOrRemoveLinkAsync(this.user1);

            // Assert
            var projects = unitOfWork.ProjectRepository.NoTrackable().ToList();
            projects.Should().HaveCount(1);
            projects.First().Should().NotBeNull();
            projects.First().Id.Should().Be(project3.Id);
        }

        [Fact]
        public async Task DeleteOrRemoveLinkAsync_RemoveOnlyViewerUser_ShouldKeepAllProjects()
        {
            using var scope = this.serviceProvider.CreateScope();
            var scopedServices = scope.ServiceProvider;
            var projectService = scopedServices.GetRequiredService<IProjectService>();
            var unitOfWork = scopedServices.GetRequiredService<IUnitOfWork>();

            // Arrange
            // Act
            await projectService.DeleteOrRemoveLinkAsync(this.user3);

            // Assert
            var projects = unitOfWork.ProjectRepository.NoTrackable().ToList();
            projects.Should().HaveCount(3);
        }

        [Fact]
        public async Task DeleteOrRemoveLinkAsync_RemoveNotSoleAdminUser_ShouldKeepAllProjects()
        {
            using var scope = this.serviceProvider.CreateScope();
            var scopedServices = scope.ServiceProvider;
            var projectService = scopedServices.GetRequiredService<IProjectService>();
            var unitOfWork = scopedServices.GetRequiredService<IUnitOfWork>();

            // Arrange
            // Act
            await projectService.DeleteOrRemoveLinkAsync(this.user2);

            // Assert
            var projects = unitOfWork.ProjectRepository.NoTrackable().ToList();
            projects.Should().HaveCount(3);
        }
    }
}
