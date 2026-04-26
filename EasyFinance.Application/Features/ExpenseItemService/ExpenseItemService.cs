using System;
using System.Linq;
using System.Text.Json;
using System.Threading.Tasks;
using EasyFinance.Application.Contracts.Persistence;
using EasyFinance.Application.DTOs.Account;
using EasyFinance.Application.Features.NotificationService;
using EasyFinance.Domain.AccessControl;
using EasyFinance.Domain.Account;
using EasyFinance.Infrastructure;
using EasyFinance.Infrastructure.DTOs;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace EasyFinance.Application.Features.ExpenseItemService
{
    public class ExpenseItemService : IExpenseItemService
    {
        private readonly IUnitOfWork unitOfWork;
        private readonly INotificationService notificationService;
        private readonly ILogger<ExpenseItemService> logger;

        public ExpenseItemService(
            IUnitOfWork unitOfWork,
            INotificationService notificationService,
            ILogger<ExpenseItemService> logger)
        {
            this.unitOfWork = unitOfWork;
            this.notificationService = notificationService;
            this.logger = logger;
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

            var itemAmount = expenseItem.Amount;

            sourceExpense.Items.Remove(expenseItem);
            targetExpense.AddItem(expenseItem);

            await this.unitOfWork.CommitAsync();

            await CheckBudgetAlertsAsync(projectId, targetExpenseId, itemAmount);

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

        private async Task CheckBudgetAlertsAsync(Guid projectId, Guid expenseId, decimal addedAmount)
        {
            try
            {
                var expense = await unitOfWork.ExpenseRepository
                    .NoTrackable()
                    .Include(e => e.Items)
                    .FirstOrDefaultAsync(e => e.Id == expenseId);

                if (expense == null || expense.Budget == 0) return;

                decimal currentAmount = expense.Amount;
                decimal previousAmount = currentAmount - addedAmount;

                decimal previousPercentage = previousAmount / (decimal)expense.Budget * 100m;
                decimal currentPercentage = currentAmount / (decimal)expense.Budget * 100m;

                bool isOverflow = currentPercentage >= 100m && previousPercentage < 100m;
                bool isWarning = currentPercentage >= 80m && currentPercentage < 100m && previousPercentage < 80m;

                if (!isOverflow && !isWarning) return;

                var users = await unitOfWork.UserProjectRepository
                    .Trackable()
                    .Where(up => up.Project != null && up.Project.Id == projectId && up.Accepted)
                    .Select(up => up.User)
                    .ToListAsync();

                string messageCode = isOverflow ? "BUDGET_OVERFLOW" : "BUDGET_WARNING";

                foreach (var user in users)
                {
                    await notificationService.CreateNotificationAsync(new NotificationRequestDTO
                    {
                        User = user,
                        Type = NotificationType.Information,
                        CodeMessage = messageCode,
                        Category = NotificationCategory.Finance,
                        LimitNotificationChannels = NotificationChannels.Push | NotificationChannels.InApp | NotificationChannels.WebPush,
                        Metadata = JsonSerializer.Serialize(new { expenseName = expense.Name })
                    });
                }
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Error while checking budget alerts for project {ProjectId}.", projectId);
            }
        }
    }
}
