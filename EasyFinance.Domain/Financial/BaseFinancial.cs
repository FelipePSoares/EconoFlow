using System;
using System.Collections.Generic;
using EasyFinance.Domain.Models.AccessControl;
using EasyFinance.Infrastructure;
using EasyFinance.Infrastructure.Exceptions;

namespace EasyFinance.Domain.Models.Financial
{
    public abstract class BaseFinancial : BaseEntity
    {
        private BaseFinancial() { }

        public BaseFinancial(
            string name = "default", 
            DateTime date = default, 
            decimal amount = default, 
            User createdBy = default, 
            ICollection<Attachment> attachments = default)
        {
            this.SetName(name);
            this.SetDate(date == default ? DateTime.Today : date);
            this.SetAmount(amount);
            this.SetCreatedBy(createdBy ?? new User());
            this.SetAttachments(attachments ?? new List<Attachment>());
        }

        public string Name { get; private set; } = string.Empty;
        public DateTime Date { get; private set; }
        public decimal Amount { get; private set; }
        public User CreatedBy { get; private set; } = new User();
        public ICollection<Attachment> Attachments { get; private set; } = new List<Attachment>();

        public void SetName(string name)
        {
            if (string.IsNullOrEmpty(name))
                throw new ValidationException(nameof(this.Name), string.Format(ValidationMessages.PropertyCantBeNullOrEmpty, nameof(this.Name)));

            this.Name = name;
        }

        public void SetDate(DateTime date)
        {
            if (date > DateTime.Today.AddDays(1))
                throw new ValidationException(nameof(this.Date), ValidationMessages.CantAddFutureExpense);

            if (date < DateTime.Today.AddYears(-5))
                throw new ValidationException(nameof(this.Date), string.Format(ValidationMessages.CantAddExpenseOlderThanYears, 5));

            this.Date = date;
        }

        public void SetAmount(decimal amount)
        {
            if (amount < 0)
                throw new ValidationException(nameof(this.Amount), string.Format(ValidationMessages.PropertyCantBeLessThanZero, nameof(this.Amount)));

            this.Amount = amount;
        }

        public void SetCreatedBy(User createdBy)
        {
            if (createdBy == default)
                throw new ValidationException(nameof(this.CreatedBy), string.Format(ValidationMessages.PropertyCantBeNull, nameof(this.CreatedBy)));

            this.CreatedBy = createdBy;
        }

        public void SetAttachments(ICollection<Attachment> attachments)
        {
            if (attachments == default)
                throw new ValidationException(nameof(this.Attachments), string.Format(ValidationMessages.PropertyCantBeNull, nameof(this.Attachments)));

            this.Attachments = attachments;
        }
    }
}
