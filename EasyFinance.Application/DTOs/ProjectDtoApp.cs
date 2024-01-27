using EasyFinance.Domain.Models.Financial;
using EasyFinance.Domain.Models.FinancialProject;
using System;
using System.Collections.Generic;

namespace EasyFinance.Application.DTOs
{
    public class ProjectDtoApp
    {
        public Guid Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public ProjectType Type { get; set; }
        public ICollection<Category> Categories { get; set; } = new List<Category>();
        public ICollection<Income> Incomes { get; set; } = new List<Income>();
    }
}
