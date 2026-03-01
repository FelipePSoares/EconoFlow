using EasyFinance.Domain.Financial;

namespace EasyFinance.Common.Tests.Financial
{
    public class ExpenseItemBuilder : BaseExpenseBuilder<ExpenseItem>
    {
        public ExpenseItemBuilder() : base(new ExpenseItem())
        {
        }

        public new ExpenseItemBuilder SetIsDeductible(bool isDeductible)
        {
            this.entity.SetIsDeductible(isDeductible);
            return this;
        }
    }
}
