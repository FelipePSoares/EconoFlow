using EasyFinance.Domain.Financial;
using EasyFinance.Infrastructure;
using EasyFinance.Infrastructure.DTOs;
using System;

namespace EasyFinance.Domain.FinancialProject
{
    public class DeductibleGroupExpense : BaseEntity
    {
        private DeductibleGroupExpense() { }

        public DeductibleGroupExpense(Guid groupId = default, Guid? expenseId = null, Guid? expenseItemId = null)
        {
            SetGroupId(groupId);
            SetExpenseId(expenseId);
            SetExpenseItemId(expenseItemId);
        }

        public Guid GroupId { get; private set; }
        public DeductibleGroup Group { get; private set; }
        public Guid? ExpenseId { get; private set; }
        public Expense Expense { get; private set; }
        public Guid? ExpenseItemId { get; private set; }
        public ExpenseItem ExpenseItem { get; private set; }

        public override AppResponse Validate
        {
            get
            {
                var response = AppResponse.Success();

                if (GroupId == Guid.Empty)
                    response.AddErrorMessage(nameof(GroupId), ValidationMessages.DeductibleGroupNotFound);

                if (ExpenseId.HasValue && ExpenseId.Value == Guid.Empty)
                    response.AddErrorMessage(nameof(ExpenseId), ValidationMessages.InvalidExpenseId);

                if (ExpenseItemId.HasValue && ExpenseItemId.Value == Guid.Empty)
                    response.AddErrorMessage(nameof(ExpenseItemId), ValidationMessages.InvalidExpenseItemId);

                var hasExpenseId = ExpenseId.HasValue && ExpenseId.Value != Guid.Empty;
                var hasExpenseItemId = ExpenseItemId.HasValue && ExpenseItemId.Value != Guid.Empty;

                if (hasExpenseId == hasExpenseItemId)
                {
                    response.AddErrorMessage(nameof(ExpenseId), ValidationMessages.InvalidExpenseId);
                    response.AddErrorMessage(nameof(ExpenseItemId), ValidationMessages.InvalidExpenseItemId);
                }

                return response;
            }
        }

        public void SetGroupId(Guid groupId) => GroupId = groupId;

        public void SetExpenseId(Guid? expenseId) => ExpenseId = expenseId;

        public void SetExpenseItemId(Guid? expenseItemId) => ExpenseItemId = expenseItemId;
    }
}
