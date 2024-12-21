﻿using EasyFinance.Domain.Financial;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EasyFinance.Persistence.Mapping.Financial
{
    public class ExpenseItemConfiguration : BaseEntityConfiguration<ExpenseItem>
    {
        public override void ConfigureEntity(EntityTypeBuilder<ExpenseItem> builder)
        {
            builder.ToTable("ExpenseItems");

            builder.Property(p => p.Name)
                .HasMaxLength(150)
                .IsRequired();
            builder.Property(p => p.Date).IsRequired();
            builder.Property(p => p.Amount)
                .HasPrecision(18,2)
                .IsRequired();
            builder.Property(p => p.CreatorName)
                .HasMaxLength(513);

            builder.HasOne(p => p.CreatedBy)
                .WithMany();

            builder.HasMany(p => p.Attachments)
                .WithOne()
                .IsRequired()
                .OnDelete(DeleteBehavior.Restrict);

            builder.HasMany(p => p.Items)
                .WithOne()
                .OnDelete(DeleteBehavior.Restrict);
        }
    }
}
