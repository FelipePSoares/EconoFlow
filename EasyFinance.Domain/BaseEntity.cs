using System;
using EasyFinance.Infrastructure;
using EasyFinance.Infrastructure.Exceptions;

namespace EasyFinance.Domain.Models
{
    public abstract class BaseEntity
    {
        protected BaseEntity() { }

        public BaseEntity(Guid id = default)
        {
            if (id != default)
                this.Id = id;
        }

        public void SetId(Guid id)
        {
            if (id == default)
                throw new ValidationException(nameof(this.Id), string.Format(ValidationMessages.PropertyCantBeNull, nameof(this.Id)));

            this.Id = id;
        }

        public Guid Id { get; private set; } = default;
        public DateTime CreatedDate { get; set; } = DateTime.Now;
        public DateTime ModifiedAt { get; set; } = DateTime.Now;
    }
}
