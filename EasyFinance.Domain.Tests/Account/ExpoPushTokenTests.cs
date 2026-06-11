using EasyFinance.Common.Tests;
using EasyFinance.Domain.Account;
using EasyFinance.Infrastructure;
using FluentAssertions;

namespace EasyFinance.Domain.Tests.Account
{
    public class ExpoPushTokenTests : BaseTests
    {
        private static readonly Guid ValidUserId = Guid.NewGuid();
        private const string ValidToken = "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]";

        [Fact]
        public void Validate_ValidEntity_ShouldSucceed()
        {
            var token = new ExpoPushToken(ValidUserId, ValidToken);
            token.Validate.Succeeded.Should().BeTrue();
        }

        [Fact]
        public void Validate_EmptyUserId_ShouldReturnError()
        {
            var token = new ExpoPushToken(Guid.Empty, ValidToken);
            var result = token.Validate;
            result.Failed.Should().BeTrue();
            result.Messages.Should().Contain(m => m.Code == "UserId");
        }

        [Theory]
        [InlineData(null)]
        [InlineData("")]
        [InlineData("   ")]
        public void Validate_NullOrWhitespaceToken_ShouldReturnError(string? invalidToken)
        {
            var token = new ExpoPushToken(ValidUserId, invalidToken!);
            var result = token.Validate;
            result.Failed.Should().BeTrue();
            result.Messages.Should().Contain(m => m.Code == "Token");
        }

        [Fact]
        public void Validate_TokenExceedsMaxLength_ShouldReturnError()
        {
            var token = new ExpoPushToken(ValidUserId, new string('a', 513));
            var result = token.Validate;
            result.Failed.Should().BeTrue();
            result.Messages.Should().Contain(m => m.Code == "Token");
        }

        [Fact]
        public void IsActive_NewToken_ShouldBeTrue()
        {
            var token = new ExpoPushToken(ValidUserId, ValidToken);
            token.IsActive.Should().BeTrue();
        }

        [Fact]
        public void Revoke_ShouldSetRevokedAt()
        {
            var token = new ExpoPushToken(ValidUserId, ValidToken);
            var now = DateTime.UtcNow;

            token.Revoke(now);

            token.IsActive.Should().BeFalse();
            token.RevokedAt.Should().Be(now);
        }

        [Fact]
        public void SetDeviceName_ShouldPersistValue()
        {
            var token = new ExpoPushToken(ValidUserId, ValidToken);
            token.SetDeviceName("iPhone 15 Pro");
            token.DeviceName.Should().Be("iPhone 15 Pro");
        }

        [Fact]
        public void Validate_DeviceNameExceedsMaxLength_ShouldReturnError()
        {
            var token = new ExpoPushToken(ValidUserId, ValidToken);
            token.SetDeviceName(new string('d', 257));
            var result = token.Validate;
            result.Failed.Should().BeTrue();
            result.Messages.Should().Contain(m => m.Code == "DeviceName");
        }
    }
}
