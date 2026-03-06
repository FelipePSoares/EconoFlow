using EasyFinance.Domain.FinancialProject;
using EasyFinance.Domain.Shared;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EasyFinance.Persistence.Mapping.FinancialProject
{
    public class DeductibleGroupConfiguration : BaseEntityConfiguration<DeductibleGroup>
    {
        public override void ConfigureEntity(EntityTypeBuilder<DeductibleGroup> builder)
        {
            builder.ToTable("DeductibleGroups");
            builder.HasQueryFilter(p => !p.Project.IsArchived);

            builder.Property(p => p.ProjectId)
                .IsRequired();

            builder.Property(p => p.TaxYearId)
                .HasMaxLength(16)
                .IsRequired();

            builder.Property(p => p.Name)
                .HasMaxLength(PropertyMaxLengths.GetMaxLength(PropertyType.DeductibleGroupName))
                .IsRequired();

            builder.HasIndex(p => new { p.ProjectId, p.TaxYearId, p.Name })
                .IsUnique();

            builder.HasOne(p => p.Project)
                .WithMany()
                .HasForeignKey(p => p.ProjectId)
                .OnDelete(DeleteBehavior.Restrict);

            builder.HasMany(p => p.GroupExpenses)
                .WithOne(p => p.Group)
                .HasForeignKey(p => p.GroupId)
                .OnDelete(DeleteBehavior.Restrict);
        }
    }
}
