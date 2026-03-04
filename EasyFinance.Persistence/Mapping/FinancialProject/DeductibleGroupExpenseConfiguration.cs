using EasyFinance.Domain.FinancialProject;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EasyFinance.Persistence.Mapping.FinancialProject
{
    public class DeductibleGroupExpenseConfiguration : BaseEntityConfiguration<DeductibleGroupExpense>
    {
        public override void ConfigureEntity(EntityTypeBuilder<DeductibleGroupExpense> builder)
        {
            builder.ToTable("DeductibleGroupExpenses");

            builder.Property(p => p.GroupId)
                .IsRequired();

            builder.Property(p => p.ExpenseId)
                .IsRequired();

            builder.HasIndex(p => new { p.GroupId, p.ExpenseId })
                .IsUnique();

            builder.HasOne(p => p.Group)
                .WithMany(p => p.GroupExpenses)
                .HasForeignKey(p => p.GroupId)
                .OnDelete(DeleteBehavior.Restrict);

            builder.HasOne(p => p.Expense)
                .WithMany()
                .HasForeignKey(p => p.ExpenseId)
                .OnDelete(DeleteBehavior.Restrict);
        }
    }
}
