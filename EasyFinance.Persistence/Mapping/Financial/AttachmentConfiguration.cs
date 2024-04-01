using EasyFinance.Domain.Models.Financial;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EasyFinance.Persistence.Mapping.Financial
{
    public class AttachmentConfiguration : BaseEntityConfiguration<Attachment>
    {
        public override void ConfigureEntity(EntityTypeBuilder<Attachment> builder)
        {
            builder.ToTable("Attachments");

            builder.Property(p => p.Name)
                .HasMaxLength(150)
                .IsRequired();

            builder.HasOne(p => p.CreatedBy)
                .WithMany()
                .IsRequired();
        }
    }
}
