using EasyFinance.Application.DTOs.Financial;
using EasyFinance.Domain.AccessControl;
using EasyFinance.Domain.Financial;
using EasyFinance.Infrastructure.DTOs;
using Microsoft.AspNetCore.JsonPatch;
using System;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace EasyFinance.Application.Features.ExpenseService
{
    public interface IExpenseService
    {
        Task<AppResponse<IEnumerable<ExpenseResponseDTO>>> GetAsync(Guid categoryId, DateTime from, DateTime to);
        Task<AppResponse<ExpenseResponseDTO>> GetByIdAsync(Guid expenseId);
        Task<AppResponse<ExpenseResponseDTO>> CreateAsync(User user, Guid categoryId, Expense expense);
        Task<AppResponse<ExpenseResponseDTO>> UpdateAsync(User user, Guid categoryId, Guid expenseId, JsonPatchDocument<ExpenseRequestDTO> expenseDto);
        Task<AppResponse> DeleteAsync(Guid expenseId);
        Task<AppResponse> RemoveLinkAsync(User user);
    }
}
