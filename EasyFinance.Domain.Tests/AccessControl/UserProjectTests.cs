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
            var userProject = new UserProjectBuilder().Build();

            var response = userProject.SetUser(null);

            response.Succeeded.Should().BeFalse();
            response.Messages.Should().ContainSingle()
                .Which.Code.Should().Be("User");
            response.Messages.Should().ContainSingle()
                .Which.Description.Should().Be(ValidationMessages.EitherUserOrEmailMustBeProvided);
        }

        [Fact]
        public void AddProject_SendNull_ShouldThrowException()
        {
            var userProject = new UserProjectBuilder().Build();

            var response = userProject.SetProject(null);

            response.Succeeded.Should().BeFalse();
            response.Messages.Should().ContainSingle()
                .Which.Code.Should().Be("Project");
            response.Messages.Should().ContainSingle()
                .Which.Description.Should().Be(string.Format(ValidationMessages.PropertyCantBeNull, "Project"));
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
