using System;

namespace EasyFinance.Domain.Models
{
    public abstract class BaseEntity
    {
        public Guid Id { get; private set; } = Guid.NewGuid();
        public DateTime CreatedDate { get; private set; } = DateTime.Now;
        public DateTime LastUpdatedDate { get; private set; } = DateTime.Now;
    }
}
