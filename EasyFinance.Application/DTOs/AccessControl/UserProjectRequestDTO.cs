using System;
using EasyFinance.Domain.AccessControl;

namespace EasyFinance.Application.DTOs.AccessControl
{
    public class UserProjectRequestDTO
    {
        public Guid? UserId { get; set; }
        public string UserEmail { get; set; }
        public Role Role { get; set; }
    }
}
