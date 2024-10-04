using System.Collections.Generic;
using EasyFinance.Domain.Models.Financial;

namespace EasyFinance.Common.Tests.Financial
{
    public class CategoryBuilder : IBuilder<Category>
    {
        private Category category;

        public CategoryBuilder()
        { 
            this.category = new Category();
        }

        public CategoryBuilder AddName(string name)
        {
            this.category.SetName(name);
            return this;
        }

        public CategoryBuilder AddExpenses(ICollection<Expense> expenses)
        {
            this.category.SetExpenses(expenses);
            return this;
        }

        public Category Build() => this.category;
    }
}
