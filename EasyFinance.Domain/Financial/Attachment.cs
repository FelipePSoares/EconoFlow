using EasyFinance.Domain.Models.AccessControl;
using EasyFinance.Infrastructure;
using EasyFinance.Infrastructure.Exceptions;

namespace EasyFinance.Domain.Models.Financial
{
    public class Attachment : BaseEntity
    {
        private Attachment() { }

        public Attachment(string name = "default", User createdBy = default)
        {
            this.SetName(name);
            this.SetCreatedBy(createdBy ?? new User());
        }

        public string Name { get; private set; } = string.Empty;
        public User CreatedBy { get; private set; } = new User();

        public void SetName(string name)
        {
            if (string.IsNullOrEmpty(name))
                throw new ValidationException(nameof(this.Name), string.Format(ValidationMessages.PropertyCantBeNullOrEmpty, nameof(this.Name)));

            this.Name = name;
        }

        public void SetCreatedBy(User createdBy)
        {
            if (createdBy == default)
                throw new ValidationException(nameof(this.CreatedBy), string.Format(ValidationMessages.PropertyCantBeNull, nameof(this.CreatedBy)));

            this.CreatedBy = createdBy;
        }
    }
}