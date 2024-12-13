using EasyFinance.Domain.AccessControl;

namespace EasyFinance.Server.DTOs.AccessControl
{
    public class UserSearchResponseDTO
    {
        public UserSearchResponseDTO(User user)
        {
            if (user != null) 
            { 
                Id = user.Id;
                FirstName = user.FirstName;
                LastName = user.LastName;
                Email = user.Email;
            }
        }

        public Guid Id { get; protected set; }
        public string FirstName { get; protected set; }
        public string LastName { get; protected set; }
        public string Email { get; protected set; }
    }
}
