using EasyFinance.Application.Contracts.Persistence;
using EasyFinance.Domain.Models.AccessControl;
using EasyFinance.Domain.Models.Financial;
using EasyFinance.Domain.Models.FinancialProject;
using EasyFinance.Infrastructure;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace EasyFinance.Application.Features.ExpenseService
{
    public class ExpenseService : IExpenseService
    {
        private readonly IUnitOfWork unitOfWork;

        public ExpenseService(IUnitOfWork unitOfWork)
        {
            this.unitOfWork = unitOfWork;
        }

        public async Task<ICollection<Expense>> GetAsync(Guid categoryId, DateTime from, DateTime to)
        {
            return (await this.unitOfWork.CategoryRepository.NoTrackable()
                .Include(p => p.Expenses.Where(e => e.Date >= from && e.Date <= to))
                    .ThenInclude(e => e.Items.Where(i => i.Date >= from && i.Date <= to).OrderBy(item => item.Date))
                .FirstOrDefaultAsync(p => p.Id == categoryId)).Expenses;
        }

        public async Task<Expense> GetByIdAsync(Guid expenseId)
        {
            return await this.unitOfWork.ExpenseRepository.NoTrackable()
                .Include(e => e.Items.OrderBy(item => item.Date))
                .FirstOrDefaultAsync(p => p.Id == expenseId);
        }

        public async Task<Expense> CreateAsync(User user, Guid categoryId, Expense expense)
        {
            if (expense == default)
                throw new ArgumentNullException(nameof(expense), string.Format(ValidationMessages.PropertyCantBeNullOrEmpty, nameof(expense)));

            if (user == default)
                throw new ArgumentNullException(nameof(user), string.Format(ValidationMessages.PropertyCantBeNullOrEmpty, nameof(user)));

            expense.SetCreatedBy(user);

            var category = unitOfWork.CategoryRepository.Trackable()
                .Include(p => p.Expenses)
                    .ThenInclude(e => e.Items)
                .FirstOrDefault(p => p.Id == categoryId);

            this.unitOfWork.ExpenseRepository.InsertOrUpdate(expense);
            category.AddExpense(expense);
            this.unitOfWork.CategoryRepository.InsertOrUpdate(category);

            await unitOfWork.CommitAsync();

            return expense;
        }

        public async Task<Expense> UpdateAsync(Expense expense)
        {
            if (expense == default)
                throw new ArgumentNullException(nameof(expense), string.Format(ValidationMessages.PropertyCantBeNullOrEmpty, nameof(expense)));

            unitOfWork.ExpenseRepository.InsertOrUpdate(expense);
            await unitOfWork.CommitAsync();

            return expense;
        }

        public async Task DeleteAsync(Guid expenseId)
        {
            if (expenseId == Guid.Empty)
                throw new ArgumentNullException(nameof(expenseId), "The id is not valid");

            var expense = unitOfWork.ExpenseRepository.Trackable().FirstOrDefault(e => e.Id == expenseId);

            if (expense == null)
                return;

            unitOfWork.ExpenseRepository.Delete(expense);
            await unitOfWork.CommitAsync();
        }
    }
}
