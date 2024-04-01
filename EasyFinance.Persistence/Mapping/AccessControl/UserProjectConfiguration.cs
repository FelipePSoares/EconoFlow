using EasyFinance.Domain.Models.AccessControl;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EasyFinance.Persistence.Mapping.AccessControl
{
    public class UserProjectConfiguration : BaseEntityConfiguration<UserProject>
    {
        public override void ConfigureEntity(EntityTypeBuilder<UserProject> builder)
        {
            builder.ToTable("UserProjects");

            builder.Property(p => p.Role).IsRequired();

            builder.HasOne(p => p.User)
                .WithMany()
                .IsRequired();

            builder.HasOne(p => p.Project)
                .WithMany()
                .IsRequired();
        }
    }
}
