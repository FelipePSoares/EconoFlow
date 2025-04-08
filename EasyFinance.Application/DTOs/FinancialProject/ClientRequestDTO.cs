using System;

namespace EasyFinance.Application.DTOs.FinancialProject
{
    public class ClientRequestDTO
    {
        public string Name { get; set; }
        public string Email { get; private set; }
        public string Phone { get; private set; }
        public string Description { get; private set; }
    }
}
