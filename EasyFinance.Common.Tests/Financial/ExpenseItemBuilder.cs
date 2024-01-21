using EasyFinance.Domain.Models.Financial;

namespace EasyFinance.Common.Tests.Financial
{
    public class ExpenseItemBuilder : BaseExpenseBuilder<ExpenseItem>
    {
        public ExpenseItemBuilder() : base(new ExpenseItem())
        {
        }
    }
}
