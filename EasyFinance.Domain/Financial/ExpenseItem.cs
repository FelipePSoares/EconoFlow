using System;
using System.Collections.Generic;
using EasyFinance.Domain.AccessControl;

namespace EasyFinance.Domain.Financial
{
    public class ExpenseItem : BaseExpense
    {
        private ExpenseItem() { }

        public ExpenseItem(
            string name = "default",
            DateOnly date = default,
            decimal amount = default,
            User createdBy = default,
            ICollection<Attachment> attachments = default,
            ICollection<ExpenseItem> items = default)
            : base(name, date, amount, createdBy, attachments, items)
        {
        }
    }
}
