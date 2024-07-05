using System;
using System.Collections.Generic;
using EasyFinance.Domain.Models.Financial;
using EasyFinance.Infrastructure;
using EasyFinance.Infrastructure.Exceptions;

namespace EasyFinance.Domain.Models.FinancialProject
{
    public class Project : BaseEntity
    {
        private Project() { }

        public Project(Guid id = default, string name = "default", ProjectType type = default, ICollection<Category> categories = default, ICollection<Income> incomes = default)
            : base(id)
        {
            this.SetName(name);
            this.SetType(type);
            this.SetCategories(categories ?? new List<Category>());
            this.SetIncomes(incomes ?? new List<Income>());
        }

        public string Name { get; private set; } = string.Empty;
        public ProjectType Type { get; private set; }
        public ICollection<Category> Categories { get; private set; } = new List<Category>();
        public ICollection<Income> Incomes { get; private set; } = new List<Income>();

        public void AddCategory(Category category)
        {
            if (category == default)
                throw new ValidationException(nameof(category), string.Format(ValidationMessages.PropertyCantBeNull, nameof(category)));

            this.Categories.Add(category);
        }

        public void SetCategories(ICollection<Category> categories)
        {
            if (categories == default)
                throw new ValidationException(nameof(this.Categories), string.Format(ValidationMessages.PropertyCantBeNull, nameof(this.Categories)));

            this.Categories = categories;
        }

        public void AddIncome(Income income)
        {
            if (income == default)
                throw new ValidationException(nameof(income), string.Format(ValidationMessages.PropertyCantBeNull, nameof(income)));

            this.Incomes.Add(income);
        }

        public void SetIncomes(ICollection<Income> incomes)
        {
            if (incomes == default)
                throw new ValidationException(nameof(this.Incomes), string.Format(ValidationMessages.PropertyCantBeNull, nameof(this.Incomes)));

            this.Incomes = incomes;
        }

        public void SetName(string name)
        {
            if (string.IsNullOrEmpty(name))
                throw new ValidationException(nameof(this.Name), string.Format(ValidationMessages.PropertyCantBeNullOrEmpty, nameof(this.Name)));

            this.Name = name;
        }

        public void SetType(ProjectType type)
        {
            this.Type = type;
        }
    }
}
