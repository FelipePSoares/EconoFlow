using System;

namespace EasyFinance.Application.DTOs.AccessControl
{
    public class UserRequestDTO
    {
        public string FirstName { get; set; } = "Default";
        public string LastName { get; set; } = "Default";
        public Guid DefaultProject {  get; set; } = Guid.Empty;
    }
}
