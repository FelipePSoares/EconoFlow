using EasyFinance.Domain.Financial;
using System;
using System.Collections.Generic;

namespace EasyFinance.Application.DTOs.Financial
{
    public class CategoryResponseDTO
    {
        public Guid Id { get; set; }
        public string Name { get; set; }
        public ICollection<Expense> Expenses { get; set; } = new List<Expense>();
    }
}
