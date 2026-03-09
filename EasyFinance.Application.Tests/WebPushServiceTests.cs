using EasyFinance.Application.Contracts.Persistence;
using EasyFinance.Application.DTOs.Account;
using EasyFinance.Application.Features.FeatureRolloutService;
using EasyFinance.Application.Features.WebPushService;
using EasyFinance.Common.Tests;
using EasyFinance.Domain.AccessControl;
using EasyFinance.Domain.Account;
using FluentAssertions;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using MockQueryable;
using Moq;

namespace EasyFinance.Application.Tests
{
    public class WebPushServiceTests : BaseTests
    {
        [Fact]
        public async Task UpsertSubscriptionAsync_NewSubscription_ShouldPersist()
        {
            PrepareInMemoryDatabase();

            using var scope = serviceProvider.CreateScope();
            var unitOfWork = scope.ServiceProvider.GetRequiredService<IUnitOfWork>();
            var service = CreateService(unitOfWork, [user1, user2]);

            var response = await service.UpsertSubscriptionAsync(
                user1.Id,
                new WebPushSubscriptionRequestDTO
                {
                    Endpoint = "https://example.push/subscription/1",
                    P256dh = "p256dh-key",
                    Auth = "auth-secret",
                    DeviceType = WebPushDeviceType.Pwa,
                    UserAgent = "Mozilla/5.0"
                },
                CancellationToken.None);

            response.Succeeded.Should().BeTrue();

            var subscriptions = unitOfWork.WebPushSubscriptionRepository.NoTrackable().ToList();
            subscriptions.Should().HaveCount(1);
            subscriptions.Single().UserId.Should().Be(user1.Id);
            subscriptions.Single().Endpoint.Should().Be("https://example.push/subscription/1");
            subscriptions.Single().DeviceType.Should().Be(WebPushDeviceType.Pwa);
        }

        [Fact]
        public async Task UpsertSubscriptionAsync_EndpointOwnedByAnotherUser_ShouldFailWithForbidden()
        {
            PrepareInMemoryDatabase();

            using var scope = serviceProvider.CreateScope();
            var unitOfWork = scope.ServiceProvider.GetRequiredService<IUnitOfWork>();
            var service = CreateService(unitOfWork, [user1, user2]);

            const string endpoint = "https://example.push/subscription/shared";
            var firstResponse = await service.UpsertSubscriptionAsync(
                user1.Id,
                new WebPushSubscriptionRequestDTO
                {
                    Endpoint = endpoint,
                    P256dh = "p256dh-key",
                    Auth = "auth-secret"
                },
                CancellationToken.None);

            firstResponse.Succeeded.Should().BeTrue();

            var secondResponse = await service.UpsertSubscriptionAsync(
                user2.Id,
                new WebPushSubscriptionRequestDTO
                {
                    Endpoint = endpoint,
                    P256dh = "new-p256dh-key",
                    Auth = "new-auth-secret"
                },
                CancellationToken.None);

            secondResponse.Failed.Should().BeTrue();
            secondResponse.Messages.Should().Contain(message => message.Code == "forbidden");

            var persisted = unitOfWork.WebPushSubscriptionRepository.NoTrackable().Single();
            persisted.UserId.Should().Be(user1.Id);
            persisted.P256dh.Should().Be("p256dh-key");
            persisted.Auth.Should().Be("auth-secret");
        }

        [Fact]
        public async Task UnsubscribeAsync_OwnSubscription_ShouldDelete()
        {
            PrepareInMemoryDatabase();

            using var scope = serviceProvider.CreateScope();
            var unitOfWork = scope.ServiceProvider.GetRequiredService<IUnitOfWork>();
            var service = CreateService(unitOfWork, [user1, user2]);

            const string endpoint = "https://example.push/subscription/remove";
            await service.UpsertSubscriptionAsync(
                user1.Id,
                new WebPushSubscriptionRequestDTO
                {
                    Endpoint = endpoint,
                    P256dh = "p256dh-key",
                    Auth = "auth-secret"
                },
                CancellationToken.None);

            var response = await service.UnsubscribeAsync(user1.Id, endpoint, CancellationToken.None);
            response.Succeeded.Should().BeTrue();
            unitOfWork.WebPushSubscriptionRepository.NoTrackable().Should().BeEmpty();
        }

        [Fact]
        public async Task UnsubscribeAsync_SubscriptionOwnedByAnotherUser_ShouldFailWithForbidden()
        {
            PrepareInMemoryDatabase();

            using var scope = serviceProvider.CreateScope();
            var unitOfWork = scope.ServiceProvider.GetRequiredService<IUnitOfWork>();
            var service = CreateService(unitOfWork, [user1, user2]);

            const string endpoint = "https://example.push/subscription/owned";
            await service.UpsertSubscriptionAsync(
                user1.Id,
                new WebPushSubscriptionRequestDTO
                {
                    Endpoint = endpoint,
                    P256dh = "p256dh-key",
                    Auth = "auth-secret"
                },
                CancellationToken.None);

            var response = await service.UnsubscribeAsync(user2.Id, endpoint, CancellationToken.None);
            response.Failed.Should().BeTrue();
            response.Messages.Should().Contain(message => message.Code == "forbidden");
            unitOfWork.WebPushSubscriptionRepository.NoTrackable().Should().HaveCount(1);
        }

        private static WebPushService CreateService(IUnitOfWork unitOfWork, IEnumerable<User> users)
        {
            var userStore = new Mock<IUserStore<User>>();
#pragma warning disable CS8625 // Cannot convert null literal to non-nullable reference type.
            var userManager = new Mock<UserManager<User>>(
                userStore.Object,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null);
#pragma warning restore CS8625 // Cannot convert null literal to non-nullable reference type.

            userManager.SetupGet(manager => manager.Users).Returns(users.AsQueryable().BuildMock());
            userManager.Setup(manager => manager.GetRolesAsync(It.IsAny<User>()))
                .ReturnsAsync([SystemRoles.BetaTester]);

            var featureRolloutService = new Mock<IFeatureRolloutService>();
            featureRolloutService
                .Setup(service => service.IsEnabled(It.IsAny<IList<string>>(), FeatureFlags.WebPush))
                .Returns(true);

            return new WebPushService(
                unitOfWork,
                Options.Create(new WebPushOptions
                {
                    Subject = "mailto:test@econoflow.pt",
                    PublicKey = "public-key",
                    PrivateKey = "private-key"
                }),
                userManager.Object,
                featureRolloutService.Object,
                Mock.Of<ILogger<WebPushService>>());
        }
    }
}
