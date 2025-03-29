using System;
using System.Collections.Generic;
using EasyFinance.Domain.AccessControl;
using EasyFinance.Infrastructure;
using EasyFinance.Infrastructure.Extensions;
using EasyFinance.Infrastructure.DTOs;

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
            SetAttachments(attachments ?? []);
        }

        public string Name { get; private set; } = string.Empty;
        public DateOnly Date { get; private set; }
        public virtual decimal Amount { get; private set; }
        public string CreatorName { get; private set; }
        public User CreatedBy { get; private set; } = new User();
        public ICollection<Attachment> Attachments { get; private set; } = [];

        public override AppResponse Validate
        {
            get
            {
                var response = AppResponse.Success();

                if (string.IsNullOrEmpty(Name))
                    response.AddErrorMessage(nameof(Name), string.Format(ValidationMessages.PropertyCantBeNullOrEmpty, nameof(Name)));

                if (Date < DateOnly.FromDateTime(DateTime.Today.ToUniversalTime().AddYears(-5)))
                    response.AddErrorMessage(nameof(Date), string.Format(ValidationMessages.CantAddExpenseOlderThanYears, 5));

                if (Date > DateOnly.FromDateTime(DateTime.Today.ToUniversalTime().AddDays(1)) && Amount > 0)
                    response.AddErrorMessage(nameof(Date), ValidationMessages.CantAddFutureExpenseIncome);

                if (Amount < 0)
                    response.AddErrorMessage(nameof(Amount), string.Format(ValidationMessages.PropertyCantBeLessThanZero, nameof(Amount)));

                if (string.IsNullOrEmpty(CreatorName) && CreatedBy == default)
                    response.AddErrorMessage(nameof(CreatedBy), string.Format(ValidationMessages.PropertyCantBeNull, nameof(CreatedBy)));

                if (string.IsNullOrEmpty(CreatorName))
                {
                    var userValidation = CreatedBy.Validate;
                    if (userValidation.Failed)
                        response.AddErrorMessage(userValidation.Messages.AddPrefix(nameof(CreatedBy)));
                }

                return response;
            }
        }

        public void SetName(string name) => Name = name;

        public void SetDate(DateOnly date) => Date = date;

        public void SetAmount(decimal amount) => Amount = amount;

        public void SetCreatedBy(User createdBy) 
            => CreatedBy = createdBy ?? throw new ArgumentNullException(null, string.Format(ValidationMessages.PropertyCantBeNull, nameof(createdBy)));

        public void RemoveUserLink()
        {
            CreatorName = this.CreatedBy.FullName;
            CreatedBy = null;
        }

        public void SetAttachments(ICollection<Attachment> attachments)
        {
            Attachments = attachments ?? throw new ArgumentNullException(null, string.Format(ValidationMessages.PropertyCantBeNull, nameof(attachments)));
        }
    }
}
