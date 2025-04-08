using EasyFinance.Domain.FinancialProject;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EasyFinance.Persistence.Mapping.FinancialProject
{
    public class ClientConfiguration : BaseEntityConfiguration<Client>
    {
        public override void ConfigureEntity(EntityTypeBuilder<Client> builder)
        {
            builder.ToTable("Clients");

            builder.HasQueryFilter(p => !p.IsArchived);

            builder.Property(p => p.Name)
                .HasMaxLength(150)
                .IsRequired();

            builder.Property(p => p.Email);

            builder.Property(p => p.Phone);

            builder.Property(p => p.IsActive)
                .IsRequired();

            builder.Property(p => p.IsArchived)
                .IsRequired();

            builder.Property(p => p.Description);
        }
    }
}
