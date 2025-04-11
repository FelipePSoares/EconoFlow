using System;

namespace EasyFinance.Application.DTOs.FinancialProject
{
    public class ClientResponseDTO
    {
        public Guid Id { get; set; }
        public string Name { get; set; }
        public string Email { get; set; }
        public string Phone { get; set; }
        public string Description { get; set; }
        public bool IsActive { get; set; }
    }
}
