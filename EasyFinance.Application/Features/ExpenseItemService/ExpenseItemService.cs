using EasyFinance.Application.Contracts.Persistence;
using EasyFinance.Domain.Models.AccessControl;
using System;
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

        public async Task DeleteAsync(Guid expenseItemId)
        {
            if (expenseItemId == Guid.Empty)
                throw new ArgumentNullException(nameof(expenseItemId), "The id is not valid");

            var expenseItem = unitOfWork.ExpenseItemRepository.Trackable().FirstOrDefault(e => e.Id == expenseItemId);

            if (expenseItem == null)
                return;

            unitOfWork.ExpenseItemRepository.Delete(expenseItem);
            await unitOfWork.CommitAsync();
        }

        public async Task RemoveLinkAsync(User user)
        {
            var expenseItems = unitOfWork.ExpenseItemRepository.Trackable().Where(expenseItem => expenseItem.CreatedBy.Id == user.Id).ToList();


            foreach (var expenseItem in expenseItems)
            {
                expenseItem.RemoveUserLink($"{user.FirstName} {user.LastName}");
                unitOfWork.ExpenseItemRepository.InsertOrUpdate(expenseItem);
            }

            await unitOfWork.CommitAsync();
        }
    }
}
