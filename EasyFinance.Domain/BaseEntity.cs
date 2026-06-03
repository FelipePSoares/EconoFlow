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
        public DateTime CreatedDate { get; private set; } = DateTime.Now;
        public DateTime ModifiedAt { get; private set; } = DateTime.Now;

        public void SetCreatedDate(DateTime createdDate) => CreatedDate = createdDate;
        public void SetModifiedAt(DateTime modifiedAt) => ModifiedAt = modifiedAt;
        
        public abstract AppResponse Validate { get; }
    }
}
