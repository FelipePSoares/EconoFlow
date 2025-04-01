using System;
using System.Collections.Generic;

namespace EasyFinance.Application.DTOs.Financial
{
    public class SmartSetupRequestDTO
    {
        public decimal AnnualIncome { get; set; }
        public DateOnly Date { get; set; }
        public ICollection<CategoryWithPercentageDTO> DefaultCategories { get; set; }
    }
}
