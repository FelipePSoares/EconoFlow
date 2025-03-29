using AutoFixture;
using EasyFinance.Common.Tests.AccessControl;
using EasyFinance.Domain.AccessControl;
using EasyFinance.Domain.Financial;

namespace EasyFinance.Common.Tests.Financial
{
    public class AttachmentBuilder : BaseTests, IBuilder<Attachment>
    {
        private Attachment attachment;

        public AttachmentBuilder()
        { 
            this.attachment = new Attachment();
            this.attachment.SetName(Fixture.Create<string>());
            this.attachment.SetCreatedBy(new UserBuilder().Build());
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

        public Attachment Build() => this.attachment;
    }
}
