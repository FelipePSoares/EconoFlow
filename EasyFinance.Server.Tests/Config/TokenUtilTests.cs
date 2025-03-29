using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using AutoFixture;
using EasyFinance.Common.Tests;
using EasyFinance.Domain.AccessControl;
using EasyFinance.Infrastructure.Authentication;
using EasyFinance.Server.Config;
using FluentAssertions;
using Microsoft.IdentityModel.Tokens;

namespace EasyFinance.Server.Tests.Config
{
    public class TokenUtilTests : BaseTests
    {
        private readonly JwtSecurityTokenHandler jwtHandler;

        public TokenUtilTests()
        {
            this.jwtHandler = new JwtSecurityTokenHandler();
        }

        [Fact]
        public void GetToken_SuccessScenario_ShouldReturnToken()
        {
            // Arrange
            var tokenSettings = new TokenSettings
            {
                SecretKey = Guid.NewGuid().ToString(),
            };
            var user = new User();
            var roleClaims = new List<Claim>();

            // Act
            var token = TokenUtil.GetToken(tokenSettings, user, roleClaims);

            // Assert
            token.Should().NotBeNull();
        }

        [Fact]
        public void GetToken_tokensettingsInformed_ShouldReturnTokenWithCorrectInformation()
        {
            // Arrange
            var audience = "http://localhost:8080";
            var issuer = "http://localhost:8080";
            var tokenExpireSeconds = 5;

            var tokenSettings = new TokenSettings
            {
                SecretKey = Guid.NewGuid().ToString(),
                Audience = audience,
                Issuer = issuer,
                TokenExpireSeconds = tokenExpireSeconds
            };
            var user = new User();
            var roleClaims = new List<Claim>();

            // Act
            var token = TokenUtil.GetToken(tokenSettings, user, roleClaims);

            // Assert
            token.Should().NotBeNull();

            var audienceClaim = GetClaim(token, "aud");
            audienceClaim.Should().NotBeNull();
            audienceClaim.Value.Should().Be(audience);

            var issuerClaim = GetClaim(token, "iss");
            issuerClaim.Should().NotBeNull();
            issuerClaim.Value.Should().Be(issuer);

            var expirationClaim = GetClaim(token, "exp");
            expirationClaim.Should().NotBeNull();
            var expirationDate = DateTimeOffset.FromUnixTimeSeconds(Convert.ToInt64(expirationClaim.Value));
            expirationDate.Should().BeCloseTo(DateTimeOffset.UtcNow.AddSeconds(tokenExpireSeconds), TimeSpan.FromSeconds(1));
        }

        [Fact]
        public void GetToken_RoleClaimsInformed_ShouldReturnTokenWithRoleClaims()
        {
            // Arrange
            var claimValue = Guid.NewGuid().ToString();

            var tokenSettings = new TokenSettings
            {
                SecretKey = Guid.NewGuid().ToString(),
            };
            var user = new User();
            var roleClaims = new List<Claim>()
            {
                new Claim(ClaimTypes.Role, claimValue)
            };

            // Act
            var token = TokenUtil.GetToken(tokenSettings, user, roleClaims);

            // Assert
            token.Should().NotBeNull();

            var claim = GetClaim(token, ClaimTypes.Role);
            claim.Should().NotBeNull();
            claim.Value.Should().Be(claimValue);
        }

        [Theory]
        [MemberData(nameof(TokenInfoData))]
        public void GetToken_UserInformed_ShouldReturnTokenClaimsWithCorrectInformation(User user, string expectedValue, string claimType)
        {
            // Arrange
            var tokenSettings = new TokenSettings
            {
                SecretKey = Guid.NewGuid().ToString(),
            };

            var roleClaims = new List<Claim>();

            // Act
            var token = TokenUtil.GetToken(tokenSettings, user, roleClaims);

            // Assert
            token.Should().NotBeNull();

            var claim = GetClaim(token, claimType);
            claim.Should().NotBeNull();
            claim.Value.Should().Be(expectedValue);
        }

        [Fact]
        public void GetPrincipalFromExpiredToken_ValidToken_ShouldReturnIsAuthenticatedTrue()
        {
            // Arrange
            TokenSettings tokenSettings = GenerateTokenSettings();
            string token = GenerateToken(tokenSettings);

            // Act
            var principal = TokenUtil.GetPrincipalFromExpiredToken(tokenSettings, token);

            // Assert
            principal.Identity.Should().NotBeNull();
            principal.Identity?.IsAuthenticated.Should().BeTrue();
        }

        [Fact]
        public void GetPrincipalFromExpiredToken_InvalidIssuer_ShouldThrowInvalidIssuerException()
        {
            // Arrange
            TokenSettings tokenSettings = GenerateTokenSettings();
            string token = GenerateToken(tokenSettings);

            tokenSettings.Issuer = "Teste";

            // Act
            Action action = () => TokenUtil.GetPrincipalFromExpiredToken(tokenSettings, token);

            // Assert
            action.Should().ThrowExactly<SecurityTokenInvalidIssuerException>();
        }

        [Fact]
        public void GetPrincipalFromExpiredToken_InvalidAudience_ShouldThrowInvalidAudienceException()
        {
            // Arrange
            TokenSettings tokenSettings = GenerateTokenSettings();
            string token = GenerateToken(tokenSettings);

            tokenSettings.Audience = "Teste";

            // Act
            Action action = () => TokenUtil.GetPrincipalFromExpiredToken(tokenSettings, token);

            // Assert
            action.Should().ThrowExactly<SecurityTokenInvalidAudienceException>();
        }

        public static IEnumerable<object[]> TokenInfoData()
        {
            var user = new Fixture().Create<User>();

            yield return new object[] { user, user.Id.ToString(), ClaimTypes.NameIdentifier };
            yield return new object[] { user, user.FirstName.ToString(), ClaimTypes.GivenName };
            yield return new object[] { user, user.LastName.ToString(), ClaimTypes.Surname };
        }

        private Claim GetClaim(string token, string claimType)
        {
            var jwtSecurityToken = this.jwtHandler.ReadJwtToken(token);

            return jwtSecurityToken.Claims.First(claim => claim.Type == claimType);
        }

        private string GenerateToken(TokenSettings tokenSettings)
        {
            var user = new User();
            var roleClaims = new List<Claim>();

            var token = TokenUtil.GetToken(tokenSettings, user, roleClaims);
            return token;
        }

        private TokenSettings GenerateTokenSettings()
        {
            var audience = "http://localhost:8080";
            var issuer = "http://localhost:8080";
            var tokenExpireSeconds = 1;

            var tokenSettings = new TokenSettings
            {
                SecretKey = Guid.NewGuid().ToString(),
                Audience = audience,
                Issuer = issuer,
                TokenExpireSeconds = tokenExpireSeconds
            };
            return tokenSettings;
        }
    }
}