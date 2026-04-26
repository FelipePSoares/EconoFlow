using System;
using System.Linq;
using System.Threading;
using System.Threading.Channels;
using EasyFinance.Application.Contracts.Persistence;
using EasyFinance.Application.DTOs.Account;
using EasyFinance.Application.DTOs.BackgroundService.Notification;
using EasyFinance.Application.Features.NotificationService;
using EasyFinance.Common.Tests;
using EasyFinance.Domain.AccessControl;
using EasyFinance.Domain.Account;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace EasyFinance.Application.Tests
{
    public class NotificationServiceDeliveryTests : BaseTests
    {
        [Fact]
        public async Task GetEmailDeliveryCandidatesAsync_DBInsertedNotification_ShouldReturnPendingNotification()
        {
            PrepareInMemoryDatabase();

            using var scope = serviceProvider.CreateScope();
            var unitOfWork = scope.ServiceProvider.GetRequiredService<Application.Contracts.Persistence.IUnitOfWork>();
            var notification = new Notification(user1, "WelcomeMessage", NotificationType.Information, NotificationCategory.System);
            unitOfWork.NotificationRepository.InsertOrUpdate(notification);
            await unitOfWork.CommitAsync();

            var channel = Channel.CreateUnbounded<NotificationRequest>();
            var service = new NotificationService(unitOfWork, channel);

            var candidates = await service.GetEmailDeliveryCandidatesAsync(10, CancellationToken.None);

            candidates.Succeeded.Should().BeTrue();
            candidates.Data.Should().Contain(notification.Id);
        }

        [Fact]
        public async Task CreateNotificationAsync_ShouldQueueNotificationAndKeepEmailPending()
        {
            PrepareInMemoryDatabase();

            using var scope = serviceProvider.CreateScope();
            var unitOfWork = scope.ServiceProvider.GetRequiredService<Application.Contracts.Persistence.IUnitOfWork>();

            var channel = Channel.CreateUnbounded<NotificationRequest>();
            var service = new NotificationService(unitOfWork, channel);

            var response = await service.CreateNotificationAsync(new NotificationRequestDTO
            {
                User = user1,
                Type = NotificationType.Information,
                Category = NotificationCategory.System,
                CodeMessage = "WelcomeMessage"
            });

            response.Succeeded.Should().BeTrue();
            channel.Reader.TryRead(out var queued).Should().BeTrue();
            queued!.NotificationId.Should().Be(response.Data.Id);

            var stored = await service.GetAsync(response.Data.Id, CancellationToken.None);
            stored.Succeeded.Should().BeTrue();
            stored.Data.EmailStatus.Should().Be(NotificationChannelDeliveryStatus.Pending);
        }

        [Fact]
        public async Task TryClaimEmailDeliveryAsync_WithExpiredLock_ShouldAllowRecovery()
        {
            PrepareInMemoryDatabase();

            using var scope = serviceProvider.CreateScope();
            var unitOfWork = scope.ServiceProvider.GetRequiredService<Application.Contracts.Persistence.IUnitOfWork>();
            var notification = new Notification(user1, "WelcomeMessage", NotificationType.Information, NotificationCategory.System);
            unitOfWork.NotificationRepository.InsertOrUpdate(notification);
            await unitOfWork.CommitAsync();

            var channel = Channel.CreateUnbounded<NotificationRequest>();
            var service = new NotificationService(unitOfWork, channel);

            var firstClaim = await service.TryClaimEmailDeliveryAsync(notification.Id, TimeSpan.FromMinutes(2), CancellationToken.None);
            firstClaim.Succeeded.Should().BeTrue();

            var tracked = unitOfWork.NotificationRepository.Trackable().First(n => n.Id == notification.Id);
            tracked.SetEmailAsProcessing(DateTime.UtcNow.AddMinutes(-1));
            unitOfWork.NotificationRepository.InsertOrUpdate(tracked);
            await unitOfWork.CommitAsync();

            var candidates = await service.GetEmailDeliveryCandidatesAsync(10, CancellationToken.None);
            candidates.Data.Should().Contain(notification.Id);

            var recoveredClaim = await service.TryClaimEmailDeliveryAsync(notification.Id, TimeSpan.FromMinutes(2), CancellationToken.None);
            recoveredClaim.Succeeded.Should().BeTrue();
        }

        [Fact]
        public async Task TryClaimEmailDeliveryAsync_WhenAlreadyClaimed_ShouldPreventDuplicateClaim()
        {
            PrepareInMemoryDatabase();

            using var scope = serviceProvider.CreateScope();
            var unitOfWork = scope.ServiceProvider.GetRequiredService<Application.Contracts.Persistence.IUnitOfWork>();
            var notification = new Notification(user1, "WelcomeMessage", NotificationType.Information, NotificationCategory.System);
            unitOfWork.NotificationRepository.InsertOrUpdate(notification);
            await unitOfWork.CommitAsync();

            var channel = Channel.CreateUnbounded<NotificationRequest>();
            var service = new NotificationService(unitOfWork, channel);

            var firstClaim = await service.TryClaimEmailDeliveryAsync(notification.Id, TimeSpan.FromMinutes(2), CancellationToken.None);
            var secondClaim = await service.TryClaimEmailDeliveryAsync(notification.Id, TimeSpan.FromMinutes(2), CancellationToken.None);

            firstClaim.Succeeded.Should().BeTrue();
            secondClaim.Failed.Should().BeTrue();
        }

        [Fact]
        public async Task CreateNotificationAsync_WhenUserAlreadyTrackedByContext_ShouldNotThrow()
        {
            // Regression test for: The instance of entity type 'User' cannot be tracked
            // because another instance with the same key value is already being tracked.
            // Fix: CheckBudgetAlertsAsync uses Trackable() so EF Core's identity map returns
            // the same tracked User instance, avoiding the multi-instance conflict.
            PrepareInMemoryDatabase();

            using var scope = serviceProvider.CreateScope();
            var unitOfWork = scope.ServiceProvider.GetRequiredService<IUnitOfWork>();

            // Track a user through a Trackable query (simulates expense loaded with CreatedBy)
            await unitOfWork.ExpenseRepository
                .Trackable()
                .Include(e => e.CreatedBy)
                .FirstAsync(e => e.CreatedBy.Id == user2.Id);

            // Fetch the same user via Trackable (as CheckBudgetAlertsAsync now does).
            // EF Core's identity map returns the already-tracked instance — no conflict.
            var trackedUser = await unitOfWork.UserProjectRepository
                .Trackable()
                .Where(up => up.User.Id == user2.Id)
                .Select(up => up.User)
                .FirstAsync();

            var channel = Channel.CreateUnbounded<NotificationRequest>();
            var service = new NotificationService(unitOfWork, channel);

            var response = await service.CreateNotificationAsync(new NotificationRequestDTO
            {
                User = trackedUser,
                Type = NotificationType.Information,
                Category = NotificationCategory.Finance,
                CodeMessage = "BUDGET_WARNING"
            });

            response.Succeeded.Should().BeTrue();
        }

        [Fact]
        public async Task MarkEmailDeliverySucceededAsync_ShouldPersistSentStatus()
        {
            PrepareInMemoryDatabase();

            using var scope = serviceProvider.CreateScope();
            var unitOfWork = scope.ServiceProvider.GetRequiredService<Application.Contracts.Persistence.IUnitOfWork>();
            var notification = new Notification(user1, "WelcomeMessage", NotificationType.Information, NotificationCategory.System);
            unitOfWork.NotificationRepository.InsertOrUpdate(notification);
            await unitOfWork.CommitAsync();

            var channel = Channel.CreateUnbounded<NotificationRequest>();
            var service = new NotificationService(unitOfWork, channel);

            var claim = await service.TryClaimEmailDeliveryAsync(notification.Id, TimeSpan.FromMinutes(2), CancellationToken.None);
            claim.Succeeded.Should().BeTrue();

            var markAsSent = await service.MarkEmailDeliverySucceededAsync(notification.Id, CancellationToken.None);
            markAsSent.Succeeded.Should().BeTrue();

            var stored = await service.GetAsync(notification.Id, CancellationToken.None);
            stored.Succeeded.Should().BeTrue();
            stored.Data.EmailStatus.Should().Be(NotificationChannelDeliveryStatus.Sent);
            stored.Data.EmailLockedUntil.Should().BeNull();
        }
    }
}
