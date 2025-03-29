using EasyFinance.Common.Tests.Financial;
using EasyFinance.Infrastructure;
using FluentAssertions;

namespace EasyFinance.Domain.Tests.Financial
{
    public class AttachmentTests
    {
        [Theory]
        [InlineData(null)]
        [InlineData("")]
        public void AddName_SendNullAndEmpty_ShouldThrowException(string name)
        {
            // Arrange
            var attachment = new AttachmentBuilder().AddName(name).Build();

            // Act
            var result = attachment.Validate;

            // Assert
            result.Failed.Should().BeTrue();

            var message = result.Messages.Should().ContainSingle().Subject;
            message.Code.Should().Be("Name");
            message.Description.Should().Be(string.Format(ValidationMessages.PropertyCantBeNullOrEmpty, "Name"));
        }

        [Fact]
        public void AddCreatedBy_SendNull_ShouldThrowException()
        {
            var action = () => new AttachmentBuilder().AddCreatedBy(null).Build();

            action.Should().Throw<ArgumentNullException>()
                .WithMessage(string.Format(ValidationMessages.PropertyCantBeNull, "CreatedBy"));
        }
    }
}
