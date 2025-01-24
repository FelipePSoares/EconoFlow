using System;

namespace EasyFinance.Application.DTOs.FinancialProject
{
    public class TransactionResponseDTO
    {
        public Guid Id { get; set; }
        public string Name { get; set; }
        public TransactionType Type { get; set; }
        public DateTime Date { get; set; }
        public decimal Amount { get; set; }
    }
}
