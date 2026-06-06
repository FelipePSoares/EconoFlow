using EasyFinance.Application.Contracts.Persistence;
using EasyFinance.Application.Features.CategoryService;
using EasyFinance.Application.Features.ExpenseItemService;
using EasyFinance.Application.Features.ExpenseService;
using EasyFinance.Application.Features.IncomeService;
using EasyFinance.Common.Tests;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace EasyFinance.Application.Tests
{
    [Collection("Sequential")]
    public class SoftDeleteRestoreTests : BaseTests
    {
        public SoftDeleteRestoreTests()
        {
            PrepareInMemoryDatabase();
        }

        // ── Income ──────────────────────────────────────────────────────────

        [Fact]
        public async Task Income_DeleteAsync_WithValidId_ShouldMarkAsDeleted()
        {
            using var scope = this.serviceProvider.CreateScope();
            var incomeService = scope.ServiceProvider.GetRequiredService<IIncomeService>();
            var unitOfWork = scope.ServiceProvider.GetRequiredService<IUnitOfWork>();

            var incomeId = this.project1.Incomes.First().Id;

            var result = await incomeService.DeleteAsync(incomeId);

            result.Succeeded.Should().BeTrue();

            var income = await unitOfWork.IncomeRepository
                .NoTrackable()
                .IgnoreQueryFilters()
                .FirstAsync(i => i.Id == incomeId);

            income.IsDeleted.Should().BeTrue();
        }

        [Fact]
        public async Task Income_DeleteAsync_ShouldNotReturnDeletedIncomeInGet()
        {
            using var scope = this.serviceProvider.CreateScope();
            var incomeService = scope.ServiceProvider.GetRequiredService<IIncomeService>();

            var incomeId = this.project1.Incomes.First().Id;
            await incomeService.DeleteAsync(incomeId);

            var from = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-30));
            var to = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(1));
            var result = incomeService.Get(this.project1.Id, from, to);

            result.Succeeded.Should().BeTrue();
            result.Data.Should().NotContain(i => i.Id == incomeId);
        }

        [Fact]
        public async Task Income_RestoreAsync_WithValidId_ShouldMarkAsNotDeleted()
        {
            using var scope = this.serviceProvider.CreateScope();
            var incomeService = scope.ServiceProvider.GetRequiredService<IIncomeService>();
            var unitOfWork = scope.ServiceProvider.GetRequiredService<IUnitOfWork>();

            var incomeId = this.project1.Incomes.First().Id;
            await incomeService.DeleteAsync(incomeId);

            var result = await incomeService.RestoreAsync(incomeId);

            result.Succeeded.Should().BeTrue();

            var income = await unitOfWork.IncomeRepository
                .NoTrackable()
                .IgnoreQueryFilters()
                .FirstAsync(i => i.Id == incomeId);

            income.IsDeleted.Should().BeFalse();
        }

        [Fact]
        public async Task Income_RestoreAsync_WithEmptyId_ShouldReturnError()
        {
            using var scope = this.serviceProvider.CreateScope();
            var incomeService = scope.ServiceProvider.GetRequiredService<IIncomeService>();

            var result = await incomeService.RestoreAsync(Guid.Empty);

            result.Succeeded.Should().BeFalse();
        }

        // ── Expense ─────────────────────────────────────────────────────────

        [Fact]
        public async Task Expense_DeleteAsync_WithValidId_ShouldMarkAsDeleted()
        {
            using var scope = this.serviceProvider.CreateScope();
            var expenseService = scope.ServiceProvider.GetRequiredService<IExpenseService>();
            var unitOfWork = scope.ServiceProvider.GetRequiredService<IUnitOfWork>();

            var expenseId = this.project1.Categories.First().Expenses.First().Id;

            var result = await expenseService.DeleteAsync(expenseId);

            result.Succeeded.Should().BeTrue();

            var expense = await unitOfWork.ExpenseRepository
                .NoTrackable()
                .IgnoreQueryFilters()
                .FirstAsync(e => e.Id == expenseId);

            expense.IsDeleted.Should().BeTrue();
        }

        [Fact]
        public async Task Expense_RestoreAsync_WithValidId_ShouldMarkAsNotDeleted()
        {
            using var scope = this.serviceProvider.CreateScope();
            var expenseService = scope.ServiceProvider.GetRequiredService<IExpenseService>();
            var unitOfWork = scope.ServiceProvider.GetRequiredService<IUnitOfWork>();

            var expenseId = this.project1.Categories.First().Expenses.First().Id;
            await expenseService.DeleteAsync(expenseId);

            var result = await expenseService.RestoreAsync(expenseId);

            result.Succeeded.Should().BeTrue();

            var expense = await unitOfWork.ExpenseRepository
                .NoTrackable()
                .IgnoreQueryFilters()
                .FirstAsync(e => e.Id == expenseId);

            expense.IsDeleted.Should().BeFalse();
        }

        [Fact]
        public async Task Expense_RestoreAsync_WithEmptyId_ShouldReturnError()
        {
            using var scope = this.serviceProvider.CreateScope();
            var expenseService = scope.ServiceProvider.GetRequiredService<IExpenseService>();

            var result = await expenseService.RestoreAsync(Guid.Empty);

            result.Succeeded.Should().BeFalse();
        }

        // ── ExpenseItem ──────────────────────────────────────────────────────

        [Fact]
        public async Task ExpenseItem_DeleteAsync_WithValidId_ShouldMarkAsDeleted()
        {
            using var scope = this.serviceProvider.CreateScope();
            var expenseItemService = scope.ServiceProvider.GetRequiredService<IExpenseItemService>();
            var unitOfWork = scope.ServiceProvider.GetRequiredService<IUnitOfWork>();

            var expenseItemId = this.project1.Categories.First().Expenses.First().Items.First().Id;

            var result = await expenseItemService.DeleteAsync(expenseItemId);

            result.Succeeded.Should().BeTrue();

            var expenseItem = await unitOfWork.ExpenseItemRepository
                .NoTrackable()
                .IgnoreQueryFilters()
                .FirstAsync(i => i.Id == expenseItemId);

            expenseItem.IsDeleted.Should().BeTrue();
        }

        [Fact]
        public async Task ExpenseItem_RestoreAsync_WithValidId_ShouldMarkAsNotDeleted()
        {
            using var scope = this.serviceProvider.CreateScope();
            var expenseItemService = scope.ServiceProvider.GetRequiredService<IExpenseItemService>();
            var unitOfWork = scope.ServiceProvider.GetRequiredService<IUnitOfWork>();

            var expenseItemId = this.project1.Categories.First().Expenses.First().Items.First().Id;
            await expenseItemService.DeleteAsync(expenseItemId);

            var result = await expenseItemService.RestoreAsync(expenseItemId);

            result.Succeeded.Should().BeTrue();

            var expenseItem = await unitOfWork.ExpenseItemRepository
                .NoTrackable()
                .IgnoreQueryFilters()
                .FirstAsync(i => i.Id == expenseItemId);

            expenseItem.IsDeleted.Should().BeFalse();
        }

        [Fact]
        public async Task ExpenseItem_RestoreAsync_WithEmptyId_ShouldReturnError()
        {
            using var scope = this.serviceProvider.CreateScope();
            var expenseItemService = scope.ServiceProvider.GetRequiredService<IExpenseItemService>();

            var result = await expenseItemService.RestoreAsync(Guid.Empty);

            result.Succeeded.Should().BeFalse();
        }

        // ── Category ─────────────────────────────────────────────────────────

        [Fact]
        public async Task Category_UnarchiveAsync_WithValidId_ShouldMarkAsNotArchived()
        {
            using var scope = this.serviceProvider.CreateScope();
            var categoryService = scope.ServiceProvider.GetRequiredService<ICategoryService>();
            var unitOfWork = scope.ServiceProvider.GetRequiredService<IUnitOfWork>();

            var categoryId = this.project1.Categories.First().Id;
            await categoryService.ArchiveAsync(categoryId);

            var result = await categoryService.UnarchiveAsync(categoryId);

            result.Succeeded.Should().BeTrue();

            var category = await unitOfWork.CategoryRepository
                .NoTrackable()
                .IgnoreQueryFilters()
                .FirstAsync(c => c.Id == categoryId);

            category.IsArchived.Should().BeFalse();
        }

        [Fact]
        public async Task Category_UnarchiveAsync_WithEmptyId_ShouldReturnError()
        {
            using var scope = this.serviceProvider.CreateScope();
            var categoryService = scope.ServiceProvider.GetRequiredService<ICategoryService>();

            var result = await categoryService.UnarchiveAsync(Guid.Empty);

            result.Succeeded.Should().BeFalse();
        }
    }
}
