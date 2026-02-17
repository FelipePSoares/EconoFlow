using System.Collections.Generic;
using EasyFinance.Domain.AccessControl;

namespace EasyFinance.Application.DTOs.AccessControl
{
    public class RefreshTokenContextDTO
    {
        public RefreshTokenContextDTO(User user, IList<string> roles)
        {
            User = user;
            Roles = roles;
        }

        public User User { get; }
        public IList<string> Roles { get; }
    }
}
