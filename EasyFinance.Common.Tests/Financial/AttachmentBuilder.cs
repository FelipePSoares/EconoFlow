using EasyFinance.Domain.AccessControl;
using EasyFinance.Domain.Financial;

namespace EasyFinance.Common.Tests.Financial
{
    public class AttachmentBuilder : IBuilder<Attachment>
    {
        private Attachment attachment;

        public AttachmentBuilder()
        { 
            this.attachment = new Attachment();
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
