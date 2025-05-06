using EasyFinance.Domain.Financial;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EasyFinance.Persistence.Mapping.Financial
{
    public class PaymentConfiguration : BaseEntityConfiguration<Payment>
    {
        public override void ConfigureEntity(EntityTypeBuilder<Payment> builder)
        {
            builder.ToTable("Payments");

            builder.Property(p => p.Amount)
                .HasPrecision(18, 2)
                .IsRequired();

            builder.Property(p => p.Status)
                .IsRequired()
                .HasDefaultValue(PaymentStatus.Pending);

            builder.Property(p => p.Type)
                .IsRequired();

            builder.Property(p => p.Frequency);

            builder.Property(p => p.Date)
                .IsRequired();

            builder.HasOne(p => p.Client)
                .WithMany();
        }
    }
}
