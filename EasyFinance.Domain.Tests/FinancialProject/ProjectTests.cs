using EasyFinance.Common.Tests.Financial;
using EasyFinance.Common.Tests.FinancialProject;
using EasyFinance.Domain.Models.Financial;
using EasyFinance.Infrastructure;
using EasyFinance.Infrastructure.Exceptions;
using FluentAssertions;

namespace EasyFinance.Domain.Tests.FinancialProject
{
    public class ProjectTests
    {
        [Fact]
        public void CreateAProjectAndValidateProperties()
        {
            var income = new IncomeBuilder()
                .AddAmount(200)
                .AddName("Income Name")
                .Build();

            var expenseItem = new ExpenseItemBuilder()
                .AddAmount(20)
                .AddName("Expense Item Name")
                .Build();

            var expense = new ExpenseBuilder()
                .AddGoal(50)
                .AddItems(new List<ExpenseItem> { expenseItem })
                .AddAmount(20)
                .AddName("Expense Name")
                .Build();

            var category = new CategoryBuilder()
                .AddName("Category Name")
                .AddGoal(100)
                .AddExpenses(new List<Expense>() { expense })
                .Build();

            var project = new ProjectBuilder()
                .AddName("Project Name")
                .AddIncomes(new List<Income>() { income })
                .AddCategories(new List<Category>() { category })
                .AddType(Models.FinancialProject.ProjectType.Personal)
                .Build();

            project.Name.Should().Be("Project Name");
            project.Categories.First().Should().NotBeNull();
            project.Categories.First().Name.Should().Be("Category Name");
            project.Categories.First().Goal.Should().Be(100);
            project.Categories.First().Expenses.First().Should().NotBeNull();
            project.Categories.First().Expenses.First().Name.Should().Be("Expense Name");
            project.Categories.First().Expenses.First().Goal.Should().Be(50);
            project.Categories.First().Expenses.First().Amount.Should().Be(20);
            project.Categories.First().Expenses.First().Items.First().Should().NotBeNull();
            project.Categories.First().Expenses.First().Items.First().Name.Should().Be("Expense Item Name");
            project.Categories.First().Expenses.First().Items.First().Amount.Should().Be(20);
            project.Incomes.First().Should().NotBeNull();
            project.Incomes.First().Name.Should().Be("Income Name");
            project.Incomes.First().Amount.Should().Be(200);
        }

        [Theory]
        [InlineData(null)]
        [InlineData("")]
        public void ValidateNameNullOrEmpty(string name)
        {
            var action = () => new ProjectBuilder().AddName(name).Build();

            action.Should().Throw<ValidationException>()
                .WithMessage(string.Format(ValidationMessages.PropertyCantBeNullOrEmpty, "Name"))
                .And.Property.Should().Be("Name");
        }

        [Fact]
        public void ValidateCategoriesNull()
        {
            var action = () => new ProjectBuilder().AddCategories(null).Build();

            action.Should().Throw<ValidationException>()
                .WithMessage(string.Format(ValidationMessages.PropertyCantBeNull, "Categories"))
                .And.Property.Should().Be("Categories");
        }

        [Fact]
        public void ValidateIncomesNull()
        {
            var action = () => new ProjectBuilder().AddIncomes(null).Build();

            action.Should().Throw<ValidationException>()
                .WithMessage(string.Format(ValidationMessages.PropertyCantBeNull, "Incomes"))
                .And.Property.Should().Be("Incomes");
        }
    }
}
