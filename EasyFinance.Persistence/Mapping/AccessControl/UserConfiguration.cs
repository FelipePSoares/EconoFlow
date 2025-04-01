using EasyFinance.Domain.AccessControl;
using EasyFinance.Domain.FinancialProject;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EasyFinance.Persistence.Mapping.AccessControl
{
    public class UserConfiguration : IEntityTypeConfiguration<User>
    {
        public void Configure(EntityTypeBuilder<User> builder)
        {
            builder.HasQueryFilter(p => p.Enabled);

            builder.Ignore(p => p.HasIncompletedInformation);

            builder.Property(p => p.FirstName)
                .HasMaxLength(256)
                .IsRequired();

            builder.Property(p => p.LastName)
                .HasMaxLength(256)
                .IsRequired();

            builder.Property(p => p.Enabled)
                .IsRequired();

            builder.Property(p => p.SubscriptionLevel)
                .HasDefaultValue(SubscriptionLevels.Free)
                .IsRequired();

            builder.HasOne<Project>()
                .WithMany()
                .HasForeignKey(p => p.DefaultProjectId)
                .OnDelete(DeleteBehavior.ClientNoAction);
        }
    }
}
