using EasyFinance.Domain.Models.Financial;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EasyFinance.Persistence.Mapping.Financial
{
    public class IncomeConfiguration : BaseEntityConfiguration<Income>
    {
        public override void ConfigureEntity(EntityTypeBuilder<Income> builder)
        {
            builder.ToTable("Incomes");

            builder.Property(p => p.Name)
                .HasMaxLength(150)
                .IsRequired();
            builder.Property(p => p.Date).IsRequired();
            builder.Property(p => p.Amount)
                .HasPrecision(18,2)
                .IsRequired();

            builder.HasOne(p => p.CreatedBy)
                .WithMany()
                .IsRequired();

            builder.HasMany(p => p.Attachments)
                .WithOne()
                .IsRequired();
        }
    }
}
