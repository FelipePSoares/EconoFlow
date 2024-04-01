using EasyFinance.Domain.Models.FinancialProject;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EasyFinance.Persistence.Mapping.FinancialProject
{
    public class ProjectConfiguration : BaseEntityConfiguration<Project>
    {
        public override void ConfigureEntity(EntityTypeBuilder<Project> builder)
        {
            builder.ToTable("Projects");

            builder.Property(p => p.Name)
                .HasMaxLength(150)
                .IsRequired();
            builder.Property(p => p.Type).IsRequired();

            builder.HasMany(p => p.Categories)
                .WithOne()
                .IsRequired();

            builder.HasMany(p => p.Incomes)
                .WithOne()
                .IsRequired();
        }
    }
}
