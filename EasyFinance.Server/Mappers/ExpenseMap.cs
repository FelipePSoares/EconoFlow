using EasyFinance.Domain.Models.Financial;
using EasyFinance.Server.DTOs.Financial;

namespace EasyFinance.Server.Mappers
{
    public static class ExpenseMap
    {
        public static IEnumerable<ExpenseResponseDTO> ToDTO(this ICollection<Expense> expenses) => expenses.Select(p => p.ToDTO());

        public static ExpenseResponseDTO ToDTO(this Expense expense)
        {
            ArgumentNullException.ThrowIfNull(expense);

            return new ExpenseResponseDTO()
            {
                Id = expense.Id,
                Name = expense.Name,
                Date = expense.Date,
                Amount = expense.Amount,
                Goal = expense.Goal,
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
                Goal = expense.Goal,
                Items = expense.Items.ToRequestDTO(),
            };
        }

        public static IEnumerable<Expense> FromDTO(this ICollection<ExpenseRequestDTO> expenses) => expenses.Select(p => p.FromDTO());

        public static Expense FromDTO(this ExpenseRequestDTO expenseDTO, Expense expense = null)
        {
            ArgumentNullException.ThrowIfNull(expenseDTO);

            if (expense != null)
            {
                expense.SetName(expenseDTO.Name);
                expense.SetDate(expenseDTO.Date);
                expense.SetAmount(expenseDTO.Amount);
                expense.SetGoal(expenseDTO.Goal);
                expense.SetItems(expenseDTO.Items.FromDTO());
            }

            return new Expense(expenseDTO.Name, expenseDTO.Date, expenseDTO.Amount, Goal: expenseDTO.Goal, items: expenseDTO.Items.FromDTO());
        }
    }
}
