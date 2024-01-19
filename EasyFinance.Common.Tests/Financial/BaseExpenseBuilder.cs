using System.Collections.Generic;
using EasyFinance.Domain.Models.Financial;

namespace EasyFinance.Common.Tests.Financial
{
    public abstract class BaseExpenseBuilder<TEntity> : BaseFinancialBuilder<TEntity>
        where TEntity : BaseExpense
    {
        protected BaseExpenseBuilder(TEntity baseFinancial) : base(baseFinancial)
        {
        }

        public BaseExpenseBuilder<TEntity> AddItems(ICollection<ExpenseItem> Items)
        {
            this.entity.SetItems(Items);
            return this;
        }
    }
}
