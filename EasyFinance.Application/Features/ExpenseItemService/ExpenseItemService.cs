using EasyFinance.Application.Contracts.Persistence;
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
    }
}
