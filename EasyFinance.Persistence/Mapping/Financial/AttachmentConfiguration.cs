using EasyFinance.Domain.Financial;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EasyFinance.Persistence.Mapping.Financial
{
    public class AttachmentConfiguration : BaseEntityConfiguration<Attachment>
    {
        public override void ConfigureEntity(EntityTypeBuilder<Attachment> builder)
        {
            builder.ToTable("Attachments");

            // Keep Attachment and User filters aligned to avoid required-navigation filter mismatch.
            builder.HasQueryFilter(p => p.CreatedBy.Enabled);

            builder.Property(p => p.ExpenseId);
            builder.Property(p => p.ExpenseItemId);
            builder.Property(p => p.IncomeId);

            builder.Property(p => p.Name)
                .HasMaxLength(150)
                .IsRequired();

            builder.Property(p => p.ContentType)
                .HasMaxLength(200)
                .IsRequired();

            builder.Property(p => p.Size)
                .IsRequired();

            builder.Property(p => p.StorageKey)
                .HasMaxLength(512)
                .IsRequired();

            builder.Property(p => p.AttachmentType)
                .IsRequired();

            builder.Property(p => p.IsTemporary)
                .HasDefaultValue(false)
                .IsRequired();

            builder.HasOne(p => p.CreatedBy)
                .WithMany()
                .IsRequired();

            builder.HasOne<Expense>()
                .WithMany(e => e.Attachments)
                .HasForeignKey(p => p.ExpenseId)
                .OnDelete(DeleteBehavior.Cascade);

            builder.HasOne<ExpenseItem>()
                .WithMany(e => e.Attachments)
                .HasForeignKey(p => p.ExpenseItemId)
                .OnDelete(DeleteBehavior.Cascade);

            builder.HasOne<Income>()
                .WithMany(e => e.Attachments)
                .HasForeignKey(p => p.IncomeId)
                .OnDelete(DeleteBehavior.Cascade);

            builder.HasIndex(p => new { p.ExpenseId, p.AttachmentType })
                .IsUnique()
                .HasFilter("[ExpenseId] IS NOT NULL AND [AttachmentType] = 1");
        }
    }
}
