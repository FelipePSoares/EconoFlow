using EasyFinance.Application.Contracts.Persistence;
using EasyFinance.Application.DTOs.Account;
using EasyFinance.Application.Features.ExpoPushTokenService;
using EasyFinance.Common.Tests;
using EasyFinance.Domain.Account;
using FluentAssertions;
using Microsoft.Extensions.DependencyInjection;

namespace EasyFinance.Application.Tests
{
    public class ExpoPushTokenServiceTests : BaseTests
    {
        private const string Token1 = "ExponentPushToken[AAAAAAAAAAAAAAAAAAAAAA]";
        private const string Token2 = "ExponentPushToken[BBBBBBBBBBBBBBBBBBBBBB]";

        [Fact]
        public async Task UpsertTokenAsync_NewToken_ShouldPersist()
        {
            PrepareInMemoryDatabase();
            using var scope = serviceProvider.CreateScope();
            var unitOfWork = scope.ServiceProvider.GetRequiredService<IUnitOfWork>();
            var service = new ExpoPushTokenService(unitOfWork);

            var response = await service.UpsertTokenAsync(user1.Id, Token1, "iPhone 15");

            response.Succeeded.Should().BeTrue();
            var persisted = unitOfWork.ExpoPushTokenRepository.NoTrackable().ToList();
            persisted.Should().HaveCount(1);
            persisted.Single().UserId.Should().Be(user1.Id);
            persisted.Single().Token.Should().Be(Token1);
            persisted.Single().DeviceName.Should().Be("iPhone 15");
            persisted.Single().IsActive.Should().BeTrue();
        }

        [Fact]
        public async Task UpsertTokenAsync_ExistingRevokedToken_ShouldReactivate()
        {
            PrepareInMemoryDatabase();
            using var scope = serviceProvider.CreateScope();
            var unitOfWork = scope.ServiceProvider.GetRequiredService<IUnitOfWork>();
            var service = new ExpoPushTokenService(unitOfWork);

            await service.UpsertTokenAsync(user1.Id, Token1, null);
            await service.RevokeTokenAsync(user1.Id, Token1);

            var revokedTokens = unitOfWork.ExpoPushTokenRepository.NoTrackable().ToList();
            revokedTokens.Single().IsActive.Should().BeFalse();

            var reactivateResponse = await service.UpsertTokenAsync(user1.Id, Token1, "New Device");
            reactivateResponse.Succeeded.Should().BeTrue();

            var tokens = unitOfWork.ExpoPushTokenRepository.NoTrackable().ToList();
            tokens.Should().HaveCount(1);
            tokens.Single().IsActive.Should().BeTrue();
            tokens.Single().DeviceName.Should().Be("New Device");
        }

        [Fact]
        public async Task RevokeTokenAsync_OwnToken_ShouldRevoke()
        {
            PrepareInMemoryDatabase();
            using var scope = serviceProvider.CreateScope();
            var unitOfWork = scope.ServiceProvider.GetRequiredService<IUnitOfWork>();
            var service = new ExpoPushTokenService(unitOfWork);

            await service.UpsertTokenAsync(user1.Id, Token1, null);
            var response = await service.RevokeTokenAsync(user1.Id, Token1);

            response.Succeeded.Should().BeTrue();
            unitOfWork.ExpoPushTokenRepository.NoTrackable().Single().IsActive.Should().BeFalse();
        }

        [Fact]
        public async Task RevokeTokenAsync_TokenBelongingToAnotherUser_ShouldReturnError()
        {
            PrepareInMemoryDatabase();
            using var scope = serviceProvider.CreateScope();
            var unitOfWork = scope.ServiceProvider.GetRequiredService<IUnitOfWork>();
            var service = new ExpoPushTokenService(unitOfWork);

            await service.UpsertTokenAsync(user1.Id, Token1, null);
            var response = await service.RevokeTokenAsync(user2.Id, Token1);

            response.Failed.Should().BeTrue();
        }

        [Fact]
        public async Task RevokeTokenAsync_NonExistentToken_ShouldSucceed()
        {
            PrepareInMemoryDatabase();
            using var scope = serviceProvider.CreateScope();
            var unitOfWork = scope.ServiceProvider.GetRequiredService<IUnitOfWork>();
            var service = new ExpoPushTokenService(unitOfWork);

            var response = await service.RevokeTokenAsync(user1.Id, "ExponentPushToken[doesNotExist]");

            response.Succeeded.Should().BeTrue();
        }

        [Fact]
        public async Task GetActiveTokensForUserAsync_ReturnsOnlyActiveTokensForUser()
        {
            PrepareInMemoryDatabase();
            using var scope = serviceProvider.CreateScope();
            var unitOfWork = scope.ServiceProvider.GetRequiredService<IUnitOfWork>();
            var service = new ExpoPushTokenService(unitOfWork);

            await service.UpsertTokenAsync(user1.Id, Token1, null);
            await service.UpsertTokenAsync(user1.Id, Token2, null);
            await service.UpsertTokenAsync(user2.Id, "ExponentPushToken[CCCCCCCCCCCCCCCCCCCCCC]", null);
            await service.RevokeTokenAsync(user1.Id, Token2);

            var tokens = await service.GetActiveTokensForUserAsync(user1.Id);

            tokens.Should().HaveCount(1);
            tokens.Should().Contain(Token1);
        }

        [Fact]
        public async Task GetActiveTokensForUsersAsync_ReturnsGroupedByUser()
        {
            PrepareInMemoryDatabase();
            using var scope = serviceProvider.CreateScope();
            var unitOfWork = scope.ServiceProvider.GetRequiredService<IUnitOfWork>();
            var service = new ExpoPushTokenService(unitOfWork);

            await service.UpsertTokenAsync(user1.Id, Token1, null);
            await service.UpsertTokenAsync(user2.Id, Token2, null);

            var result = await service.GetActiveTokensForUsersAsync([user1.Id, user2.Id]);

            result.Should().ContainKey(user1.Id);
            result.Should().ContainKey(user2.Id);
            result[user1.Id].Should().Contain(Token1);
            result[user2.Id].Should().Contain(Token2);
        }

        [Fact]
        public async Task UpsertTokenAsync_NullOrEmptyToken_ShouldReturnError()
        {
            PrepareInMemoryDatabase();
            using var scope = serviceProvider.CreateScope();
            var unitOfWork = scope.ServiceProvider.GetRequiredService<IUnitOfWork>();
            var service = new ExpoPushTokenService(unitOfWork);

            var response = await service.UpsertTokenAsync(user1.Id, string.Empty, null);

            response.Failed.Should().BeTrue();
        }
    }
}
