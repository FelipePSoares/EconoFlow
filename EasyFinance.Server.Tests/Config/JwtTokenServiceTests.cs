using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using AutoFixture;
using EasyFinance.Common.Tests;
using EasyFinance.Domain.AccessControl;
using FluentAssertions;
using FpsSoftware.Chassis;
using Microsoft.IdentityModel.Tokens;

namespace EasyFinance.Server.Tests.Config
{
    public class JwtTokenServiceTests : BaseTests
    {
        private readonly JwtSecurityTokenHandler jwtHandler;

        public JwtTokenServiceTests()
        {
            this.jwtHandler = new JwtSecurityTokenHandler();
        }

        private static IReadOnlyCollection<Claim> BuildUserClaims(User user, IReadOnlyCollection<Claim> extraClaims)
        {
            var claims = new List<Claim>
            {
                new(ClaimTypes.NameIdentifier, user.Id.ToString()),
                new(ClaimTypes.GivenName, user.FirstName ?? ""),
                new(ClaimTypes.Surname, user.LastName ?? ""),
            };
            claims.AddRange(extraClaims);
            return claims;
        }

        [Fact]
        public void CreateToken_SuccessScenario_ShouldReturnToken()
        {
            // Arrange
            var tokenSettings = new JwtTokenSettings
            {
                SecretKey = Guid.NewGuid().ToString(),
            };
            var user = new User();
            var roleClaims = new List<Claim>();

            // Act
            var token = JwtTokenService.CreateToken(tokenSettings, BuildUserClaims(user, roleClaims));

            // Assert
            token.Should().NotBeNull();
        }

        [Fact]
        public void CreateToken_tokensettingsInformed_ShouldReturnTokenWithCorrectInformation()
        {
            // Arrange
            var audience = "http://localhost:8080";
            var issuer = "http://localhost:8080";
            var tokenExpireSeconds = 5;

            var tokenSettings = new JwtTokenSettings
            {
                SecretKey = Guid.NewGuid().ToString(),
                Audience = audience,
                Issuer = issuer,
                TokenExpireSeconds = tokenExpireSeconds
            };
            var user = new User();
            var roleClaims = new List<Claim>();

            // Act
            var token = JwtTokenService.CreateToken(tokenSettings, BuildUserClaims(user, roleClaims));

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
        public void CreateToken_RoleClaimsInformed_ShouldReturnTokenWithRoleClaims()
        {
            // Arrange
            var claimValue = Guid.NewGuid().ToString();

            var tokenSettings = new JwtTokenSettings
            {
                SecretKey = Guid.NewGuid().ToString(),
            };
            var user = new User();
            var roleClaims = new List<Claim>()
            {
                new Claim(ClaimTypes.Role, claimValue)
            };

            // Act
            var token = JwtTokenService.CreateToken(tokenSettings, BuildUserClaims(user, roleClaims));

            // Assert
            token.Should().NotBeNull();

            var claim = GetClaim(token, ClaimTypes.Role);
            claim.Should().NotBeNull();
            claim.Value.Should().Be(claimValue);
        }

        [Theory]
        [MemberData(nameof(TokenInfoData))]
        public void CreateToken_UserInformed_ShouldReturnTokenClaimsWithCorrectInformation(User user, string expectedValue, string claimType)
        {
            // Arrange
            var tokenSettings = new JwtTokenSettings
            {
                SecretKey = Guid.NewGuid().ToString(),
            };

            var roleClaims = new List<Claim>();

            // Act
            var token = JwtTokenService.CreateToken(tokenSettings, BuildUserClaims(user, roleClaims));

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
            JwtTokenSettings tokenSettings = GenerateTokenSettings();
            string token = GenerateToken(tokenSettings);

            // Act
            var principal = JwtTokenService.GetPrincipalFromExpiredToken(tokenSettings, token);

            // Assert
            principal.Identity.Should().NotBeNull();
            principal.Identity?.IsAuthenticated.Should().BeTrue();
        }

        [Fact]
        public void GetPrincipalFromExpiredToken_InvalidIssuer_ShouldThrowInvalidIssuerException()
        {
            // Arrange
            JwtTokenSettings tokenSettings = GenerateTokenSettings();
            string token = GenerateToken(tokenSettings);

            tokenSettings.Issuer = "Teste";

            // Act
            Action action = () => JwtTokenService.GetPrincipalFromExpiredToken(tokenSettings, token);

            // Assert
            action.Should().ThrowExactly<SecurityTokenInvalidIssuerException>();
        }

        [Fact]
        public void GetPrincipalFromExpiredToken_InvalidAudience_ShouldThrowInvalidAudienceException()
        {
            // Arrange
            JwtTokenSettings tokenSettings = GenerateTokenSettings();
            string token = GenerateToken(tokenSettings);

            tokenSettings.Audience = "Teste";

            // Act
            Action action = () => JwtTokenService.GetPrincipalFromExpiredToken(tokenSettings, token);

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

        private string GenerateToken(JwtTokenSettings tokenSettings)
        {
            var user = new User();
            var roleClaims = new List<Claim>();

            var token = JwtTokenService.CreateToken(tokenSettings, BuildUserClaims(user, roleClaims));
            return token;
        }

        private JwtTokenSettings GenerateTokenSettings()
        {
            var audience = "http://localhost:8080";
            var issuer = "http://localhost:8080";
            var tokenExpireSeconds = 1;

            var tokenSettings = new JwtTokenSettings
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
