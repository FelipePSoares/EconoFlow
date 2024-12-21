using EasyFinance.Application.Contracts.Persistence;
using EasyFinance.Infrastructure;
using EasyFinance.Infrastructure.DTOs;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using EasyFinance.Application.Mappers;
using EasyFinance.Domain.Financial;
using EasyFinance.Domain.AccessControl;
using EasyFinance.Application.DTOs.Financial;
using Microsoft.AspNetCore.JsonPatch;

namespace EasyFinance.Application.Features.ExpenseService
{
    public class ExpenseService : IExpenseService
    {
        private readonly IUnitOfWork unitOfWork;

        public ExpenseService(IUnitOfWork unitOfWork)
        {
            this.unitOfWork = unitOfWork;
        }

        public async Task<AppResponse<IEnumerable<ExpenseResponseDTO>>> GetAsync(Guid categoryId, DateTime from, DateTime to)
        {
            if (from >= to)
                return AppResponse<IEnumerable<ExpenseResponseDTO>>.Error(code: nameof(from), description: ValidationMessages.InvalidDate);

            var category = await unitOfWork.CategoryRepository
                .NoTrackable()
                .Include(p => p.Expenses.Where(e => e.Date >= from && e.Date < to))
                .ThenInclude(e => e.Items.Where(i => i.Date >= from && i.Date < to)
                .OrderBy(item => item.Date))
                .FirstOrDefaultAsync(p => p.Id == categoryId);

            if (category == null)
                return AppResponse<IEnumerable<ExpenseResponseDTO>>.Error(code: ValidationMessages.NotFound, description: ValidationMessages.CategoryNotFound);

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
                .FirstOrDefaultAsync(p => p.Id == expenseId);

            if (expense == null)
                return AppResponse<ExpenseResponseDTO>.Error(code: ValidationMessages.NotFound, description: ValidationMessages.ExpenseNotFound);

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

            unitOfWork.ExpenseRepository.InsertOrUpdate(expense);
            category.AddExpense(expense);
            unitOfWork.CategoryRepository.InsertOrUpdate(category);

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

            unitOfWork.ExpenseRepository.InsertOrUpdate(existingExpense);
            await unitOfWork.CommitAsync();

            return AppResponse<ExpenseResponseDTO>.Success(existingExpense.ToDTO());
        }

        public async Task<AppResponse> DeleteAsync(Guid expenseId)
        {
            if (expenseId == Guid.Empty)
                AppResponse<ExpenseResponseDTO>.Error(code: nameof(expenseId), description: ValidationMessages.InvalidExpenseId);

            var expense = unitOfWork.ExpenseRepository.Trackable().FirstOrDefault(e => e.Id == expenseId);

            if (expense == null)
                return AppResponse.Error(code: ValidationMessages.NotFound, ValidationMessages.ExpenseNotFound);

            unitOfWork.ExpenseRepository.Delete(expense);
            await unitOfWork.CommitAsync();

            return AppResponse.Success();
        }

        public async Task<AppResponse> RemoveLinkAsync(User user)
        {
            var expenses = unitOfWork.ExpenseRepository
                .Trackable()
                .Include(e => e.CreatedBy)
                .Where(expense => expense.CreatedBy.Id == user.Id)
                .ToList();

            foreach (var expense in expenses)
            {
                expense.RemoveUserLink($"{user.FirstName} {user.LastName}");
                unitOfWork.ExpenseRepository.InsertOrUpdate(expense);
            }

            await unitOfWork.CommitAsync();
            return AppResponse.Success();
        }       
    }
}
