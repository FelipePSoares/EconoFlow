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

            builder.Property(p => p.PreferredCurrency)
                .HasMaxLength(3)
                .IsRequired()
                .HasDefaultValue("EUR");

            builder.Property(p => p.TaxYearType)
                .HasConversion<int?>();

            builder.Property(p => p.TaxYearStartMonth);

            builder.Property(p => p.TaxYearStartDay);

            builder.Property(p => p.TaxYearLabeling)
                .HasConversion<int?>();

            builder.HasMany(p => p.Categories)
                .WithOne()
                .IsRequired();

            builder.HasMany(p => p.Incomes)
                .WithOne()
                .IsRequired();
        }
    }
}
