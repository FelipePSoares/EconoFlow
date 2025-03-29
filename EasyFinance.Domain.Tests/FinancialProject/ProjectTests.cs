using EasyFinance.Common.Tests.FinancialProject;
using EasyFinance.Infrastructure;
using FluentAssertions;

namespace EasyFinance.Domain.Tests.FinancialProject
{
    public class ProjectTests
    {
        [Theory]
        [InlineData(null)]
        [InlineData("")]
        public void AddName_SendNullAndEmpty_ShouldThrowException(string name)
        {
            // Arrange
            var project = new ProjectBuilder().AddName(name).Build();

            // Act
            var result = project.Validate;

            // Assert
            result.Failed.Should().BeTrue();

            var message = result.Messages.Should().ContainSingle().Subject;
            message.Code.Should().Be("Name");
            message.Description.Should().Be(string.Format(ValidationMessages.PropertyCantBeNullOrEmpty, "Name"));
        }

        [Theory]
        [InlineData(null)]
        [InlineData("")]
        public void AddPreferredCurrency_SendNullAndEmpty_ShouldThrowException(string preferredCurrency)
        {
            // Arrange
            var project = new ProjectBuilder().AddPreferredCurrency(preferredCurrency).Build();

            // Act
            var result = project.Validate;

            // Assert
            result.Failed.Should().BeTrue();

            var message = result.Messages.Should().ContainSingle().Subject;
            message.Code.Should().Be("PreferredCurrency");
            message.Description.Should().Be(string.Format(ValidationMessages.PropertyCantBeNullOrEmpty, "PreferredCurrency"));
        }

        [Theory]
        [InlineData("Test")]
        public void AddPreferredCurrency_SendInvalid_ShouldThrowException(string preferredCurrency)
        {
            // Arrange
            var project = new ProjectBuilder().AddPreferredCurrency(preferredCurrency).Build();

            // Act
            var result = project.Validate;

            // Assert
            result.Failed.Should().BeTrue();

            var message = result.Messages.Should().ContainSingle().Subject;
            message.Code.Should().Be("PreferredCurrency");
            message.Description.Should().Be(ValidationMessages.InvalidCurrencyCode);
        }

        [Fact]
        public void AddCategories_SendNull_ShouldThrowException()
        {
            var action = () => new ProjectBuilder().AddCategories(null).Build();

            action.Should().Throw<ArgumentNullException>()
                .WithMessage(string.Format(ValidationMessages.PropertyCantBeNull, "categories"));
        }

        [Fact]
        public void AddCategory_SendNull_ShouldThrowException()
        {
            var action = () => new ProjectBuilder().AddCategory(null).Build();

            action.Should().Throw<ArgumentNullException>()
                .WithMessage(string.Format(ValidationMessages.PropertyCantBeNull, "category"));
        }

        [Fact]
        public void AddIncomes_SendNull_ShouldThrowException()
        {
            var action = () => new ProjectBuilder().AddIncomes(null).Build();

            action.Should().Throw<ArgumentNullException>()
                .WithMessage(string.Format(ValidationMessages.PropertyCantBeNull, "incomes"));
        }

        [Fact]
        public void AddIncome_SendNull_ShouldThrowException()
        {
            var action = () => new ProjectBuilder().AddIncome(null).Build();

            action.Should().Throw<ArgumentNullException>()
                .WithMessage(string.Format(ValidationMessages.PropertyCantBeNull, "income"));
        }
    }
}
