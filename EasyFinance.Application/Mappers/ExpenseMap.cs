using EasyFinance.Application.Mappers;
using EasyFinance.Domain.Financial;
using EasyFinance.Application.DTOs.Financial;
using System.Collections.Generic;
using System;
using System.Linq;

namespace EasyFinance.Application.Mappers
{
    public static class ExpenseMap
    {
        public static IEnumerable<ExpenseResponseDTO> ToDTO(this ICollection<Expense> expenses) => expenses.Select(p => p.ToDTO());
        public static IEnumerable<ExpenseResponseDTO> ToDTO(this IEnumerable<Expense> expenses) => expenses.Select(p => p.ToDTO());

        public static ExpenseResponseDTO ToDTO(this Expense expense)
        {
            ArgumentNullException.ThrowIfNull(expense);

            return new ExpenseResponseDTO()
            {
                Id = expense.Id,
                Name = expense.Name,
                Date = expense.Date,
                Amount = expense.Amount,
                Budget = expense.Budget,
                Items = expense.Items.ToDTO(),
            };
        }

        public static ExpenseRequestDTO ToRequestDTO(this Expense expense)
        {
            ArgumentNullException.ThrowIfNull(expense);

            return new ExpenseRequestDTO()
            {
                Name = expense.Name,
                Date = expense.Date,
                Amount = expense.Amount,
                Budget = expense.Budget,
                Items = expense.Items.ToRequestDTO(),
            };
        }

        public static ICollection<Expense> FromDTO(this ICollection<ExpenseRequestDTO> expenseDTO, IList<Expense> expense = null)
            => expenseDTO.Select((expenseDTO, index) =>
            {
                if (index < expense.Count)
                    return expenseDTO.FromDTO(expense[index]);

                return expenseDTO.FromDTO();
            }).ToList();

        public static Expense FromDTO(this ExpenseRequestDTO expenseDTO, Expense expense = null)
        {
            ArgumentNullException.ThrowIfNull(expenseDTO);

            if (expense != null)
            {
                expense.SetName(expenseDTO.Name);
                expense.SetBudget(expenseDTO.Budget);
                expense.SetAmount(expenseDTO.Amount);
                expense.SetDate(expenseDTO.Date);
                expense.SetItems(expenseDTO.Items.FromDTO(expense.Items.ToList()));
                return expense;
            }

            return new Expense(expenseDTO.Name, expenseDTO.Date, expenseDTO.Amount, budget: expenseDTO.Budget, items: expenseDTO.Items.FromDTO());
        }
    }
}
