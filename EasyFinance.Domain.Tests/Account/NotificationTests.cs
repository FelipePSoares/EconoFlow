using EasyFinance.Common.Tests;
using EasyFinance.Common.Tests.AccessControl;
using EasyFinance.Domain.Account;
using EasyFinance.Infrastructure;
using FluentAssertions;

namespace EasyFinance.Domain.Tests.Account
{
    public class NotificationTests : BaseTests
    {
        [Fact]
        public void AddType_SendTypeNone_ShouldReturnErrorMessage()
        {
            // Arrange
            var notification = new NotificationBuilder().AddType(NotificationType.None).Build();

            // Act
            var result = notification.Validate;

            // Assert
            result.Failed.Should().BeTrue();
            var message = result.Messages.Should().ContainSingle().Subject;
            message.Code.Should().Be("Type");
            message.Description.Should().Be(string.Format(ValidationMessages.PropertyCantBeNullOrEmpty, nameof(notification.Type)));
        }

        [Fact]
        public void AddCategory_SendCategoryNone_ShouldReturnErrorMessage()
        {
            // Arrange
            var notification = new NotificationBuilder().AddCategory(NotificationCategory.None).Build();

            // Act
            var result = notification.Validate;

            // Assert
            result.Failed.Should().BeTrue();
            var message = result.Messages.Should().ContainSingle().Subject;
            message.Code.Should().Be("Category");
            message.Description.Should().Be(string.Format(ValidationMessages.PropertyCantBeNullOrEmpty, nameof(notification.Category)));
        }

        [Theory]
        [InlineData(null)]
        [InlineData("")]
        public void AddCodeMessage_SendEmptyCodeMessage_ShouldReturnErrorMessage(string codeMessage)
        {
            // Arrange
            var notification = new NotificationBuilder().AddCodeMessage(codeMessage).Build();

            // Act
            var result = notification.Validate;

            // Assert
            result.Failed.Should().BeTrue();
            var message = result.Messages.Should().ContainSingle().Subject;
            message.Code.Should().Be("CodeMessage");
            message.Description.Should().Be(string.Format(ValidationMessages.PropertyCantBeNullOrEmpty, nameof(notification.CodeMessage)));
        }

        [Fact]
        public void AddCodeMessage_SendTooLongCodeMessage_ShouldReturnErrorMessage()
        {
            // Arrange
            var notification = new NotificationBuilder().AddCodeMessage(new string('a', 101)).Build();
            // Act
            var result = notification.Validate;
            // Assert
            result.Failed.Should().BeTrue();
            var message = result.Messages.Should().ContainSingle().Subject;
            message.Code.Should().Be("CodeMessage");
            message.Description.Should().Be(string.Format(ValidationMessages.PropertyMaxLength, nameof(notification.CodeMessage), 100));
        }

        [Fact]
        public void AddActionLabelCode_SendTooLongActionLabelCode_ShouldReturnErrorMessage()
        {
            // Arrange
            var notification = new NotificationBuilder()
                .AddActionLabelCode(new string('a', 101)).Build();

            // Act
            var result = notification.Validate;

            // Assert
            result.Failed.Should().BeTrue();
            var message = result.Messages.Should().ContainSingle().Subject;
            message.Code.Should().Be("ActionLabelCode");
            message.Description.Should().Be(string.Format(ValidationMessages.PropertyMaxLength, nameof(notification.ActionLabelCode), 100));
        }

        [Theory]
        [MemberData(nameof(OlderDates2))]
        public void AddExpiresAt_SendOldDates_ShouldReturnErrorMessage(DateOnly date)
        {
            // Arrange
            var notification = new NotificationBuilder().AddExpiresAt(date).Build();

            // Act
            var result = notification.Validate;

            // Assert
            result.Failed.Should().BeTrue();

            var message = result.Messages.Should().ContainSingle().Subject;
            message.Code.Should().Be("ExpiresAt");
            message.Description.Should().Be(ValidationMessages.ExpirationShouldBeFutureDate);
        }

        public static TheoryData<DateOnly> OlderDates2 =>
            [
                DateOnly.FromDateTime(DateTime.Today.ToUniversalTime().AddDays(-1)),
                DateOnly.FromDateTime(DateTime.Today.ToUniversalTime().AddYears(-1)),
                DateOnly.FromDateTime(DateTime.Today.ToUniversalTime().AddYears(-5))
            ];
    }
}
