using EasyFinance.Domain.Models.AccessControl;
using EasyFinance.Domain.Models.Financial;
using System;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace EasyFinance.Application.Features.ExpenseService
{
    public interface IExpenseService
    {
        Task<ICollection<Expense>> GetAsync(Guid categoryId, DateTime from, DateTime to);
        Task<Expense> GetByIdAsync(Guid expenseId);
        Task<Expense> CreateAsync(User user, Guid categoryId, Expense expense);
        Task<Expense> UpdateAsync(Expense expense);
        Task DeleteAsync(Guid expenseId);
    }
}
