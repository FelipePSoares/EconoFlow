using System.Collections.Generic;
using EasyFinance.Domain.Models.Financial;
using EasyFinance.Infrastructure;
using EasyFinance.Infrastructure.Exceptions;

namespace EasyFinance.Domain.Models.FinancialProject
{
    public class Project : BaseEntity
    {
        public Project(string name = "default", ProjectType type = default, ICollection<Category> categories = default, ICollection<Income> incomes = default)
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

        public void SetCategories(ICollection<Category> categories)
        {
            this.Categories = categories;

            if (this.Categories == default)
                throw new ValidationException(nameof(this.Categories), string.Format(ValidationMessages.PropertyCantBeNull, nameof(this.Categories)));
        }

        public void SetIncomes(ICollection<Income> incomes)
        {
            this.Incomes = incomes;

            if (this.Incomes == default)
                throw new ValidationException(nameof(this.Incomes), string.Format(ValidationMessages.PropertyCantBeNull, nameof(this.Incomes)));
        }

        public void SetName(string name)
        {
            this.Name = name;

            if (string.IsNullOrEmpty(this.Name))
                throw new ValidationException(nameof(this.Name), string.Format(ValidationMessages.PropertyCantBeNullOrEmpty, nameof(this.Name)));
        }

        public void SetType(ProjectType type)
        {
            this.Type = type;
        }
    }
}
