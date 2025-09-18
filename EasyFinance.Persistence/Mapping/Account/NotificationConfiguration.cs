using EasyFinance.Domain.Account;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EasyFinance.Persistence.Mapping.Account
{
    public class NotificationConfiguration : BaseEntityConfiguration<Notification>
    {
        public override void ConfigureEntity(EntityTypeBuilder<Notification> builder)
        {
            builder.ToTable("Notifications");

            builder.HasQueryFilter(p => !p.IsRead);

            builder.Property(p => p.Type);
            builder.Property(p => p.Category);
            builder.Property(p => p.LimitNotificationChannels);

            builder.Property(p => p.CodeMessage)
                .HasMaxLength(200)
                .IsRequired();

            builder.Property(p => p.IsRead)
                .IsRequired()
                .HasDefaultValue(false);

            builder.Property(p => p.IsSent)
                .IsRequired()
                .HasDefaultValue(false);

            builder.Property(p => p.IsSticky)
                .IsRequired()
                .HasDefaultValue(false);

            builder.Property(p => p.ExpiresAt);

            builder.Property(p => p.ActionLabelCode)
                .HasMaxLength(200);

            builder.Property(p => p.Metadata);

            builder.HasOne(p => p.User)
                .WithMany()
                .IsRequired()
                .OnDelete(DeleteBehavior.Cascade);
        }
    }
}
