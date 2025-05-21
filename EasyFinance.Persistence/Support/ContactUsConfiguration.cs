using EasyFinance.Domain.Support;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EasyFinance.Persistence.Mapping.Support
{
    public class ContactUsConfiguration : BaseEntityConfiguration<ContactUs>
    {
         public override void ConfigureEntity(EntityTypeBuilder<ContactUs> builder)
        {
            builder.ToTable("ContactUs");

            builder.Property(p => p.Name)
                .HasMaxLength(150)
                .IsRequired();

            builder.Property(p => p.CreatedBy)
                .IsRequired(); // Specify the relationship if applicable

            builder.Property(p => p.Email)
                .HasMaxLength(256);

            builder.Property(p => p.Message)
                .HasMaxLength(5000);

            builder.Property(p => p.Subject)
                .HasMaxLength(500);

        }
    }
}
