using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using EasyFinance.Application.Contracts.Persistence;
using EasyFinance.Application.DTOs.Financial;
using EasyFinance.Application.Features.AttachmentService;
using EasyFinance.Application.Mappers;
using EasyFinance.Domain.AccessControl;
using EasyFinance.Domain.Financial;
using EasyFinance.Infrastructure;
using EasyFinance.Infrastructure.DTOs;
using Microsoft.AspNetCore.JsonPatch;
using Microsoft.AspNetCore.JsonPatch.Operations;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace EasyFinance.Application.Features.ExpenseService
{
    public class ExpenseService : IExpenseService
    {
        private readonly IUnitOfWork unitOfWork;
        private readonly IAttachmentService attachmentService;
        private readonly ILogger<ExpenseService> logger;

        public ExpenseService(IUnitOfWork unitOfWork, IAttachmentService attachmentService, ILogger<ExpenseService> logger)
        {
            this.unitOfWork = unitOfWork;
            this.attachmentService = attachmentService;
            this.logger = logger;
        }

        public async Task<AppResponse<IEnumerable<ExpenseResponseDTO>>> GetAsync(Guid categoryId, DateOnly from, DateOnly to)
        {
            if (from >= to)
                return AppResponse<IEnumerable<ExpenseResponseDTO>>.Error(code: nameof(from), description: ValidationMessages.InvalidDate);

            var category = await unitOfWork.CategoryRepository
                .NoTrackable()
                .IgnoreQueryFilters()
                .Include(p => p.Expenses.Where(e => e.Date >= from && e.Date < to))
                .ThenInclude(e => e.Items.Where(i => i.Date >= from && i.Date < to)
                .OrderBy(item => item.Date))
                .Include(p => p.Expenses.Where(e => e.Date >= from && e.Date < to))
                .ThenInclude(e => e.Attachments)
                .FirstOrDefaultAsync(p => p.Id == categoryId) ?? throw new KeyNotFoundException(ValidationMessages.CategoryNotFound);

            var expenses = category.Expenses;

            return AppResponse<IEnumerable<ExpenseResponseDTO>>.Success(expenses.ToDTO());
        }

        public async Task<AppResponse<ExpenseResponseDTO>> GetByIdAsync(Guid expenseId)
        {
            var expense = await unitOfWork.ExpenseRepository.Trackable()
                .Include(e => e.Items.OrderBy(item => item.Date))
                .ThenInclude(e => e.CreatedBy)
                .Include(e => e.Items)
                .ThenInclude(e => e.Attachments)
                .Include(e => e.Attachments)
                .Include(e => e.CreatedBy)
                .FirstOrDefaultAsync(p => p.Id == expenseId) ?? throw new KeyNotFoundException(ValidationMessages.ExpenseNotFound); 

            return AppResponse<ExpenseResponseDTO>.Success(expense.ToDTO());
        }

        public async Task<AppResponse<ExpenseResponseDTO>> CreateAsync(User user, Guid projectId, Guid categoryId, ExpenseRequestDTO expenseDto)
        {
            if (expenseDto == default)
                return AppResponse<ExpenseResponseDTO>.Error(code: nameof(expenseDto), description: string.Format(ValidationMessages.PropertyCantBeNullOrEmpty, nameof(expenseDto)));

            if (user == default)
                return AppResponse<ExpenseResponseDTO>.Error(code: nameof(user), description: string.Format(ValidationMessages.PropertyCantBeNullOrEmpty, nameof(user)));

            var expense = expenseDto.FromDTO();
            expense.SetCreatedBy(user);

            var category = unitOfWork.CategoryRepository
                .Trackable()
                .Include(p => p.Expenses)
                .ThenInclude(e => e.Items)
                .FirstOrDefault(p => p.Id == categoryId);

            var savedExpense = unitOfWork.ExpenseRepository.InsertOrUpdate(expense);
            if (savedExpense.Failed)
                return AppResponse<ExpenseResponseDTO>.Error(savedExpense.Messages);

            category.AddExpense(savedExpense.Data);
            
            var savedCategory = unitOfWork.CategoryRepository.InsertOrUpdate(category);
            if (savedCategory.Failed)
                return AppResponse<ExpenseResponseDTO>.Error(savedCategory.Messages);

            await unitOfWork.CommitAsync();

            if (expenseDto.TemporaryAttachmentIds.Count > 0)
            {
                var attachTemporaryResponse = await this.attachmentService.AttachTemporaryToExpenseAsync(
                    user: user,
                    projectId: projectId,
                    categoryId: categoryId,
                    expenseId: expense.Id,
                    temporaryAttachmentIds: expenseDto.TemporaryAttachmentIds);

                if (attachTemporaryResponse.Failed)
                    return AppResponse<ExpenseResponseDTO>.Error(attachTemporaryResponse.Messages);
            }

            var attachTemporaryItemResponse = await this.AttachTemporaryToExpenseItemsAsync(
                user: user,
                projectId: projectId,
                categoryId: categoryId,
                expenseId: expense.Id,
                expenseItemDtos: expenseDto.Items,
                persistedExpenseItems: expense.Items);

            if (attachTemporaryItemResponse.Failed)
                return AppResponse<ExpenseResponseDTO>.Error(attachTemporaryItemResponse.Messages);

            var persistedExpense = await this.unitOfWork.ExpenseRepository.Trackable()
                .Include(e => e.Items.OrderBy(item => item.Date))
                .Include(e => e.Attachments)
                .FirstOrDefaultAsync(e => e.Id == expense.Id);

            return AppResponse<ExpenseResponseDTO>.Success(persistedExpense.ToDTO());
        }

        public async Task<AppResponse<ExpenseResponseDTO>> UpdateAsync(
           User user,
           Guid projectId,
           Guid categoryId,
           Guid expenseId,
            JsonPatchDocument<ExpenseRequestDTO> expenseDto)
        {
            if (expenseId == default)
                return AppResponse<ExpenseResponseDTO>.Error(code: nameof(expenseId), description: string.Format(ValidationMessages.PropertyCantBeNullOrEmpty, nameof(expenseId)));

            var existingExpense = await this.unitOfWork.ExpenseRepository.Trackable()
               .Include(e => e.Items.OrderBy(item => item.Date))
                    .ThenInclude(e => e.CreatedBy)
               .Include(e => e.Items)
                    .ThenInclude(e => e.Attachments)
               .Include(e => e.Attachments)
               .Include(e => e.CreatedBy)
               .FirstOrDefaultAsync(p => p.Id == expenseId);

            if (existingExpense == null)
                return AppResponse<ExpenseResponseDTO>.Error(code: nameof(expenseId), description: string.Format(ValidationMessages.PropertyCantBeNullOrEmpty, nameof(expenseId)));

            var dto = existingExpense.ToRequestDTO();

            if (dto.Items.Count == 0 && dto.Amount > 0 && expenseDto.Operations.Any(o => o.OperationType == OperationType.Add && o.path.Contains("items")))
            {
                dto.Items.Add(new ExpenseItemRequestDTO()
                {
                    Date = dto.Date,
                    Amount = dto.Amount
                });
            }

            expenseDto.ApplyTo(dto);

            dto.FromDTO(existingExpense);

            foreach (var expenseItem in existingExpense.Items.Where(item => item.Id == default))
            {
                expenseItem.SetCreatedBy(user);
            }

            var savedExpense = unitOfWork.ExpenseRepository.InsertOrUpdate(existingExpense);
            if (savedExpense.Failed)
                return AppResponse<ExpenseResponseDTO>.Error(savedExpense.Messages);

            await unitOfWork.CommitAsync();

            if (dto.TemporaryAttachmentIds.Count > 0)
            {
                var attachTemporaryResponse = await this.attachmentService.AttachTemporaryToExpenseAsync(
                    user: user,
                    projectId: projectId,
                    categoryId: categoryId,
                    expenseId: existingExpense.Id,
                    temporaryAttachmentIds: dto.TemporaryAttachmentIds);

                if (attachTemporaryResponse.Failed)
                    return AppResponse<ExpenseResponseDTO>.Error(attachTemporaryResponse.Messages);
            }

            var attachTemporaryItemResponse = await this.AttachTemporaryToExpenseItemsAsync(
                user: user,
                projectId: projectId,
                categoryId: categoryId,
                expenseId: existingExpense.Id,
                expenseItemDtos: dto.Items,
                persistedExpenseItems: existingExpense.Items);

            if (attachTemporaryItemResponse.Failed)
                return AppResponse<ExpenseResponseDTO>.Error(attachTemporaryItemResponse.Messages);

            var refreshedExpense = await this.unitOfWork.ExpenseRepository.Trackable()
                .Include(e => e.Items.OrderBy(item => item.Date))
                .Include(e => e.Items)
                .ThenInclude(item => item.Attachments)
                .Include(e => e.Attachments)
                .Include(e => e.CreatedBy)
                .FirstOrDefaultAsync(p => p.Id == expenseId);

            return AppResponse<ExpenseResponseDTO>.Success(refreshedExpense.ToDTO());
        }

        public async Task<AppResponse> DeleteAsync(Guid expenseId)
        {
            if (expenseId == Guid.Empty)
                AppResponse<ExpenseResponseDTO>.Error(code: nameof(expenseId), description: ValidationMessages.InvalidExpenseId);

            var expense = unitOfWork.ExpenseRepository.Trackable().FirstOrDefault(e => e.Id == expenseId);

            if (expense == null)
            {
                logger.LogWarning("Expense not found for deletion!");
                return AppResponse.Success();
            }

            unitOfWork.ExpenseRepository.Delete(expense);
            await unitOfWork.CommitAsync();

            return AppResponse.Success();
        }

        private async Task<AppResponse> AttachTemporaryToExpenseItemsAsync(
            User user,
            Guid projectId,
            Guid categoryId,
            Guid expenseId,
            ICollection<ExpenseItemRequestDTO> expenseItemDtos,
            ICollection<ExpenseItem> persistedExpenseItems)
        {
            if (expenseItemDtos == null || persistedExpenseItems == null)
                return AppResponse.Success();

            var dtoItems = expenseItemDtos.ToList();
            var persistedItems = persistedExpenseItems.ToList();
            var maxIndex = Math.Min(dtoItems.Count, persistedItems.Count);

            for (var index = 0; index < maxIndex; index++)
            {
                var temporaryAttachmentIds = dtoItems[index].TemporaryAttachmentIds;
                if (temporaryAttachmentIds == null || temporaryAttachmentIds.Count == 0)
                    continue;

                var expenseItemId = persistedItems[index].Id;
                if (expenseItemId == Guid.Empty)
                    return AppResponse.Error(nameof(expenseItemDtos), ValidationMessages.InvalidExpenseItemId);

                var attachTemporaryResponse = await this.attachmentService.AttachTemporaryToExpenseItemAsync(
                    user: user,
                    projectId: projectId,
                    categoryId: categoryId,
                    expenseId: expenseId,
                    expenseItemId: expenseItemId,
                    temporaryAttachmentIds: temporaryAttachmentIds);

                if (attachTemporaryResponse.Failed)
                    return attachTemporaryResponse;
            }

            return AppResponse.Success();
        }

        public async Task<AppResponse> RemoveLinkAsync(User user)
        {
            var response = AppResponse.Success();

            var expenses = unitOfWork.ExpenseRepository
                .Trackable()
                .Include(e => e.CreatedBy)
                .Where(expense => expense.CreatedBy.Id == user.Id)
                .ToList();

            foreach (var expense in expenses)
            {
                expense.RemoveUserLink();
                var savedExpense = unitOfWork.ExpenseRepository.InsertOrUpdate(expense);
                if (savedExpense.Failed)
                    response.AddErrorMessage(savedExpense.Messages);
            }

            await unitOfWork.CommitAsync();
            return response;
        }
    }
}
