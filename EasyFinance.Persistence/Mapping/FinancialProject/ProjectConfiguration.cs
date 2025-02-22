using EasyFinance.Domain.FinancialProject;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EasyFinance.Persistence.Mapping.FinancialProject
{
    public class ProjectConfiguration : BaseEntityConfiguration<Project>
    {
        public override void ConfigureEntity(EntityTypeBuilder<Project> builder)
        {
            builder.ToTable("Projects");

            builder.HasQueryFilter(p => !p.IsArchived);

            builder.Property(p => p.Name)
                .HasMaxLength(150)
                .IsRequired();

            builder.Property(p => p.IsArchived)
                .IsRequired();

            builder.HasMany(p => p.Categories)
                .WithOne()
                .IsRequired();

            builder.HasMany(p => p.Incomes)
                .WithOne()
                .IsRequired();
        }
    }
}
