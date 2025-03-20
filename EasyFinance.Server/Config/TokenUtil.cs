using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using EasyFinance.Domain.AccessControl;
using EasyFinance.Infrastructure.Authentication;
using Microsoft.IdentityModel.Tokens;

namespace EasyFinance.Server.Config
{
    public static class TokenUtil
    {

        public static string GetToken(TokenSettings tokenSettings, User user, List<Claim> roleClaims)
        {
            var secretKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(tokenSettings.SecretKey));
            var signInCredentials = new SigningCredentials(secretKey, SecurityAlgorithms.HmacSha256);

            var userClaims = new List<Claim>
            {
                new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
                new Claim(ClaimTypes.GivenName, user.FirstName??""),
                new Claim(ClaimTypes.Surname, user.LastName??"")
            };

            userClaims.AddRange(roleClaims);

            var tokeOptions = new JwtSecurityToken(
                issuer: tokenSettings.Issuer,
                audience: tokenSettings.Audience,
                claims: userClaims,
                expires: DateTime.UtcNow.AddSeconds(tokenSettings.TokenExpireSeconds),
                signingCredentials: signInCredentials
            );

            return new JwtSecurityTokenHandler().WriteToken(tokeOptions);
        }

        public static ClaimsPrincipal GetPrincipalFromExpiredToken(TokenSettings tokenSettings, string token)
        {
            var tokenValidationParameters = new TokenValidationParameters
            {
                ValidateAudience = !string.IsNullOrEmpty(tokenSettings.Audience),
                ValidAudience = tokenSettings.Audience,
                ValidateIssuer = !string.IsNullOrEmpty(tokenSettings.Issuer),
                ValidIssuer = tokenSettings.Issuer,
                ValidateLifetime = false,
                IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(tokenSettings.SecretKey))
            };

            var principal = new JwtSecurityTokenHandler().ValidateToken(token, tokenValidationParameters, out SecurityToken securityToken);
            if (!(securityToken is JwtSecurityToken jwtSecurityToken) || !jwtSecurityToken.Header.Alg.Equals(SecurityAlgorithms.HmacSha256, StringComparison.InvariantCultureIgnoreCase))
                throw new SecurityTokenException("GetPrincipalFromExpiredToken Token is not validated");

            return principal;
        }
    }
}
