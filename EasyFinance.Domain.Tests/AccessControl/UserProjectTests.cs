using EasyFinance.Common.Tests.AccessControl;
using EasyFinance.Common.Tests.Financial;
using EasyFinance.Domain.Models.AccessControl;
using EasyFinance.Infrastructure;
using EasyFinance.Infrastructure.Exceptions;
using FluentAssertions;

namespace EasyFinance.Domain.Tests.AccessControl
{
    public class UserProjectTests
    {

        [Fact]
        public void ValidateUserNull()
        {
            var action = () => new UserProjectBuilder().AddUser(null).Build();

            action.Should().Throw<ValidationException>()
                .WithMessage(string.Format(ValidationMessages.PropertyCantBeNull, "User"))
                .And.Property.Should().Be("User");
        }

        [Fact]
        public void ValidateProjectNull()
        {
            var action = () => new UserProjectBuilder().AddProject(null).Build();

            action.Should().Throw<ValidationException>()
                .WithMessage(string.Format(ValidationMessages.PropertyCantBeNull, "Project"))
                .And.Property.Should().Be("Project");
        }
    }
}
