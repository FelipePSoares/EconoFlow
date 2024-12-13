using EasyFinance.Domain.AccessControl;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EasyFinance.Persistence.Mapping.AccessControl
{
    public class UserConfiguration : IEntityTypeConfiguration<User>
    {
        public void Configure(EntityTypeBuilder<User> builder)
        {
            builder.Ignore(p => p.HasIncompletedInformation);

            builder.Property(p => p.FirstName)
                .HasMaxLength(256)
                .IsRequired();

            builder.Property(p => p.LastName)
                .HasMaxLength(256)
                .IsRequired();

            builder.Property(p => p.Enabled)
                .IsRequired();

            builder.Property(p => p.PreferredCurrency)
                .HasMaxLength(3);

            builder.Property(p => p.TimeZoneId)
                .HasMaxLength(255);
        }
    }
}
