using System;
using System.Collections.Generic;
using AutoFixture;
using EasyFinance.Common.Tests.AccessControl;
using EasyFinance.Domain.AccessControl;
using EasyFinance.Domain.Financial;

namespace EasyFinance.Common.Tests.Financial
{
    public abstract class BaseFinancialBuilder<TEntity> : BaseTests, IBuilder<TEntity>
        where TEntity : BaseFinancial
    {
        protected TEntity entity;

        protected BaseFinancialBuilder(TEntity baseFinancial)
        {
            this.entity = baseFinancial;
            this.entity.SetName(Fixture.Create<string>());
            var today = DateTime.Today;
            this.entity.SetDate(new DateOnly(today.Year, today.Month, today.Day));
            this.entity.SetAmount(Fixture.Create<decimal>());
            this.entity.SetCreatedBy(new UserBuilder().Build());
        }

        public BaseFinancialBuilder<TEntity> AddName(string name)
        {
            this.entity.SetName(name);
            return this;
        }

        public BaseFinancialBuilder<TEntity> AddDate(DateOnly date)
        {
            this.entity.SetDate(date);
            return this;
        }

        public BaseFinancialBuilder<TEntity> AddAmount(decimal amount)
        {
            this.entity.SetAmount(amount);
            return this;
        }

        public BaseFinancialBuilder<TEntity> AddCreatedBy(User user)
        {
            this.entity.SetCreatedBy(user);
            return this;
        }

        public BaseFinancialBuilder<TEntity> AddAttachments(ICollection<Attachment> attachments)
        {
            this.entity.SetAttachments(attachments);
            return this;
        }

        public TEntity Build() => this.entity;

    }
}
