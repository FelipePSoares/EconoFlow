using EasyFinance.Domain.AccessControl;
using EasyFinance.Infrastructure.DTOs;
using System;
using System.Threading.Tasks;

namespace EasyFinance.Application.Features.ExpenseItemService
{
    public interface IExpenseItemService
    {
        Task<AppResponse> DeleteAsync(Guid expenseItemId);
        Task<AppResponse> RemoveLinkAsync(User user);
    }
}
