using System;
using EasyFinance.Domain.AccessControl;
using EasyFinance.Infrastructure;
using EasyFinance.Infrastructure.DTOs;
using EasyFinance.Infrastructure.Extensions;

namespace EasyFinance.Domain.Financial
{
    public class Attachment : BaseEntity
    {
        private Attachment() { }

        public Attachment(string name = "default", User createdBy = default)
        {
            SetName(name);
            SetCreatedBy(createdBy ?? new User());
        }

        public string Name { get; private set; } = string.Empty;
        public User CreatedBy { get; private set; } = new User();

        public override AppResponse Validate {
            get
            {
                var response = AppResponse.Success();

                if (string.IsNullOrEmpty(Name))
                    response.AddErrorMessage(nameof(Name), string.Format(ValidationMessages.PropertyCantBeNullOrEmpty, nameof(Name)));

                var userValidation = CreatedBy.Validate;
                if (userValidation.Failed)
                    response.AddErrorMessage(userValidation.Messages.AddPrefix(nameof(CreatedBy)));

                return response;
            }
        }

        public void SetName(string name)
        {
            Name = name;
        }

        public void SetCreatedBy(User createdBy)
        {
            CreatedBy = createdBy ?? throw new ArgumentNullException(null, string.Format(ValidationMessages.PropertyCantBeNull, nameof(createdBy)));
        }
    }
}