using EasyFinance.Domain.FinancialProject;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EasyFinance.Persistence.Mapping.FinancialProject
{
    public class PlanConfiguration : BaseEntityConfiguration<Plan>
    {
        public override void ConfigureEntity(EntityTypeBuilder<Plan> builder)
        {
            builder.ToTable("Plans");

            builder.HasQueryFilter(plan => !plan.IsArchived);

            builder.Property(plan => plan.Name)
                .HasMaxLength(150)
                .IsRequired();

            builder.Property(plan => plan.Type)
                .HasConversion<int>()
                .IsRequired();

            builder.Property(plan => plan.TargetAmount)
                .HasPrecision(18, 2)
                .IsRequired();

            builder.Property(plan => plan.CurrentBalance)
                .HasPrecision(18, 2)
                .IsRequired();

            builder.Property(plan => plan.IsArchived)
                .IsRequired();

            builder.Property(plan => plan.ProjectId)
                .IsRequired();

            builder.HasOne(plan => plan.Project)
                .WithMany()
                .HasForeignKey(plan => plan.ProjectId)
                .OnDelete(DeleteBehavior.Cascade);

            builder.HasMany(plan => plan.Entries)
                .WithOne(entry => entry.Plan)
                .HasForeignKey(entry => entry.PlanId)
                .OnDelete(DeleteBehavior.Cascade);

            builder.HasIndex(plan => new { plan.ProjectId, plan.Type })
                .IsUnique()
                .HasFilter("[Type] = 1 AND [IsArchived] = 0");
        }
    }
}
