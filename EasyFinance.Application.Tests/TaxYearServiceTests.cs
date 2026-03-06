using EasyFinance.Application.Contracts.Persistence;
using EasyFinance.Application.DTOs.FinancialProject;
using EasyFinance.Application.Features.TaxYearService;
using EasyFinance.Common.Tests;
using EasyFinance.Domain.Financial;
using EasyFinance.Domain.FinancialProject;
using EasyFinance.Infrastructure;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace EasyFinance.Application.Tests
{
    [Collection("Sequential")]
    public class TaxYearServiceTests : BaseTests
    {
        public TaxYearServiceTests()
        {
            PrepareInMemoryDatabase();
        }

        [Fact]
        public async Task AssignExpenseToGroupAsync_WithExpenseFromDifferentTaxYear_ShouldReturnError()
        {
            using var scope = this.serviceProvider.CreateScope();
            var scopedServices = scope.ServiceProvider;
            var taxYearService = scopedServices.GetRequiredService<ITaxYearService>();
            var unitOfWork = scopedServices.GetRequiredService<IUnitOfWork>();

            var project = await unitOfWork.ProjectRepository
                .Trackable()
                .Include(p => p.Categories)
                .ThenInclude(c => c.Expenses)
                .FirstAsync(p => p.Id == this.project1.Id);

            project.SetTaxYearRule(
                TaxYearType.CustomStartMonth,
                taxYearStartMonth: 4,
                taxYearStartDay: 1,
                taxYearLabeling: TaxYearLabeling.ByStartYear);

            var category = project.Categories.First();
            var currentTaxYearExpense = category.Expenses.First();
            currentTaxYearExpense.SetDate(new DateOnly(2026, 3, 10));
            currentTaxYearExpense.SetIsDeductible(true);

            var crossPeriodExpense = new Expense(
                name: "Cross Period",
                date: new DateOnly(2026, 5, 10),
                amount: 150m,
                createdBy: this.user1,
                budget: 150,
                isDeductible: true);

            category.AddExpense(crossPeriodExpense);

            unitOfWork.ExpenseRepository.InsertOrUpdate(crossPeriodExpense);
            unitOfWork.CategoryRepository.InsertOrUpdate(category);
            unitOfWork.ProjectRepository.InsertOrUpdate(project);
            await unitOfWork.CommitAsync();

            var createGroupResponse = await taxYearService.CreateDeductibleGroupAsync(
                projectId: project.Id,
                taxYearId: "2025-04",
                requestDto: new DeductibleGroupRequestDTO { Name = "Tax Group" });

            createGroupResponse.Succeeded.Should().BeTrue();

            var assignResponse = await taxYearService.AssignExpenseToGroupAsync(
                projectId: project.Id,
                taxYearId: "2025-04",
                groupId: createGroupResponse.Data.Id,
                expenseId: crossPeriodExpense.Id,
                expenseItemId: null);

            assignResponse.Failed.Should().BeTrue();
            assignResponse.Messages.Should().ContainSingle(message =>
                message.Code == "expenseId" &&
                message.Description == ValidationMessages.ExpenseTaxYearMismatch);
        }
    }
}
