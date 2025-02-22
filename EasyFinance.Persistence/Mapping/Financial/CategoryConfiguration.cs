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

            builder.HasQueryFilter(p => !p.IsArchived);

            builder.Property(p => p.Name)
                .HasMaxLength(150)
                .IsRequired();

            builder.Property(p => p.IsArchived)
                .IsRequired();

            builder.HasMany(p => p.Expenses)
                .WithOne();
        }
    }
}
