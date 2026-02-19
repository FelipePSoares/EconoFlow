using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Channels;
using System.Threading.Tasks;
using EasyFinance.Application.Contracts.Persistence;
using EasyFinance.Application.DTOs.Account;
using EasyFinance.Application.DTOs.BackgroundService.Notification;
using EasyFinance.Application.Mappers;
using EasyFinance.Domain.Account;
using EasyFinance.Infrastructure;
using EasyFinance.Infrastructure.DTOs;
using Microsoft.EntityFrameworkCore;

namespace EasyFinance.Application.Features.NotificationService
{
    public class NotificationService(IUnitOfWork unitOfWork, Channel<NotificationRequest> channel) : INotificationService
    {
        private readonly IUnitOfWork unitOfWork = unitOfWork;
        private readonly Channel<NotificationRequest> channel = channel;

        public async Task<AppResponse<NotificationResponseDTO>> CreateNotificationAsync(NotificationRequestDTO notification)
        {
            var dto = notification.FromDTO();

            var savedNotification = unitOfWork.NotificationRepository.InsertOrUpdate(dto);

            if (savedNotification.Failed)
                return AppResponse<NotificationResponseDTO>.Error(savedNotification.Messages);

            await unitOfWork.CommitAsync();
            await channel.Writer.WriteAsync(new NotificationRequest()
            {
                NotificationId = dto.Id
            });

            return AppResponse<NotificationResponseDTO>.Success(dto.ToDTO());
        }

        public async Task<AppResponse<ICollection<NotificationResponseDTO>>> GetAllAsync(Guid userId)
        {
            var notifications = await this.unitOfWork.NotificationRepository
                .NoTrackable()
                .IgnoreQueryFilters()
                .Include(n => n.User)
                .Where(n => n.User.Id == userId)
                .ToDTO()
                .ToListAsync();

            return AppResponse<ICollection<NotificationResponseDTO>>.Success(notifications);
        }

        public async Task<AppResponse<ICollection<NotificationResponseDTO>>> GetUnreadAsync(Guid userId, NotificationCategory notificationCategory = NotificationCategory.None)
        {
            var notifications = await this.unitOfWork.NotificationRepository
                .NoTrackable()
                .Where(n => 
                    n.User.Id == userId && 
                    (notificationCategory == NotificationCategory.None || n.Category == notificationCategory))
                .ToDTO()
                .ToListAsync();

            return AppResponse<ICollection<NotificationResponseDTO>>.Success(notifications);
        }

        public async Task<AppResponse> MarkAllAsReadAsync(Guid userId)
        {
            var notifications = await this.unitOfWork.NotificationRepository
                .Trackable()
                .Include(n => n.User)
                .Where(n => n.User.Id == userId && !n.IsActionRequired)
                .ToListAsync();

            return await MarkAllAsReadAsync(notifications);
        }

        public async Task<AppResponse> MarkAsReadAsync(Guid userId, Guid notificationId)
        {
            var notification = await this.unitOfWork.NotificationRepository
                .Trackable()
                .Include(n => n.User)
                .FirstOrDefaultAsync(n => n.User.Id == userId && n.Id == notificationId);

            if (notification == null)
                return AppResponse.Error(ValidationMessages.NotificationNotFound);

            if (notification.IsActionRequired)
                return AppResponse.Error(ValidationMessages.NotificationActionRequired);

            notification.MarkAsRead();

            var savedNotification = unitOfWork.NotificationRepository.InsertOrUpdate(notification);
            if (savedNotification.Failed)
                return AppResponse.Error(savedNotification.Messages);

            await unitOfWork.CommitAsync();

            return AppResponse.Success();
        }

        public async Task<AppResponse> ActionMadeAsync(Guid userId, NotificationType type)
        {
            var notifications = await this.unitOfWork.NotificationRepository
                .Trackable()
                .Include(n => n.User)
                .Where(n => n.User.Id == userId && n.Type == type && n.IsActionRequired)
                .ToListAsync();

            return await MarkAllAsReadAsync(notifications);
        }

        private async Task<AppResponse> MarkAllAsReadAsync(List<Notification> notifications)
        {
            notifications.ForEach(n => n.MarkAsRead());

            var failToSave = notifications.Select(n =>
            {
                var savedNotification = unitOfWork.NotificationRepository.InsertOrUpdate(n);
                if (savedNotification.Failed)
                    return AppResponse.Error(savedNotification.Messages);

                return AppResponse.Success();
            }).Where(n => n.Failed).ToList();

            if (failToSave.Any())
                return AppResponse.Error(failToSave.SelectMany(n => n.Messages));

            await unitOfWork.CommitAsync();

            return AppResponse.Success();
        }

        public async Task<AppResponse<Notification>> GetAsync(Guid notificationId, CancellationToken stoppingToken)
        {
            var notification = await this.unitOfWork.NotificationRepository
                .NoTrackable()
                .IgnoreQueryFilters()
                .Include(n => n.User)
                .FirstOrDefaultAsync(n => n.Id == notificationId, stoppingToken);

            if (notification == null)
                return AppResponse<Notification>.Error(ValidationMessages.NotificationNotFound);

            return AppResponse<Notification>.Success(notification);
        }

        public async Task<AppResponse<Notification>> TryClaimEmailDeliveryAsync(Guid notificationId, TimeSpan leaseDuration, CancellationToken stoppingToken)
        {
            var utcNow = DateTime.UtcNow;
            var lockUntil = utcNow.Add(leaseDuration);
            int affectedRows;
            try
            {
                affectedRows = await this.unitOfWork.NotificationRepository
                    .Trackable()
                    .IgnoreQueryFilters()
                    .Where(n => n.Id == notificationId)
                    .Where(n =>
                        n.EmailStatus == NotificationChannelDeliveryStatus.Pending
                        || (n.EmailStatus == NotificationChannelDeliveryStatus.Processing
                            && (!n.EmailLockedUntil.HasValue || n.EmailLockedUntil.Value <= utcNow)))
                    .ExecuteUpdateAsync(setters => setters
                        .SetProperty(n => n.EmailStatus, NotificationChannelDeliveryStatus.Processing)
                        .SetProperty(n => n.EmailLockedUntil, lockUntil), stoppingToken);
            }
            catch (InvalidOperationException)
            {
                var notificationToClaim = await this.unitOfWork.NotificationRepository
                    .Trackable()
                    .IgnoreQueryFilters()
                    .Include(n => n.User)
                    .FirstOrDefaultAsync(n => n.Id == notificationId, stoppingToken);

                if (notificationToClaim == null)
                    return AppResponse<Notification>.Error(ValidationMessages.NotificationNotFound);

                var canClaim = notificationToClaim.EmailStatus == NotificationChannelDeliveryStatus.Pending
                    || (notificationToClaim.EmailStatus == NotificationChannelDeliveryStatus.Processing
                        && (!notificationToClaim.EmailLockedUntil.HasValue || notificationToClaim.EmailLockedUntil.Value <= utcNow));

                if (!canClaim)
                    return AppResponse<Notification>.Error("Notification email is not available for claim.");

                notificationToClaim.SetEmailAsProcessing(lockUntil);

                var saveClaim = unitOfWork.NotificationRepository.InsertOrUpdate(notificationToClaim);
                if (saveClaim.Failed)
                    return AppResponse<Notification>.Error(saveClaim.Messages);

                await unitOfWork.CommitAsync();
                affectedRows = 1;
            }

            if (affectedRows == 0)
                return AppResponse<Notification>.Error("Notification email is not available for claim.");

            var notification = await this.unitOfWork.NotificationRepository
                .NoTrackable()
                .IgnoreQueryFilters()
                .Include(n => n.User)
                .FirstOrDefaultAsync(n => n.Id == notificationId, stoppingToken);

            if (notification == null)
                return AppResponse<Notification>.Error(ValidationMessages.NotificationNotFound);

            return AppResponse<Notification>.Success(notification);
        }

        public async Task<AppResponse<ICollection<Guid>>> GetEmailDeliveryCandidatesAsync(int batchSize, CancellationToken stoppingToken)
        {
            var utcNow = DateTime.UtcNow;

            var notificationIds = await this.unitOfWork.NotificationRepository
                .NoTrackable()
                .IgnoreQueryFilters()
                .Where(n =>
                    n.EmailStatus == NotificationChannelDeliveryStatus.Pending
                    || (n.EmailStatus == NotificationChannelDeliveryStatus.Processing
                        && (!n.EmailLockedUntil.HasValue || n.EmailLockedUntil.Value <= utcNow)))
                .OrderBy(n => n.CreatedDate)
                .Take(batchSize)
                .Select(n => n.Id)
                .ToListAsync(stoppingToken);

            return AppResponse<ICollection<Guid>>.Success(notificationIds);
        }

        public Task<AppResponse> MarkEmailDeliverySucceededAsync(Guid notificationId, CancellationToken stoppingToken)
            => UpdateEmailDeliveryStatusAsync(notificationId, n => n.MarkEmailAsSent(), stoppingToken);

        public Task<AppResponse> MarkEmailDeliveryAsPendingAsync(Guid notificationId, CancellationToken stoppingToken)
            => UpdateEmailDeliveryStatusAsync(notificationId, n => n.MarkEmailAsPending(), stoppingToken);

        public Task<AppResponse> MarkEmailDeliveryAsFailedAsync(Guid notificationId, CancellationToken stoppingToken)
            => UpdateEmailDeliveryStatusAsync(notificationId, n => n.MarkEmailAsFailed(), stoppingToken);

        private async Task<AppResponse> UpdateEmailDeliveryStatusAsync(Guid notificationId, Action<Notification> updateStatus, CancellationToken stoppingToken)
        {
            var notification = await this.unitOfWork.NotificationRepository
                .Trackable()
                .IgnoreQueryFilters()
                .FirstOrDefaultAsync(n => n.Id == notificationId, stoppingToken);

            if (notification == null)
                return AppResponse.Error(ValidationMessages.NotificationNotFound);

            updateStatus(notification);

            var savedNotification = unitOfWork.NotificationRepository.InsertOrUpdate(notification);
            if (savedNotification.Failed)
                return AppResponse.Error(savedNotification.Messages);

            await unitOfWork.CommitAsync();

            return AppResponse.Success();
        }
    }
}
