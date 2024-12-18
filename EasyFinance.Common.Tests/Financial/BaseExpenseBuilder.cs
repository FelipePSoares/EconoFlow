using System.Collections.Generic;
using EasyFinance.Domain.Financial;

namespace EasyFinance.Common.Tests.Financial
{
    public abstract class BaseExpenseBuilder<TEntity> : BaseFinancialBuilder<TEntity>
        where TEntity : BaseExpense
    {
        protected BaseExpenseBuilder(TEntity baseFinancial) : base(baseFinancial)
        {
        }

        public BaseExpenseBuilder<TEntity> SetItems(ICollection<ExpenseItem> Items)
        {
            this.entity.SetItems(Items);
            return this;
        }

        public BaseExpenseBuilder<TEntity> AddItem(ExpenseItem Item)
        {
            this.entity.AddItem(Item);
            return this;
        }
    }
}
