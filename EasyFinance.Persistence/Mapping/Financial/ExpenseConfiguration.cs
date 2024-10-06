using EasyFinance.Domain.Models.Financial;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EasyFinance.Persistence.Mapping.Financial
{
    public class ExpenseConfiguration : BaseEntityConfiguration<Expense>
    {
        public override void ConfigureEntity(EntityTypeBuilder<Expense> builder)
        {
            builder.ToTable("Expenses");

            builder.Property(p => p.Budget);

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
                .IsRequired()
                .OnDelete(DeleteBehavior.Restrict);

            builder.HasMany(p => p.Items)
                .WithOne()
                .OnDelete(DeleteBehavior.Restrict);
        }
    }
}
