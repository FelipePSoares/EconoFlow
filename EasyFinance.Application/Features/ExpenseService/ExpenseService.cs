using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using EasyFinance.Application.Contracts.Persistence;
using EasyFinance.Application.DTOs.Financial;
using EasyFinance.Application.Mappers;
using EasyFinance.Domain.AccessControl;
using EasyFinance.Domain.Financial;
using EasyFinance.Infrastructure;
using EasyFinance.Infrastructure.DTOs;
using Microsoft.AspNetCore.JsonPatch;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace EasyFinance.Application.Features.ExpenseService
{
    public class ExpenseService : IExpenseService
    {
        private readonly IUnitOfWork unitOfWork;
        private readonly ILogger<ExpenseService> logger;

        public ExpenseService(IUnitOfWork unitOfWork, ILogger<ExpenseService> logger)
        {
            this.unitOfWork = unitOfWork;
            this.logger = logger;
        }

        public async Task<AppResponse<IEnumerable<ExpenseResponseDTO>>> GetAsync(Guid categoryId, DateOnly from, DateOnly to)
        {
            if (from >= to)
                return AppResponse<IEnumerable<ExpenseResponseDTO>>.Error(code: nameof(from), description: ValidationMessages.InvalidDate);

            var category = await unitOfWork.CategoryRepository
                .NoTrackable()
                .Include(p => p.Expenses.Where(e => e.Date >= from && e.Date < to))
                .ThenInclude(e => e.Items.Where(i => i.Date >= from && i.Date < to)
                .OrderBy(item => item.Date))
                .FirstOrDefaultAsync(p => p.Id == categoryId) ?? throw new KeyNotFoundException(ValidationMessages.CategoryNotFound);

            var expenses = category.Expenses;

            return AppResponse<IEnumerable<ExpenseResponseDTO>>.Success(expenses.ToDTO());
        }

        public async Task<AppResponse<ExpenseResponseDTO>> GetByIdAsync(Guid expenseId)
        {
            var expense = await unitOfWork.ExpenseRepository.Trackable()
                .Include(e => e.Items.OrderBy(item => item.Date))
                .ThenInclude(e => e.CreatedBy)
                .Include(e => e.Attachments)
                .Include(e => e.CreatedBy)
                .FirstOrDefaultAsync(p => p.Id == expenseId) ?? throw new KeyNotFoundException(ValidationMessages.ExpenseNotFound); 

            return AppResponse<ExpenseResponseDTO>.Success(expense.ToDTO());
        }

        public async Task<AppResponse<ExpenseResponseDTO>> CreateAsync(User user, Guid categoryId, Expense expense)
        {
            if (expense == default)
                return AppResponse<ExpenseResponseDTO>.Error(code: nameof(expense), description: string.Format(ValidationMessages.PropertyCantBeNullOrEmpty, nameof(expense)));

            if (user == default)
                return AppResponse<ExpenseResponseDTO>.Error(code: nameof(user), description: string.Format(ValidationMessages.PropertyCantBeNullOrEmpty, nameof(user)));

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

            return AppResponse<ExpenseResponseDTO>.Success(expense.ToDTO());
        }

        public async Task<AppResponse<ExpenseResponseDTO>> UpdateAsync(
           User user,
           Guid categoryId,
           Guid expenseId,
           JsonPatchDocument<ExpenseRequestDTO> expenseDto)
        {
            if (expenseId == default)
                return AppResponse<ExpenseResponseDTO>.Error(code: nameof(expenseId), description: string.Format(ValidationMessages.PropertyCantBeNullOrEmpty, nameof(expenseId)));

            var existingExpense = await this.unitOfWork.ExpenseRepository.Trackable()
               .Include(e => e.Items.OrderBy(item => item.Date))
                    .ThenInclude(e => e.CreatedBy)
               .Include(e => e.Attachments)
               .Include(e => e.CreatedBy)
               .FirstOrDefaultAsync(p => p.Id == expenseId);

            if (existingExpense == null)
                return AppResponse<ExpenseResponseDTO>.Error(code: nameof(expenseId), description: string.Format(ValidationMessages.PropertyCantBeNullOrEmpty, nameof(expenseId)));

            var dto = existingExpense.ToRequestDTO();

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

            return AppResponse<ExpenseResponseDTO>.Success(existingExpense.ToDTO());
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
