using EasyFinance.Application.DTOs.FinancialProject;
using EasyFinance.Domain.AccessControl;

namespace EasyFinance.Application.DTOs.AccessControl
{
    public class UserProjectResponseDTO
    {
        public string UserName { get; set; }
        public string UserEmail { get; set; }
        public ProjectResponseDTO Project { get; set; }
        public Role Role { get; set; }
        public bool Accepted { get; set; }
    }
}
