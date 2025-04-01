using System;
using System.Collections.Generic;
using System.Linq;
using EasyFinance.Domain.Financial;
using EasyFinance.Infrastructure;
using EasyFinance.Infrastructure.DTOs;
using EasyFinance.Infrastructure.Extensions;
using EasyFinance.Infrastructure.Validators;

namespace EasyFinance.Domain.FinancialProject
{
    public class Project : BaseEntity
    {
        private Project() { }

        public Project(Guid id = default, string name = "default", string preferredCurrency = "EUR", ProjectTypes projectType = ProjectTypes.Personal, ICollection<Category> categories = default, ICollection<Income> incomes = default)
            : base(id)
        {
            SetName(name);
            SetCategories(categories ?? []);
            SetPreferredCurrency(preferredCurrency);
            SetIncomes(incomes ?? []);
            SetType(projectType);
        }

        public string Name { get; private set; } = string.Empty;
        public bool IsArchived { get; private set; }
        public string PreferredCurrency { get; private set; } = string.Empty;
        public ICollection<Category> Categories { get; private set; } = [];
        public ICollection<Income> Incomes { get; private set; } = [];
        public ProjectTypes Type { get; private set; } = ProjectTypes.Personal;

        public override AppResponse Validate
        {
            get
            {
                var response = AppResponse.Success();

                if (string.IsNullOrEmpty(Name))
                    response.AddErrorMessage(nameof(Name), string.Format(ValidationMessages.PropertyCantBeNullOrEmpty, nameof(Name)));

                if (string.IsNullOrEmpty(PreferredCurrency))
                    response.AddErrorMessage(nameof(PreferredCurrency), string.Format(ValidationMessages.PropertyCantBeNullOrEmpty, nameof(PreferredCurrency)));
                else if (!CurrencyValidator.IsValidCurrencyCode(PreferredCurrency))
                    response.AddErrorMessage(nameof(PreferredCurrency), ValidationMessages.InvalidCurrencyCode);

                var categoriesValidation = Categories.Select(c => c.Validate).ToList();
                if (categoriesValidation.Any(c => c.Failed))
                    response.AddErrorMessage(categoriesValidation.SelectMany(c => c.Messages.AddPrefix(nameof(this.Categories))));

                var incomesValidation = Incomes.Select(c => c.Validate).ToList();
                if (incomesValidation.Any(c => c.Failed))
                    response.AddErrorMessage(incomesValidation.SelectMany(c => c.Messages.AddPrefix(nameof(this.Incomes))));

                return response;
            }
        }

        public void AddCategory(Category category)
        {
            Categories.Add(category ?? throw new ArgumentNullException(null, string.Format(ValidationMessages.PropertyCantBeNull, nameof(category))));
        }

        public void SetCategories(ICollection<Category> categories)
        {
            Categories = categories ?? throw new ArgumentNullException(null, string.Format(ValidationMessages.PropertyCantBeNull, nameof(categories)));
        }

        public void AddIncome(Income income)
        {
            Incomes.Add(income ?? throw new ArgumentNullException(null, string.Format(ValidationMessages.PropertyCantBeNull, nameof(income))));
        }

        public void SetIncomes(ICollection<Income> incomes)
        {
            Incomes = incomes ?? throw new ArgumentNullException(null, string.Format(ValidationMessages.PropertyCantBeNull, nameof(incomes)));
        }

        public void SetPreferredCurrency(string preferredCurrency)
        {
            PreferredCurrency = preferredCurrency;
        }

        public void SetName(string name)
        {
            Name = name;
        }

        public void SetArchive()
        {
            IsArchived = true;
        }

        public void SetType(ProjectTypes type)
        {
            Type = type;
        }
    }
}
