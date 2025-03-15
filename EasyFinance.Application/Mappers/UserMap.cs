using System.Collections.Generic;
using System.Linq;
using EasyFinance.Application.DTOs.AccessControl;
using EasyFinance.Domain.AccessControl;

namespace EasyFinance.Application.Mappers
{
    public static class UserMap
    {
        public static IEnumerable<UserResponseDTO> ToDTO(this IEnumerable<User> users) 
            => users.Select(u => new UserResponseDTO(u));

        public static IEnumerable<UserSearchResponseDTO> ToSearchResponseDTO(this IEnumerable<UserResponseDTO> users)
            => users.Select(u => new UserSearchResponseDTO(u));
    }
}
