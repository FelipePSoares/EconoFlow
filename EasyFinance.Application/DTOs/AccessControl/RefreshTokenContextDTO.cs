using System.Collections.Generic;
using EasyFinance.Domain.AccessControl;

namespace EasyFinance.Application.DTOs.AccessControl
{
    public class RefreshTokenContextDTO
    {
        public RefreshTokenContextDTO(User user, string storedRefreshToken, IList<string> roles)
        {
            User = user;
            StoredRefreshToken = storedRefreshToken;
            Roles = roles;
        }

        public User User { get; }
        public string StoredRefreshToken { get; }
        public IList<string> Roles { get; }
    }
}
