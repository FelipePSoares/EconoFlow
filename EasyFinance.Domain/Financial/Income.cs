using System;
using System.Collections.Generic;
using EasyFinance.Domain.AccessControl;

namespace EasyFinance.Domain.Financial
{
    public class Income : BaseFinancial
    {
        private Income() { }

        public Income(
            string name = "default",
            DateOnly date = default,
            decimal amount = default,
            User createdBy = default,
            ICollection<Attachment> attachments = default)
            : base(name, date, amount, createdBy, attachments)
        {
        }
    }
}
