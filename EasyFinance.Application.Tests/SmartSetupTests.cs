using EasyFinance.Application.Contracts.Persistence;
using EasyFinance.Application.DTOs.Financial;
using EasyFinance.Application.Features.ProjectService;
using EasyFinance.Common.Tests;
using EasyFinance.Common.Tests.AccessControl;
using EasyFinance.Common.Tests.FinancialProject;
using EasyFinance.Domain.AccessControl;
using EasyFinance.Domain.Financial;
using EasyFinance.Domain.FinancialProject;
using EasyFinance.Infrastructure;
using FluentAssertions;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace EasyFinance.Application.Tests
{
    [Collection("Sequential")]
    public class SmartSetupTests : BaseTests
    {
        public SmartSetupTests()
        {
            PrepareInMemoryDatabase();
        }

        private async Task<(IServiceScope scope, IProjectService projectService, IUnitOfWork unitOfWork, Guid projectId, User user)> CreateEmptyProjectAsync()
        {
            Guid projectId;
            User user;

            // Create project in a separate scope to avoid tracking conflicts
            using (var setupScope = this.serviceProvider.CreateScope())
            {
                var setupServices = setupScope.ServiceProvider;
                var setupUnitOfWork = setupServices.GetRequiredService<IUnitOfWork>();
                var userManager = setupServices.GetRequiredService<UserManager<User>>();

                user = new UserBuilder().Build();
                await userManager.CreateAsync(user, "Passw0rd!");

                var project = setupUnitOfWork.ProjectRepository.InsertOrUpdate(new ProjectBuilder().AddName("SmartSetup Test Project").Build()).Data;
                setupUnitOfWork.UserProjectRepository.InsertOrUpdate(new UserProjectBuilder().AddProject(project).AddUser(user).AddRole(Role.Admin).AddAccepted().Build());
                await setupUnitOfWork.CommitAsync();
                projectId = project.Id;
            }

            // Use a fresh scope for the actual test
            var scope = this.serviceProvider.CreateScope();
            var scopedServices = scope.ServiceProvider;
            var projectService = scopedServices.GetRequiredService<IProjectService>();
            var unitOfWork = scopedServices.GetRequiredService<IUnitOfWork>();

            return (scope, projectService, unitOfWork, projectId, user);
        }

        private SmartSetupRequestDTO CreateDefaultSmartSetupRequest(decimal annualIncome = 60000m, decimal? emergencyReserveTarget = null)
        {
            return new SmartSetupRequestDTO
            {
                AnnualIncome = annualIncome,
                Date = DateOnly.FromDateTime(DateTime.UtcNow),
                DefaultCategories = Category.GetAllDefaultCategories()
                    .Select(c => new CategoryWithPercentageDTO
                    {
                        Name = c.category.Name,
                        Percentage = c.percentage
                    })
                    .ToList(),
                EmergencyReserveTarget = emergencyReserveTarget
            };
        }

        [Fact]
        public async Task SmartSetup_ShouldCreateEmergencyReservePlan_WithDefaultTarget()
        {
            // Arrange
            var (scope, projectService, unitOfWork, projectId, user) = await CreateEmptyProjectAsync();
            using (scope)
            {
                var request = CreateDefaultSmartSetupRequest(annualIncome: 60000m);

                // Act
                var result = await projectService.SmartSetupAsync(user, projectId, request);

                // Assert
                result.Failed.Should().BeFalse();

                var plans = unitOfWork.PlanRepository.NoTrackable()
                    .Where(p => p.ProjectId == projectId)
                    .ToList();

                plans.Should().HaveCount(1);
                plans[0].Type.Should().Be(PlanType.EmergencyReserve);
                plans[0].Name.Should().Be(ValidationMessages.EmergencyFund);
                plans[0].CurrentBalance.Should().Be(0m);

                // Default target = 6 * FixedExpenses TotalBudget
                // FixedExpenses budget calculation: Convert.ToInt32(5000) * 30 / 100 = 1500
                // Sub-expenses: 750 + 255 + 255 + 240 = 1500
                // Target = 1500 * 6 = 9000
                var monthIncome = 60000m / 12;
                var categoryBudget = Convert.ToInt32(monthIncome) * 30 / 100;
                var expectedBudget = (categoryBudget * 50 / 100) + (categoryBudget * 17 / 100) + (categoryBudget * 17 / 100) + (categoryBudget * 16 / 100);
                var expectedTarget = expectedBudget * 6;
                plans[0].TargetAmount.Should().Be(expectedTarget);
            }
        }

        [Fact]
        public async Task SmartSetup_ShouldCreateEmergencyReservePlan_WithCustomTarget()
        {
            // Arrange
            var (scope, projectService, unitOfWork, projectId, user) = await CreateEmptyProjectAsync();
            using (scope)
            {
                var customTarget = 25000m;
                var request = CreateDefaultSmartSetupRequest(annualIncome: 60000m, emergencyReserveTarget: customTarget);

                // Act
                var result = await projectService.SmartSetupAsync(user, projectId, request);

                // Assert
                result.Failed.Should().BeFalse();

                var plan = unitOfWork.PlanRepository.NoTrackable()
                    .First(p => p.ProjectId == projectId);

                plan.TargetAmount.Should().Be(customTarget);
            }
        }

        [Fact]
        public async Task SmartSetup_ShouldCreateAllFiveCategories()
        {
            // Arrange
            var (scope, projectService, unitOfWork, projectId, user) = await CreateEmptyProjectAsync();
            using (scope)
            {
                var request = CreateDefaultSmartSetupRequest(annualIncome: 60000m);

                // Act
                var result = await projectService.SmartSetupAsync(user, projectId, request);

                // Assert
                result.Failed.Should().BeFalse();

                var updatedProject = await unitOfWork.ProjectRepository.NoTrackable()
                    .Include(p => p.Categories)
                    .FirstAsync(p => p.Id == projectId);

                updatedProject.Categories.Should().HaveCount(5);

                var categoryNames = updatedProject.Categories.Select(c => c.Name).ToList();
                categoryNames.Should().Contain(ValidationMessages.FixedExpenses);
                categoryNames.Should().Contain(ValidationMessages.Comfort);
                categoryNames.Should().Contain(ValidationMessages.Pleasures);
                categoryNames.Should().Contain(ValidationMessages.YourFuture);
                categoryNames.Should().Contain(ValidationMessages.SelfImprovement);
            }
        }

        [Fact]
        public async Task SmartSetup_EmergencyReservePlanTarget_ShouldBeBasedOnFixedExpensesBudget()
        {
            // Arrange
            var (scope, projectService, unitOfWork, projectId, user) = await CreateEmptyProjectAsync();
            using (scope)
            {
                var annualIncome = 120000m;
                var request = CreateDefaultSmartSetupRequest(annualIncome: annualIncome);

                // Act
                var result = await projectService.SmartSetupAsync(user, projectId, request);

                // Assert
                result.Failed.Should().BeFalse();

                var plan = unitOfWork.PlanRepository.NoTrackable()
                    .First(p => p.ProjectId == projectId);

                // FixedExpenses = 30% of 120000/12 = 30% of 10000 = 3000
                // Sub-expenses: 50% + 17% + 17% + 16% = 100% of 3000
                var monthIncome = annualIncome / 12;
                var categoryBudget = Convert.ToInt32(monthIncome) * 30 / 100;
                var expectedSubBudgets = (categoryBudget * 50 / 100) + (categoryBudget * 17 / 100) + (categoryBudget * 17 / 100) + (categoryBudget * 16 / 100);
                var expectedTarget = expectedSubBudgets * 6;

                plan.TargetAmount.Should().Be(expectedTarget);
            }
        }

        [Fact]
        public async Task SmartSetup_WithZeroEmergencyReserveTarget_ShouldUseDefaultFormula()
        {
            // Arrange
            var (scope, projectService, unitOfWork, projectId, user) = await CreateEmptyProjectAsync();
            using (scope)
            {
                var request = CreateDefaultSmartSetupRequest(annualIncome: 60000m, emergencyReserveTarget: 0m);

                // Act
                var result = await projectService.SmartSetupAsync(user, projectId, request);

                // Assert
                result.Failed.Should().BeFalse();

                var plan = unitOfWork.PlanRepository.NoTrackable()
                    .First(p => p.ProjectId == projectId);

                // Should fallback to default formula, not 0
                plan.TargetAmount.Should().BeGreaterThan(0);
            }
        }
    }
}
