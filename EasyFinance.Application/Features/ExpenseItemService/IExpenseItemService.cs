using EasyFinance.Domain.Models.AccessControl;
using System;
using System.Threading.Tasks;

namespace EasyFinance.Application.Features.ExpenseItemService
{
    public interface IExpenseItemService
    {
        Task DeleteAsync(Guid expenseItemId);
        Task RemoveLinkAsync(User user);
    }
}
