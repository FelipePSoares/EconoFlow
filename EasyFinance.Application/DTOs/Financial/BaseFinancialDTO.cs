using System;

namespace EasyFinance.Application.DTOs.Financial
{
    public abstract class BaseFinancialDTO
    {
        public string Name { get; set; } = string.Empty;
        public DateOnly Date { get; set; }
        public decimal Amount { get; set; }
    }
}
