using System;
using System.Collections.Generic;
using EasyFinance.Domain.Models.AccessControl;
using EasyFinance.Infrastructure;
using EasyFinance.Infrastructure.Exceptions;

namespace EasyFinance.Domain.Models.Financial
{
    public abstract class BaseFinancial : BaseEntity
    {
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
            this.Name = name;

            if (string.IsNullOrEmpty(this.Name))
                throw new ValidationException(nameof(this.Name), string.Format(ValidationMessages.PropertyCantBeNullOrEmpty, nameof(this.Name)));
        }

        public void SetDate(DateTime date)
        {
            this.Date = date;

            if (this.Date > DateTime.Today)
                throw new ValidationException(nameof(this.Date), ValidationMessages.InvalidDate);

            if (this.Date < DateTime.Today.AddYears(-5))
                throw new ValidationException(nameof(this.Date), ValidationMessages.InvalidDate);
        }

        public void SetAmount(decimal amount)
        {
            this.Amount = amount;

            if (this.Amount < 0)
                throw new ValidationException(nameof(this.Amount), string.Format(ValidationMessages.PropertyCantBeLessThanZero, nameof(this.Amount)));
        }

        public void SetCreatedBy(User createdBy)
        {
            this.CreatedBy = createdBy;

            if (this.CreatedBy == default)
                throw new ValidationException(nameof(this.CreatedBy), string.Format(ValidationMessages.PropertyCantBeNull, nameof(this.CreatedBy)));
        }

        public void SetAttachments(ICollection<Attachment> attachments)
        {
            this.Attachments = attachments;

            if (this.Attachments == default)
                throw new ValidationException(nameof(this.Attachments), string.Format(ValidationMessages.PropertyCantBeNull, nameof(this.Attachments)));
        }
    }
}
