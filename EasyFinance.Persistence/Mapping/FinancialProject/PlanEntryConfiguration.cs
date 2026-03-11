using EasyFinance.Domain.FinancialProject;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EasyFinance.Persistence.Mapping.FinancialProject
{
    public class PlanEntryConfiguration : BaseEntityConfiguration<PlanEntry>
    {
        public override void ConfigureEntity(EntityTypeBuilder<PlanEntry> builder)
        {
            builder.ToTable("PlanEntries");

            builder.Property(entry => entry.PlanId)
                .IsRequired();

            builder.Property(entry => entry.Date)
                .IsRequired();

            builder.Property(entry => entry.AmountSigned)
                .HasPrecision(18, 2)
                .IsRequired();

            builder.Property(entry => entry.Note)
                .HasMaxLength(500);

            builder.HasOne(entry => entry.Plan)
                .WithMany(plan => plan.Entries)
                .HasForeignKey(entry => entry.PlanId)
                .OnDelete(DeleteBehavior.Cascade);
        }
    }
}
