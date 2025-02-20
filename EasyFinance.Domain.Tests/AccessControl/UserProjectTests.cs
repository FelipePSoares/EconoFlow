using EasyFinance.Common.Tests.AccessControl;
using EasyFinance.Infrastructure;
using EasyFinance.Infrastructure.Exceptions;
using FluentAssertions;

namespace EasyFinance.Domain.Tests.AccessControl
{
    public class UserProjectTests
    {
        [Fact]
        public void AddUser_SendNull_ShouldThrowException()
        {
            var action = () => new UserProjectBuilder().AddUser(null).Build();

            action.Should().Throw<ValidationException>()
                .WithMessage(ValidationMessages.EitherUserOrEmailMustBeProvided)
                .And.Property.Should().Be("User");
        }

        [Fact]
        public void AddProject_SendNull_ShouldThrowException()
        {
            var action = () => new UserProjectBuilder().AddProject(null).Build();

            action.Should().Throw<ValidationException>()
                .WithMessage(string.Format(ValidationMessages.PropertyCantBeNull, "Project"))
                .And.Property.Should().Be("Project");
        }

        [Fact]
        public void SetAccepted_ExpiredInvite_ShouldThrowException()
        {
            var userProject = new UserProjectBuilder().AddExpiryDate(DateTime.UtcNow.AddDays(-2)).Build();

            var response = userProject.SetAccepted();

            response.Succeeded.Should().BeFalse();
            response.Messages.Should().ContainSingle()
                .Which.Code.Should().Be("ExpiryDate");
            response.Messages.Should().ContainSingle()
                .Which.Description.Should().Be(ValidationMessages.CantAcceptExpiredInvitation);
        }
    }
}
