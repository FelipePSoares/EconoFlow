using System;
using System.Collections.Generic;
using EasyFinance.Domain.Financial;
using EasyFinance.Infrastructure;
using EasyFinance.Infrastructure.Exceptions;

namespace EasyFinance.Domain.FinancialProject
{
    public class Project : BaseEntity
    {
        private Project() { }

        public Project(Guid id = default, string name = "default", ICollection<Category> categories = default, ICollection<Income> incomes = default)
            : base(id)
        {
            SetName(name);
            SetCategories(categories ?? new List<Category>());
            SetIncomes(incomes ?? new List<Income>());
        }

        public string Name { get; private set; } = string.Empty;
        public bool IsArchived { get; private set; }
        public ICollection<Category> Categories { get; private set; } = new List<Category>();
        public ICollection<Income> Incomes { get; private set; } = new List<Income>();

        public void AddCategory(Category category)
        {
            if (category == default)
                throw new ValidationException(nameof(category), string.Format(ValidationMessages.PropertyCantBeNull, nameof(category)));

            Categories.Add(category);
        }

        public void SetCategories(ICollection<Category> categories)
        {
            if (categories == default)
                throw new ValidationException(nameof(Categories), string.Format(ValidationMessages.PropertyCantBeNull, nameof(Categories)));

            Categories = categories;
        }

        public void AddIncome(Income income)
        {
            if (income == default)
                throw new ValidationException(nameof(income), string.Format(ValidationMessages.PropertyCantBeNull, nameof(income)));

            Incomes.Add(income);
        }

        public void SetIncomes(ICollection<Income> incomes)
        {
            if (incomes == default)
                throw new ValidationException(nameof(Incomes), string.Format(ValidationMessages.PropertyCantBeNull, nameof(Incomes)));

            Incomes = incomes;
        }

        public void SetName(string name)
        {
            if (string.IsNullOrEmpty(name))
                throw new ValidationException(nameof(Name), string.Format(ValidationMessages.PropertyCantBeNullOrEmpty, nameof(Name)));

            Name = name;
        }

        public void SetArchive()
        {
            IsArchived = true;
        }
    }
}
