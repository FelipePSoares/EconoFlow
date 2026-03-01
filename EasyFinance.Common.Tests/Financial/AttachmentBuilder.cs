using AutoFixture;
using EasyFinance.Common.Tests.AccessControl;
using EasyFinance.Domain.AccessControl;
using EasyFinance.Domain.Financial;
using System;

namespace EasyFinance.Common.Tests.Financial
{
    public class AttachmentBuilder : BaseTests, IBuilder<Attachment>
    {
        private Attachment attachment;
        private readonly User createdBy;
        private readonly Guid expenseId;

        public AttachmentBuilder()
        {
            this.createdBy = new UserBuilder().Build();
            this.expenseId = Guid.NewGuid();
            this.attachment = new Attachment(
                expenseId: this.expenseId,
                name: Fixture.Create<string>(),
                contentType: "application/pdf",
                size: 10,
                storageKey: $"{Guid.NewGuid():N}.pdf",
                createdBy: this.createdBy);
        }

        public AttachmentBuilder AddName(string name)
        {
            this.attachment.SetName(name);
            return this;
        }

        public AttachmentBuilder AddCreatedBy(User createdBy)
        {
            this.attachment.SetCreatedBy(createdBy);
            return this;
        }

        public AttachmentBuilder AddExpenseId(Guid? expenseId)
        {
            this.attachment.SetExpenseId(expenseId);
            return this;
        }

        public AttachmentBuilder AddExpenseItemId(Guid? expenseItemId)
        {
            this.attachment.SetExpenseItemId(expenseItemId);
            return this;
        }

        public AttachmentBuilder AddIncomeId(Guid? incomeId)
        {
            this.attachment.SetIncomeId(incomeId);
            return this;
        }

        public AttachmentBuilder AddContentType(string contentType)
        {
            this.attachment.SetContentType(contentType);
            return this;
        }

        public AttachmentBuilder AddSize(long size)
        {
            this.attachment.SetSize(size);
            return this;
        }

        public AttachmentBuilder AddStorageKey(string storageKey)
        {
            this.attachment.SetStorageKey(storageKey);
            return this;
        }

        public AttachmentBuilder AddAttachmentType(AttachmentType attachmentType)
        {
            this.attachment.SetAttachmentType(attachmentType);
            return this;
        }

        public AttachmentBuilder AddIsTemporary(bool isTemporary)
        {
            this.attachment.SetIsTemporary(isTemporary);
            return this;
        }

        public Attachment Build() => this.attachment;
    }
}
