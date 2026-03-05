using EasyFinance.Domain.Financial;
using EasyFinance.Infrastructure;
using EasyFinance.Infrastructure.DTOs;
using System;

namespace EasyFinance.Domain.FinancialProject
{
    public class DeductibleGroupExpense : BaseEntity
    {
        private DeductibleGroupExpense() { }

        public DeductibleGroupExpense(Guid groupId = default, Guid expenseId = default)
        {
            SetGroupId(groupId);
            SetExpenseId(expenseId);
        }

        public Guid GroupId { get; private set; }
        public DeductibleGroup Group { get; private set; }
        public Guid ExpenseId { get; private set; }
        public Expense Expense { get; private set; }

        public override AppResponse Validate
        {
            get
            {
                var response = AppResponse.Success();

                if (GroupId == Guid.Empty)
                    response.AddErrorMessage(nameof(GroupId), ValidationMessages.DeductibleGroupNotFound);

                if (ExpenseId == Guid.Empty)
                    response.AddErrorMessage(nameof(ExpenseId), ValidationMessages.InvalidExpenseId);

                return response;
            }
        }

        public void SetGroupId(Guid groupId) => GroupId = groupId;

        public void SetExpenseId(Guid expenseId) => ExpenseId = expenseId;
    }
}
