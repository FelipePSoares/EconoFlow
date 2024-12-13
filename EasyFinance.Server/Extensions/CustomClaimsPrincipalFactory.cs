using EasyFinance.Domain.AccessControl;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Options;
using System.Security.Claims;

namespace EasyFinance.Server.Extensions
{
    public class CustomClaimsPrincipalFactory : UserClaimsPrincipalFactory<User>
    {
        public CustomClaimsPrincipalFactory(UserManager<User> userManager, IOptions<IdentityOptions> optionsAccessor) : base(userManager, optionsAccessor)
        {
        }

        public async override Task<ClaimsPrincipal> CreateAsync(User user)
        {
            var principal = await base.CreateAsync(user);

            ((ClaimsIdentity)principal.Identity).AddClaims(new[] { new Claim(ClaimTypes.Email, user.Email),
                                                                new Claim(ClaimTypes.GivenName, user.FirstName),
                                                                new Claim(ClaimTypes.Surname, user.LastName)
                                                             });

            return principal;
        }
    }
}
