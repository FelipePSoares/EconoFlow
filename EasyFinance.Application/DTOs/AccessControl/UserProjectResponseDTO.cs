using System;
using EasyFinance.Application.DTOs.FinancialProject;
using EasyFinance.Domain.AccessControl;

namespace EasyFinance.Application.DTOs.AccessControl
{
    public class UserProjectResponseDTO
    {
        public UserProjectResponseDTO(User user)
        {
            UserId = user.Id;
            UserName = user.FullName;
            UserEmail = user.Email;
        }

        public UserProjectResponseDTO()
        {
            
        }

        public Guid Id { get; set; }
        public Guid? UserId { get; set; }
        public string UserName { get; set; }
        public string UserEmail { get; set; }
        public ProjectResponseDTO Project { get; set; }
        public Role Role { get; set; }
        public bool Accepted { get; set; }
    }
}
