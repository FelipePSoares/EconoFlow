using System;
using System.Linq;
using System.Threading.Tasks;
using EasyFinance.Application.Contracts.Persistence;
using EasyFinance.Domain.AccessControl;
using EasyFinance.Infrastructure;
using EasyFinance.Infrastructure.DTOs;
using Microsoft.EntityFrameworkCore;

namespace EasyFinance.Application.Features.ExpenseItemService
{
    public class ExpenseItemService : IExpenseItemService
    {
        private readonly IUnitOfWork unitOfWork;

        public ExpenseItemService(IUnitOfWork unitOfWork)
        {
            this.unitOfWork = unitOfWork;
        }

        public async Task<AppResponse> MoveAsync(
            Guid projectId,
            Guid sourceCategoryId,
            Guid sourceExpenseId,
            Guid expenseItemId,
            Guid targetCategoryId,
            Guid targetExpenseId)
        {
            if (projectId == Guid.Empty)
                return AppResponse.Error(code: nameof(projectId), description: ValidationMessages.InvalidProjectId);

            if (sourceCategoryId == Guid.Empty)
                return AppResponse.Error(code: nameof(sourceCategoryId), description: ValidationMessages.InvalidCategoryId);

            if (sourceExpenseId == Guid.Empty)
                return AppResponse.Error(code: nameof(sourceExpenseId), description: ValidationMessages.InvalidExpenseId);

            if (expenseItemId == Guid.Empty)
                return AppResponse.Error(code: nameof(expenseItemId), description: ValidationMessages.InvalidExpenseItemId);

            if (targetCategoryId == Guid.Empty)
                return AppResponse.Error(code: nameof(targetCategoryId), description: ValidationMessages.InvalidCategoryId);

            if (targetExpenseId == Guid.Empty)
                return AppResponse.Error(code: nameof(targetExpenseId), description: ValidationMessages.InvalidExpenseId);

            var project = await this.unitOfWork.ProjectRepository
                .Trackable()
                .IgnoreQueryFilters()
                .Where(p => p.Id == projectId)
                .Include(p => p.Categories.Where(c => c.Id == sourceCategoryId || c.Id == targetCategoryId))
                    .ThenInclude(c => c.Expenses.Where(e => e.Id == sourceExpenseId || e.Id == targetExpenseId))
                        .ThenInclude(e => e.Items.Where(item => item.Id == expenseItemId))
                .FirstOrDefaultAsync();

            if (project == null)
                return AppResponse.Error(code: nameof(projectId), description: ValidationMessages.ProjectNotFound);

            var sourceCategory = project.Categories.FirstOrDefault(c => c.Id == sourceCategoryId);
            if (sourceCategory == null)
                return AppResponse.Error(code: nameof(sourceCategoryId), description: ValidationMessages.CategoryNotFound);

            var targetCategory = project.Categories.FirstOrDefault(c => c.Id == targetCategoryId);
            if (targetCategory == null || targetCategory.IsArchived)
                return AppResponse.Error(code: nameof(targetCategoryId), description: ValidationMessages.CategoryNotFound);

            var sourceExpense = sourceCategory.Expenses.FirstOrDefault(e => e.Id == sourceExpenseId);
            if (sourceExpense == null)
                return AppResponse.Error(code: nameof(sourceExpenseId), description: ValidationMessages.ExpenseNotFound);

            var targetExpense = targetCategory.Expenses.FirstOrDefault(e => e.Id == targetExpenseId);
            if (targetExpense == null)
                return AppResponse.Error(code: nameof(targetExpenseId), description: ValidationMessages.ExpenseNotFound);

            var expenseItem = sourceExpense.Items.FirstOrDefault(item => item.Id == expenseItemId);
            if (expenseItem == null)
                return AppResponse.Error(code: nameof(expenseItemId), description: ValidationMessages.ExpenseItemNotFound);

            if (sourceExpense.Id == targetExpense.Id)
                return AppResponse.Success();

            if (expenseItem.Date.Year != targetExpense.Date.Year || expenseItem.Date.Month != targetExpense.Date.Month)
                return AppResponse.Error(code: nameof(expenseItemId), description: ValidationMessages.CantAddExpenseItemWithDifferentYearOrMonthFromExpense);

            sourceExpense.Items.Remove(expenseItem);
            targetExpense.AddItem(expenseItem);

            await this.unitOfWork.CommitAsync();

            return AppResponse.Success();
        }

        public async Task<AppResponse> DeleteAsync(Guid expenseItemId)
        {
            if (expenseItemId == Guid.Empty)
                return AppResponse.Error(code: nameof(expenseItemId), description: ValidationMessages.InvalidExpenseItemId);

            var expenseItem = unitOfWork.ExpenseItemRepository.Trackable().FirstOrDefault(e => e.Id == expenseItemId);

            if (expenseItem == null)
                return AppResponse.Success();

            unitOfWork.ExpenseItemRepository.Delete(expenseItem);
            await unitOfWork.CommitAsync();

            return AppResponse.Success();
        }

        public async Task<AppResponse> RemoveLinkAsync(User user)
        {
            var response = AppResponse.Success();

            var expenseItems = unitOfWork.ExpenseItemRepository
                .Trackable()
                .Include(e => e.CreatedBy)
                .Where(expenseItem => expenseItem.CreatedBy.Id == user.Id).ToList();

            foreach (var expenseItem in expenseItems)
            {
                expenseItem.RemoveUserLink();
                var expenseItemSaved = unitOfWork.ExpenseItemRepository.InsertOrUpdate(expenseItem);
                if (expenseItemSaved.Failed)
                    response.AddErrorMessage(expenseItemSaved.Messages);
            }

            await unitOfWork.CommitAsync();
            
            return response;
        }
    }
}
