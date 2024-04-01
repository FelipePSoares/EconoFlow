using EasyFinance.Domain.Models.AccessControl;
using System.Collections.Generic;
using System;

namespace EasyFinance.Domain.Models.Financial
{
    public class ExpenseItem : BaseExpense
    {
        private ExpenseItem() { }

        public ExpenseItem(
            string name = "default",
            DateTime date = default,
            decimal amount = default,
            User createdBy = default,
            ICollection<Attachment> attachments = default,
            ICollection<ExpenseItem> items = default)
            : base(name, date, amount, createdBy, attachments, items)
        {
        }
    }
}
