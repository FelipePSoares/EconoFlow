using EasyFinance.Application.Contracts.Persistence;
using EasyFinance.Application.DTOs.Financial;
using EasyFinance.Application.Mappers;
using EasyFinance.Domain.AccessControl;
using EasyFinance.Infrastructure;
using EasyFinance.Infrastructure.DTOs;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace EasyFinance.Application.Features.ExpenseItemService
{
    public class ExpenseItemService : IExpenseItemService
    {
        private readonly IUnitOfWork unitOfWork;

        public ExpenseItemService(IUnitOfWork unitOfWork)
        {
            this.unitOfWork = unitOfWork;
        }

        public async Task<AppResponse> DeleteAsync(Guid expenseItemId)
        {
            if (expenseItemId == Guid.Empty)
                return AppResponse.Error(code: nameof(expenseItemId), description: ValidationMessages.InvalidExpenseItemId);

            var expenseItem = unitOfWork.ExpenseItemRepository.Trackable().FirstOrDefault(e => e.Id == expenseItemId);

            if (expenseItem == null)
                return AppResponse.Error(code: ValidationMessages.NotFound, description: ValidationMessages.ExpenseItemNotFound);

            unitOfWork.ExpenseItemRepository.Delete(expenseItem);
            await unitOfWork.CommitAsync();

            return AppResponse.Success();
        }

        public async Task<AppResponse> RemoveLinkAsync(User user)
        {
            var expenseItems = unitOfWork.ExpenseItemRepository.Trackable().Where(expenseItem => expenseItem.CreatedBy.Id == user.Id).ToList();


            foreach (var expenseItem in expenseItems)
            {
                expenseItem.RemoveUserLink($"{user.FirstName} {user.LastName}");
                unitOfWork.ExpenseItemRepository.InsertOrUpdate(expenseItem);
            }

            await unitOfWork.CommitAsync();
            
            return AppResponse.Success();
        }
        

        public Task<AppResponse<ICollection<ExpenseItemResponseDTO>>> GetLatestAsync(Guid projectId, int numberOfTransactions)
        {
            var result = 
                await unitOfWork.ProjectRepository
                .NoTrackable()
                .Include(p => p.Categories)
                    .ThenInclude(c => c.Expenses)
                        .ThenInclude(e => e.Items)
                .FirstOrDefault(p => p.Id == projectId)
                .Categories
                .SelectMany(c => c.Expenses)
                .SelectMany(e => e.Items)
                .OrderByDescending(i => i.Date)
                .Take(numberOfTransactions)
                .ToDTO()
                .ToListAsync();

            return AppResponse<ICollection<ExpenseItemResponseDTO>>.Success(result);
        }
    }
}
