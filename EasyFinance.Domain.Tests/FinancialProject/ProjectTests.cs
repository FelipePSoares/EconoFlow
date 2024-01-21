using EasyFinance.Common.Tests.FinancialProject;
using EasyFinance.Infrastructure;
using EasyFinance.Infrastructure.Exceptions;
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
            var action = () => new ProjectBuilder().AddName(name).Build();

            action.Should().Throw<ValidationException>()
                .WithMessage(string.Format(ValidationMessages.PropertyCantBeNullOrEmpty, "Name"))
                .And.Property.Should().Be("Name");
        }

        [Fact]
        public void AddCategories_SendNull_ShouldThrowException()
        {
            var action = () => new ProjectBuilder().AddCategories(null).Build();

            action.Should().Throw<ValidationException>()
                .WithMessage(string.Format(ValidationMessages.PropertyCantBeNull, "Categories"))
                .And.Property.Should().Be("Categories");
        }

        [Fact]
        public void AddIncomes_SendNull_ShouldThrowException()
        {
            var action = () => new ProjectBuilder().AddIncomes(null).Build();

            action.Should().Throw<ValidationException>()
                .WithMessage(string.Format(ValidationMessages.PropertyCantBeNull, "Incomes"))
                .And.Property.Should().Be("Incomes");
        }
    }
}
