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

            builder.Property(p => p.Name)
                .HasMaxLength(150)
                .IsRequired();

            builder.HasOne(p => p.CreatedBy)
                .WithMany()
                .IsRequired();
        }
    }
}
