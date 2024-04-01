using EasyFinance.Domain.Models.AccessControl;
using System.Collections.Generic;
using System;

namespace EasyFinance.Domain.Models.Financial
{
    public class Income : BaseFinancial
    {
        private Income() { }

        public Income(
            string name = "default",
            DateTime date = default,
            decimal amount = default,
            User createdBy = default,
            ICollection<Attachment> attachments = default)
            : base(name, date, amount, createdBy, attachments)
        {
        }
    }
}
