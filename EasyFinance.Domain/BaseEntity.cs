using System;
using EasyFinance.Infrastructure.DTOs;

namespace EasyFinance.Domain
{
    public abstract class BaseEntity
    {
        protected BaseEntity() { }

        public BaseEntity(Guid id = default)
        {
            if (id != default)
                Id = id;
        }

        public void SetId(Guid id)
        {
            ArgumentNullException.ThrowIfNull(id);

            Id = id;
        }

        public Guid Id { get; private set; } = default;
        public DateTime CreatedDate { get; set; } = DateTime.Now;
        public DateTime ModifiedAt { get; set; } = DateTime.Now;

        public abstract AppResponse Validate { get; }
    }
}
