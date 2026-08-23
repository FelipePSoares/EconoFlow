using System;
using System.Collections.Generic;
using System.Security.Claims;
using EasyFinance.Domain.AccessControl;
using FpsSoftware.Chassis;

namespace EasyFinance.Common.Tests
{
    public static class TokenFactory
    {
        public static string CreateAccessToken(JwtTokenSettings settings, User user, IReadOnlyCollection<Claim>? extraClaims = null)
        {
            var claims = new List<Claim>
            {
                new(ClaimTypes.NameIdentifier, user.Id.ToString()),
                new(ClaimTypes.GivenName, user.FirstName ?? ""),
                new(ClaimTypes.Surname, user.LastName ?? ""),
            };

            if (extraClaims != null)
                claims.AddRange(extraClaims);

            return JwtTokenService.CreateToken(settings, claims);
        }
    }
}
