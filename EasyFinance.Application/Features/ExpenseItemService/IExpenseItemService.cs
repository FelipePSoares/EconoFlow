using EasyFinance.Domain.AccessControl;
using EasyFinance.Infrastructure.DTOs;
using System;
using System.Threading.Tasks;

namespace EasyFinance.Application.Features.ExpenseItemService
{
    public interface IExpenseItemService
    {
        Task<AppResponse> MoveAsync(
            Guid projectId,
            Guid sourceCategoryId,
            Guid sourceExpenseId,
            Guid expenseItemId,
            Guid targetCategoryId,
            Guid targetExpenseId);
        Task<AppResponse> DeleteAsync(Guid expenseItemId);
        Task<AppResponse> RemoveLinkAsync(User user);
    }
}
