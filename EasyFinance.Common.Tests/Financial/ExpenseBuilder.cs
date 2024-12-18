using EasyFinance.Domain.Financial;

namespace EasyFinance.Common.Tests.Financial
{
    public class ExpenseBuilder : BaseExpenseBuilder<Expense>
    {
        public ExpenseBuilder() : base(new Expense())
        {
        }

        public ExpenseBuilder SetBudget(int budget)
        {
            this.entity.SetBudget(budget);
            return this;
        }
    }
}
