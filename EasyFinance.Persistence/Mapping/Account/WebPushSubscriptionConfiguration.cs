using EasyFinance.Domain.AccessControl;
using EasyFinance.Domain.Account;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EasyFinance.Persistence.Mapping.Account
{
    public class WebPushSubscriptionConfiguration : BaseEntityConfiguration<WebPushSubscription>
    {
        public override void ConfigureEntity(EntityTypeBuilder<WebPushSubscription> builder)
        {
            builder.ToTable("WebPushSubscriptions");

            builder.Property(p => p.CreatedDate)
                .HasColumnName("CreatedAt");

            builder.Property(p => p.Endpoint)
                .HasMaxLength(2048)
                .IsRequired();

            builder.Property(p => p.P256dh)
                .HasMaxLength(512)
                .IsRequired();

            builder.Property(p => p.Auth)
                .HasMaxLength(512)
                .IsRequired();

            builder.Property(p => p.UserAgent)
                .HasMaxLength(512);

            builder.Property(p => p.LastUsedAt)
                .IsRequired();

            builder.Property(p => p.RevokedAt);

            builder.Property(p => p.DeviceType)
                .IsRequired();

            builder.HasOne<User>()
                .WithMany()
                .HasForeignKey(p => p.UserId)
                .OnDelete(DeleteBehavior.Cascade);

            builder.HasIndex(p => p.Endpoint)
                .IsUnique();

            builder.HasIndex(p => new { p.UserId, p.RevokedAt });
        }
    }
}
