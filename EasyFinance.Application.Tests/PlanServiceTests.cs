using EasyFinance.Application.Contracts.Persistence;
using EasyFinance.Application.DTOs.FinancialProject;
using EasyFinance.Application.Features.PlanService;
using EasyFinance.Application.Features.ProjectService;
using EasyFinance.Common.Tests;
using EasyFinance.Domain.FinancialProject;
using FluentAssertions;
using Microsoft.AspNetCore.JsonPatch;
using Microsoft.Extensions.DependencyInjection;

namespace EasyFinance.Application.Tests
{
    [Collection("Sequential")]
    public class PlanServiceTests : BaseTests
    {
        public PlanServiceTests()
        {
            PrepareInMemoryDatabase();
        }

        [Fact]
        public async Task CreatePlanAsync_ShouldCreatePlanForProject()
        {
            using var scope = this.serviceProvider.CreateScope();
            var scopedServices = scope.ServiceProvider;
            var planService = scopedServices.GetRequiredService<IPlanService>();

            var response = await planService.CreatePlanAsync(this.project1.Id, new PlanRequestDTO
            {
                Type = PlanType.EmergencyReserve,
                Name = "Emergency Reserve",
                TargetAmount = 6000m
            });

            response.Succeeded.Should().BeTrue();
            response.Data.ProjectId.Should().Be(this.project1.Id);
            response.Data.Name.Should().Be("Emergency Reserve");
            response.Data.TargetAmount.Should().Be(6000m);
            response.Data.CurrentBalance.Should().Be(0m);
            response.Data.Remaining.Should().Be(6000m);
            response.Data.Progress.Should().Be(0m);
        }

        [Fact]
        public async Task CreatePlanAsync_WithNegativeTargetAmount_ShouldFail()
        {
            using var scope = this.serviceProvider.CreateScope();
            var scopedServices = scope.ServiceProvider;
            var planService = scopedServices.GetRequiredService<IPlanService>();

            var response = await planService.CreatePlanAsync(this.project1.Id, new PlanRequestDTO
            {
                Type = PlanType.Investment,
                Name = "Investments",
                TargetAmount = -1m
            });

            response.Failed.Should().BeTrue();
            response.Messages.Should().Contain(message => message.Code == "TargetAmount");
        }

        [Fact]
        public async Task CreatePlanAsync_WithSavingType_ShouldCreatePlan()
        {
            using var scope = this.serviceProvider.CreateScope();
            var scopedServices = scope.ServiceProvider;
            var planService = scopedServices.GetRequiredService<IPlanService>();

            var response = await planService.CreatePlanAsync(this.project1.Id, new PlanRequestDTO
            {
                Type = PlanType.Saving,
                Name = "Saving Plan",
                TargetAmount = 2500m
            });

            response.Succeeded.Should().BeTrue();
            response.Data.Type.Should().Be(PlanType.Saving);
        }

        [Fact]
        public async Task CreatePlanAsync_WithSecondEmergencyReserve_ShouldFail()
        {
            using var scope = this.serviceProvider.CreateScope();
            var scopedServices = scope.ServiceProvider;
            var planService = scopedServices.GetRequiredService<IPlanService>();

            var firstPlan = await planService.CreatePlanAsync(this.project1.Id, new PlanRequestDTO
            {
                Type = PlanType.EmergencyReserve,
                Name = "Emergency Reserve",
                TargetAmount = 5000m
            });

            var secondPlan = await planService.CreatePlanAsync(this.project1.Id, new PlanRequestDTO
            {
                Type = PlanType.EmergencyReserve,
                Name = "Emergency Reserve 2",
                TargetAmount = 3000m
            });

            firstPlan.Succeeded.Should().BeTrue();
            secondPlan.Failed.Should().BeTrue();
            secondPlan.Messages.Should().Contain(message => message.Code == "Type");
        }

        [Fact]
        public async Task UpdatePlanAsync_ToEmergencyReserveWhenOneAlreadyExists_ShouldFail()
        {
            using var scope = this.serviceProvider.CreateScope();
            var scopedServices = scope.ServiceProvider;
            var planService = scopedServices.GetRequiredService<IPlanService>();

            var emergencyPlan = await planService.CreatePlanAsync(this.project1.Id, new PlanRequestDTO
            {
                Type = PlanType.EmergencyReserve,
                Name = "Emergency Reserve",
                TargetAmount = 6000m
            });

            var savingPlan = await planService.CreatePlanAsync(this.project1.Id, new PlanRequestDTO
            {
                Type = PlanType.Saving,
                Name = "Saving",
                TargetAmount = 2000m
            });

            var patchDocument = new JsonPatchDocument<PlanRequestDTO>();
            patchDocument.Replace(plan => plan.Type, PlanType.EmergencyReserve);
            patchDocument.Replace(plan => plan.Name, "Saving as emergency");
            patchDocument.Replace(plan => plan.TargetAmount, 2000m);

            var updateAttempt = await planService.UpdatePlanAsync(this.project1.Id, savingPlan.Data.Id, patchDocument);

            emergencyPlan.Succeeded.Should().BeTrue();
            savingPlan.Succeeded.Should().BeTrue();
            updateAttempt.Failed.Should().BeTrue();
            updateAttempt.Messages.Should().Contain(message => message.Code == "Type");
        }

        [Fact]
        public async Task UpdatePlanAsync_ShouldUpdatePlanMetadata()
        {
            using var scope = this.serviceProvider.CreateScope();
            var scopedServices = scope.ServiceProvider;
            var planService = scopedServices.GetRequiredService<IPlanService>();

            var createdPlan = await planService.CreatePlanAsync(this.project1.Id, new PlanRequestDTO
            {
                Type = PlanType.EmergencyReserve,
                Name = "Emergency Reserve",
                TargetAmount = 6000m
            });

            var patchDocument = new JsonPatchDocument<PlanRequestDTO>();
            patchDocument.Replace(plan => plan.Type, PlanType.Investment);
            patchDocument.Replace(plan => plan.Name, "Long-term investment");
            patchDocument.Replace(plan => plan.TargetAmount, 12000m);

            var updatedPlan = await planService.UpdatePlanAsync(this.project1.Id, createdPlan.Data.Id, patchDocument);

            updatedPlan.Succeeded.Should().BeTrue();
            updatedPlan.Data.Type.Should().Be(PlanType.Investment);
            updatedPlan.Data.Name.Should().Be("Long-term investment");
            updatedPlan.Data.TargetAmount.Should().Be(12000m);
            updatedPlan.Data.CurrentBalance.Should().Be(0m);
            updatedPlan.Data.Remaining.Should().Be(12000m);
            updatedPlan.Data.Progress.Should().Be(0m);
        }

        [Fact]
        public async Task ArchivePlanAsync_ShouldHidePlanFromList()
        {
            using var scope = this.serviceProvider.CreateScope();
            var scopedServices = scope.ServiceProvider;
            var planService = scopedServices.GetRequiredService<IPlanService>();

            var createdPlan = await planService.CreatePlanAsync(this.project1.Id, new PlanRequestDTO
            {
                Type = PlanType.EmergencyReserve,
                Name = "Emergency Reserve",
                TargetAmount = 3000m
            });

            var archiveResponse = await planService.ArchivePlanAsync(this.project1.Id, createdPlan.Data.Id);
            var plansAfterArchive = await planService.GetPlansAsync(this.project1.Id);

            archiveResponse.Succeeded.Should().BeTrue();
            plansAfterArchive.Data.Should().BeEmpty();
        }

        [Fact]
        public async Task AddEntryAsync_ShouldUpdateBalanceAndDerivedValues()
        {
            using var scope = this.serviceProvider.CreateScope();
            var scopedServices = scope.ServiceProvider;
            var planService = scopedServices.GetRequiredService<IPlanService>();
            var unitOfWork = scopedServices.GetRequiredService<IUnitOfWork>();

            var createdPlan = await planService.CreatePlanAsync(this.project1.Id, new PlanRequestDTO
            {
                Type = PlanType.EmergencyReserve,
                Name = "Emergency Reserve",
                TargetAmount = 1000m
            });

            var firstEntryDate = DateOnly.FromDateTime(DateTime.UtcNow.Date.AddDays(-1));
            var secondEntryDate = DateOnly.FromDateTime(DateTime.UtcNow.Date);

            var firstEntry = await planService.AddEntryAsync(this.project1.Id, createdPlan.Data.Id, new PlanEntryRequestDTO
            {
                Date = firstEntryDate,
                AmountSigned = 200m,
                Note = "Initial contribution"
            });

            var secondEntry = await planService.AddEntryAsync(this.project1.Id, createdPlan.Data.Id, new PlanEntryRequestDTO
            {
                Date = secondEntryDate,
                AmountSigned = -50m,
                Note = "Adjustment"
            });

            var updatedPlan = unitOfWork.PlanRepository.NoTrackable().First(plan => plan.Id == createdPlan.Data.Id);
            var entries = await planService.GetEntriesAsync(this.project1.Id, createdPlan.Data.Id);
            var plans = await planService.GetPlansAsync(this.project1.Id);
            var planSummary = plans.Data.Single();

            firstEntry.Succeeded.Should().BeTrue();
            secondEntry.Succeeded.Should().BeTrue();
            updatedPlan.CurrentBalance.Should().Be(150m);

            entries.Data.Should().HaveCount(2);
            entries.Data.First().Date.Should().Be(secondEntryDate);

            planSummary.CurrentBalance.Should().Be(150m);
            planSummary.Remaining.Should().Be(850m);
            planSummary.Progress.Should().Be(0.15m);
        }

        [Fact]
        public async Task AddEntryAsync_WithZeroAmount_ShouldFail()
        {
            using var scope = this.serviceProvider.CreateScope();
            var scopedServices = scope.ServiceProvider;
            var planService = scopedServices.GetRequiredService<IPlanService>();
            var unitOfWork = scopedServices.GetRequiredService<IUnitOfWork>();

            var createdPlan = await planService.CreatePlanAsync(this.project1.Id, new PlanRequestDTO
            {
                Type = PlanType.EmergencyReserve,
                Name = "Emergency Reserve",
                TargetAmount = 500m
            });

            var response = await planService.AddEntryAsync(this.project1.Id, createdPlan.Data.Id, new PlanEntryRequestDTO
            {
                Date = DateOnly.FromDateTime(DateTime.UtcNow.Date),
                AmountSigned = 0m,
                Note = "Invalid"
            });

            var plan = unitOfWork.PlanRepository.NoTrackable().First(savedPlan => savedPlan.Id == createdPlan.Data.Id);

            response.Failed.Should().BeTrue();
            response.Messages.Should().Contain(message => message.Code == "AmountSigned");
            plan.CurrentBalance.Should().Be(0m);
        }

        [Fact]
        public async Task GetEntriesAsync_WithPlanFromAnotherProject_ShouldThrowNotFound()
        {
            using var scope = this.serviceProvider.CreateScope();
            var scopedServices = scope.ServiceProvider;
            var planService = scopedServices.GetRequiredService<IPlanService>();

            var createdPlan = await planService.CreatePlanAsync(this.project1.Id, new PlanRequestDTO
            {
                Type = PlanType.EmergencyReserve,
                Name = "Emergency Reserve",
                TargetAmount = 1000m
            });

            Func<Task> action = async () => await planService.GetEntriesAsync(this.project2.Id, createdPlan.Data.Id);

            await action.Should().ThrowAsync<KeyNotFoundException>();
        }

        [Fact]
        public async Task OverviewSummary_PlanEntriesShouldNotChangeCategoryExpenseTotals()
        {
            using var scope = this.serviceProvider.CreateScope();
            var scopedServices = scope.ServiceProvider;
            var planService = scopedServices.GetRequiredService<IPlanService>();
            var projectService = scopedServices.GetRequiredService<IProjectService>();

            var from = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-30));
            var to = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(1));
            var summaryBefore = await projectService.GetOverviewSummaryAsync(this.project1.Id, from, to, 5);

            var createdPlan = await planService.CreatePlanAsync(this.project1.Id, new PlanRequestDTO
            {
                Type = PlanType.Investment,
                Name = "Investments",
                TargetAmount = 10000m
            });

            await planService.AddEntryAsync(this.project1.Id, createdPlan.Data.Id, new PlanEntryRequestDTO
            {
                Date = DateOnly.FromDateTime(DateTime.UtcNow.Date),
                AmountSigned = 600m,
                Note = "Contribution"
            });

            await planService.AddEntryAsync(this.project1.Id, createdPlan.Data.Id, new PlanEntryRequestDTO
            {
                Date = DateOnly.FromDateTime(DateTime.UtcNow.Date),
                AmountSigned = -100m,
                Note = "Rebalance"
            });

            var summaryAfter = await projectService.GetOverviewSummaryAsync(this.project1.Id, from, to, 5);

            summaryBefore.Succeeded.Should().BeTrue();
            summaryAfter.Succeeded.Should().BeTrue();
            summaryAfter.Data.TotalExpense.Should().Be(summaryBefore.Data.TotalExpense);
        }
    }
}
