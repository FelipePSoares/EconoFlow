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
                .OnDelete(DeleteBehavior.Restrict);

            builder.HasOne<ExpenseItem>()
                .WithMany(e => e.Attachments)
                .HasForeignKey(p => p.ExpenseItemId)
                .OnDelete(DeleteBehavior.Restrict);

            builder.HasOne<Income>()
                .WithMany(e => e.Attachments)
                .HasForeignKey(p => p.IncomeId)
                .OnDelete(DeleteBehavior.Restrict);

            // Raw SQL is not translated by EF Core, so it must be valid on every
            // provider: double-quoted identifiers are accepted by both SQL Server
            // (QUOTED_IDENTIFIER ON, the default) and PostgreSQL, whereas SQL Server's
            // bracket form is a syntax error on PostgreSQL.
            // `AttachmentType` is an enum stored as an integer, so `= 1` is portable.
            builder.HasIndex(p => new { p.ExpenseId, p.AttachmentType })
                .IsUnique()
                .HasFilter("\"ExpenseId\" IS NOT NULL AND \"AttachmentType\" = 1");
        }
    }
}
