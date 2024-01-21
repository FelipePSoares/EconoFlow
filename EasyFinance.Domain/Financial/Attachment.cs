using EasyFinance.Domain.Models.AccessControl;
using EasyFinance.Infrastructure;
using EasyFinance.Infrastructure.Exceptions;

namespace EasyFinance.Domain.Models.Financial
{
    public class Attachment : BaseEntity
    {
        public Attachment(string name = "default", User createdBy = default)
        {
            this.SetName(name);
            this.SetCreatedBy(createdBy ?? new User());
        }

        public string Name { get; private set; } = string.Empty;
        public User CreatedBy { get; private set; } = new User();

        public void SetName(string name)
        {
            this.Name = name;

            if (string.IsNullOrEmpty(this.Name))
                throw new ValidationException(nameof(this.Name), string.Format(ValidationMessages.PropertyCantBeNullOrEmpty, nameof(this.Name)));
        }

        public void SetCreatedBy(User createdBy)
        {
            this.CreatedBy = createdBy;

            if (this.CreatedBy == default)
                throw new ValidationException(nameof(this.CreatedBy), string.Format(ValidationMessages.PropertyCantBeNull, nameof(this.CreatedBy)));
        }
    }
}