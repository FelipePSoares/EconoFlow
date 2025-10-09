using EasyFinance.Common.Tests.AccessControl;
using EasyFinance.Domain.AccessControl;
using EasyFinance.Domain.Shared;
using EasyFinance.Infrastructure;
using FluentAssertions;

namespace EasyFinance.Domain.Tests.AccessControl
{
    public class UserProjectTests
    {
        [Fact]
        public void AddUser_SendUserNull_ShouldThrowException()
        {
            // Arrange
            var userProject = new UserProjectBuilder().AddUser((string)null).Build();

            userProject.SetUser((User)null);

            // Act
            var response = userProject.Validate;

            // Assert
            response.Succeeded.Should().BeFalse();
            response.Messages.Should().ContainSingle()
                .Which.Code.Should().Be("User");
            response.Messages.Should().ContainSingle()
                .Which.Description.Should().Be(ValidationMessages.EitherUserOrEmailMustBeProvided);
        }

        [Fact]
        public void AddUser_SendEmailNull_ShouldThrowException()
        {
            // Arrange
            var userProject = new UserProjectBuilder().AddUser((User)null).Build();

            userProject.SetUser((string)null);

            // Act
            var response = userProject.Validate;

            // Assert
            response.Succeeded.Should().BeFalse();
            response.Messages.Should().ContainSingle()
                .Which.Code.Should().Be("User");
            response.Messages.Should().ContainSingle()
                .Which.Description.Should().Be(ValidationMessages.EitherUserOrEmailMustBeProvided);
        }

        [Fact]
        public void AddProject_SendNull_ShouldThrowException()
        {
            // Arrange
            var userProject = new UserProjectBuilder().Build();

            userProject.SetProject(null);

            // Act
            var response = userProject.Validate;

            // Assert
            response.Succeeded.Should().BeFalse();
            response.Messages.Should().ContainSingle()
                .Which.Code.Should().Be("Project");
            response.Messages.Should().ContainSingle()
                .Which.Description.Should().Be(string.Format(ValidationMessages.PropertyCantBeNull, "Project"));
        }

        [Fact]
        public void SetAccepted_ExpiredInvite_ShouldThrowException()
        {
            // Arrange
            var userProject = new UserProjectBuilder().AddExpiryDate(DateTime.UtcNow.AddDays(-2)).Build();

            // Act
            var response = userProject.SetAccepted();

            // Assert
            response.Succeeded.Should().BeFalse();
            response.Messages.Should().ContainSingle()
                .Which.Code.Should().Be("ExpiryDate");
            response.Messages.Should().ContainSingle()
                .Which.Description.Should().Be(ValidationMessages.CantAcceptExpiredInvitation);
        }

        [Fact]
        public void AddUserByEmail_SendUnacceptableLength_ShouldThrowException()
        {
            // Arrange
            var maxLength = PropertyMaxLengths.GetMaxLength(PropertyType.UserProjectEmail);
            var unacceptableEmail = new string('a', maxLength + 1);
            var userProject = new UserProjectBuilder().Build();
            userProject.SetUser(unacceptableEmail);

            // Act
            var result = userProject.Validate;

            // Assert
            result.Failed.Should().BeTrue();

            var message = result.Messages.Should().ContainSingle().Subject;
            message.Code.Should().Be(nameof(userProject.Email));
            message.Description.Should().Be(string.Format(ValidationMessages.PropertyMaxLength,
                nameof(userProject.Email),
                maxLength));
        }
    }
}
