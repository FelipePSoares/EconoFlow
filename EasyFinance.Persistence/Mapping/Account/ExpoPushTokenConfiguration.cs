using EasyFinance.Domain.AccessControl;
using EasyFinance.Domain.Account;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EasyFinance.Persistence.Mapping.Account
{
    public class ExpoPushTokenConfiguration : BaseEntityConfiguration<ExpoPushToken>
    {
        public override void ConfigureEntity(EntityTypeBuilder<ExpoPushToken> builder)
        {
            builder.ToTable("ExpoPushTokens");

            builder.Property(p => p.CreatedDate)
                .HasColumnName("CreatedAt");

            builder.Property(p => p.Token)
                .HasMaxLength(512)
                .IsRequired();

            builder.Property(p => p.DeviceName)
                .HasMaxLength(256);

            builder.Property(p => p.RevokedAt);

            builder.HasOne<User>()
                .WithMany()
                .HasForeignKey(p => p.UserId)
                .OnDelete(DeleteBehavior.Cascade);

            builder.HasIndex(p => p.Token)
                .IsUnique();

            builder.HasIndex(p => new { p.UserId, p.RevokedAt });
        }
    }
}
