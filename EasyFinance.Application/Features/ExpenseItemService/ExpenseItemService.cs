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
