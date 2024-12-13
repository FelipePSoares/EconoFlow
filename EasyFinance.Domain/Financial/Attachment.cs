using EasyFinance.Domain.AccessControl;
using EasyFinance.Infrastructure;
using EasyFinance.Infrastructure.Exceptions;

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

        public void SetName(string name)
        {
            if (string.IsNullOrEmpty(name))
                throw new ValidationException(nameof(Name), string.Format(ValidationMessages.PropertyCantBeNullOrEmpty, nameof(Name)));

            Name = name;
        }

        public void SetCreatedBy(User createdBy)
        {
            if (createdBy == default)
                throw new ValidationException(nameof(CreatedBy), string.Format(ValidationMessages.PropertyCantBeNull, nameof(CreatedBy)));

            CreatedBy = createdBy;
        }
    }
}