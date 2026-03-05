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
            builder.HasQueryFilter(p => !p.Group.Project.IsArchived);

            builder.Property(p => p.GroupId)
                .IsRequired();

            builder.Property(p => p.ExpenseId)
                .IsRequired(false);

            builder.HasIndex(p => new { p.GroupId, p.ExpenseId })
                .HasFilter("[ExpenseId] IS NOT NULL")
                .IsUnique();

            builder.HasIndex(p => new { p.GroupId, p.ExpenseItemId })
                .HasFilter("[ExpenseItemId] IS NOT NULL")
                .IsUnique();

            builder.ToTable(tableBuilder =>
            {
                tableBuilder.HasCheckConstraint(
                    "CK_DeductibleGroupExpenses_ExactlyOneTarget",
                    "(([ExpenseId] IS NOT NULL AND [ExpenseItemId] IS NULL) OR ([ExpenseId] IS NULL AND [ExpenseItemId] IS NOT NULL))");
            });

            builder.HasOne(p => p.Group)
                .WithMany(p => p.GroupExpenses)
                .HasForeignKey(p => p.GroupId)
                .OnDelete(DeleteBehavior.Restrict);

            builder.HasOne(p => p.Expense)
                .WithMany()
                .HasForeignKey(p => p.ExpenseId)
                .IsRequired(false)
                .OnDelete(DeleteBehavior.Restrict);

            builder.HasOne(p => p.ExpenseItem)
                .WithMany()
                .HasForeignKey(p => p.ExpenseItemId)
                .IsRequired(false)
                .OnDelete(DeleteBehavior.Restrict);
        }
    }
}
