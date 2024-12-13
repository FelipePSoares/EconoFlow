using System;

namespace EasyFinance.Application.DTOs.Financial
{
    public class ExpenseResponseDTO : BaseExpenseResponseDTO
    {
        public Guid Id { get; set; }
        public int Budget { get; set; }
    }
}
