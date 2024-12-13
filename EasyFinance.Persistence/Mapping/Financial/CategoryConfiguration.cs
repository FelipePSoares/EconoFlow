using EasyFinance.Domain.Financial;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EasyFinance.Persistence.Mapping.Financial
{
    public class CategoryConfiguration : BaseEntityConfiguration<Category>
    {
        public override void ConfigureEntity(EntityTypeBuilder<Category> builder)
        {
            builder.ToTable("Categories");

            builder.Property(p => p.Name)
                .HasMaxLength(150)
                .IsRequired();

            builder.HasMany(p => p.Expenses)
                .WithOne();
        }
    }
}
