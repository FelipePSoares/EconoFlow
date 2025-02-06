using System;
using System.Collections.Generic;
using EasyFinance.Domain.AccessControl;
using EasyFinance.Infrastructure;
using EasyFinance.Infrastructure.Exceptions;

namespace EasyFinance.Domain.Financial
{
    public abstract class BaseFinancial : BaseEntity
    {
        private BaseFinancial() { }

        public BaseFinancial(
            string name = "default",
            DateOnly date = default,
            decimal amount = default,
            User createdBy = default,
            ICollection<Attachment> attachments = default)
        {
            SetName(name);
            SetDate(date == default ? DateOnly.FromDateTime(DateTime.Today) : date);
            SetAmount(amount);
            SetCreatedBy(createdBy ?? new User());
            SetAttachments(attachments ?? new List<Attachment>());
        }

        public string Name { get; private set; } = string.Empty;
        public DateOnly Date { get; private set; }
        public decimal Amount { get; private set; }
        public string CreatorName { get; private set; }
        public User CreatedBy { get; private set; } = new User();
        public ICollection<Attachment> Attachments { get; private set; } = new List<Attachment>();

        public void SetName(string name)
        {
            if (string.IsNullOrEmpty(name))
                throw new ValidationException(nameof(Name), string.Format(ValidationMessages.PropertyCantBeNullOrEmpty, nameof(Name)));

            Name = name;
        }

        public void SetDate(DateOnly date)
        {
            if (date > DateOnly.FromDateTime(DateTime.Today.ToUniversalTime().AddDays(1)) && Amount > 0)
                throw new ValidationException(nameof(Date), ValidationMessages.CantAddFutureExpenseIncome);

            if (date < DateOnly.FromDateTime(DateTime.Today.ToUniversalTime().AddYears(-5)))
                throw new ValidationException(nameof(Date), string.Format(ValidationMessages.CantAddExpenseOlderThanYears, 5));

            Date = date;
        }

        public void SetAmount(decimal amount)
        {
            if (amount < 0)
                throw new ValidationException(nameof(Amount), string.Format(ValidationMessages.PropertyCantBeLessThanZero, nameof(Amount)));

            if (Date > DateOnly.FromDateTime(DateTime.Today.ToUniversalTime().AddDays(1)) && amount > 0)
                throw new ValidationException(nameof(Date), ValidationMessages.CantAddFutureExpenseIncome);

            Amount = amount;
        }

        public void SetCreatedBy(User createdBy)
        {
            CreatedBy = createdBy ?? throw new ValidationException(nameof(CreatedBy), string.Format(ValidationMessages.PropertyCantBeNull, nameof(CreatedBy)));
        }

        public void RemoveUserLink(string creatorName)
        {
            if (string.IsNullOrEmpty(creatorName))
                throw new ValidationException(nameof(creatorName), string.Format(ValidationMessages.PropertyCantBeNull, nameof(creatorName)));

            CreatedBy = null;
            CreatorName = creatorName;
        }

        public void SetAttachments(ICollection<Attachment> attachments)
        {
            Attachments = attachments ?? throw new ValidationException(nameof(Attachments), string.Format(ValidationMessages.PropertyCantBeNull, nameof(Attachments)));
        }
    }
}
