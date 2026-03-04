using EasyFinance.Domain.Shared;
using EasyFinance.Infrastructure;
using EasyFinance.Infrastructure.DTOs;
using System;
using System.Collections.Generic;

namespace EasyFinance.Domain.FinancialProject
{
    public class DeductibleGroup : BaseEntity
    {
        private DeductibleGroup() { }

        public DeductibleGroup(
            Guid projectId = default,
            string taxYearId = "default",
            string name = "default",
            ICollection<DeductibleGroupExpense> groupExpenses = default)
        {
            SetProjectId(projectId);
            SetTaxYearId(taxYearId);
            SetName(name);
            SetGroupExpenses(groupExpenses ?? []);
        }

        public Guid ProjectId { get; private set; }
        public Project Project { get; private set; }
        public string TaxYearId { get; private set; } = string.Empty;
        public string Name { get; private set; } = string.Empty;
        public ICollection<DeductibleGroupExpense> GroupExpenses { get; private set; } = [];

        public override AppResponse Validate
        {
            get
            {
                var response = AppResponse.Success();

                if (ProjectId == Guid.Empty)
                    response.AddErrorMessage(nameof(ProjectId), ValidationMessages.InvalidProjectId);

                if (string.IsNullOrWhiteSpace(TaxYearId))
                    response.AddErrorMessage(nameof(TaxYearId), ValidationMessages.InvalidTaxYearId);

                if (string.IsNullOrWhiteSpace(Name))
                    response.AddErrorMessage(nameof(Name), string.Format(ValidationMessages.PropertyCantBeNullOrEmpty, nameof(Name)));

                if (!string.IsNullOrWhiteSpace(Name) && Name.Length > PropertyMaxLengths.GetMaxLength(PropertyType.DeductibleGroupName))
                {
                    response.AddErrorMessage(
                        nameof(Name),
                        string.Format(
                            ValidationMessages.PropertyMaxLength,
                            nameof(Name),
                            PropertyMaxLengths.GetMaxLength(PropertyType.DeductibleGroupName)));
                }

                return response;
            }
        }

        public void SetProjectId(Guid projectId) => ProjectId = projectId;

        public void SetTaxYearId(string taxYearId) => TaxYearId = taxYearId;

        public void SetName(string name) => Name = name;

        public void SetGroupExpenses(ICollection<DeductibleGroupExpense> groupExpenses)
        {
            ArgumentNullException.ThrowIfNull(groupExpenses);
            GroupExpenses = groupExpenses;
        }

        public void AddGroupExpense(DeductibleGroupExpense groupExpense)
        {
            ArgumentNullException.ThrowIfNull(groupExpense);
            GroupExpenses.Add(groupExpense);
        }
    }
}
