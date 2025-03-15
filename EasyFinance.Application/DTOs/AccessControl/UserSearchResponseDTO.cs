using System;

namespace EasyFinance.Application.DTOs.AccessControl
{
    public class UserSearchResponseDTO
    {
        public UserSearchResponseDTO(UserResponseDTO user)
        {
            if (user != null)
            {
                Id = user.Id;
                Email = user.Email;
                FullName = user.FullName;
            }
        }

        public Guid Id { get; set; }
        public string Email { get; set; } = string.Empty;
        public string FullName { get; set; } = string.Empty;
    }
}
