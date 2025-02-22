using EasyFinance.Domain.AccessControl;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EasyFinance.Persistence.Mapping.AccessControl
{
    public class UserProjectConfiguration : BaseEntityConfiguration<UserProject>
    {
        public override void ConfigureEntity(EntityTypeBuilder<UserProject> builder)
        {
            builder.ToTable("UserProjects");

            builder.HasQueryFilter(p => p.Accepted);

            builder.Property(p => p.Role)
                .IsRequired();

            builder.Property(p => p.Token)
                .IsRequired();

            builder.Property(p => p.Accepted);

            builder.Property(p => p.SentAt)
                .IsRequired();

            builder.Property(p => p.AcceptedAt);

            builder.Property(p => p.ExpiryDate)
                .IsRequired();

            builder.Property(p => p.Email)
                .HasMaxLength(256)
                .IsRequired();

            builder.HasOne(p => p.User)
                .WithMany();
            

            builder.HasIndex(p => p.Token)
                .IsUnique();

            builder.HasOne(p => p.Project)
                .WithMany()
                .IsRequired()
                .OnDelete(DeleteBehavior.ClientNoAction);
        }
    }
}
