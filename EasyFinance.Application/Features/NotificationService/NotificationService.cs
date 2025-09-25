using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using EasyFinance.Application.Contracts.Persistence;
using EasyFinance.Application.DTOs.Account;
using EasyFinance.Application.Mappers;
using EasyFinance.Domain.Account;
using EasyFinance.Infrastructure;
using EasyFinance.Infrastructure.DTOs;
using Microsoft.EntityFrameworkCore;

namespace EasyFinance.Application.Features.NotificationService
{
    public class NotificationService(IUnitOfWork unitOfWork) : INotificationService
    {
        private readonly IUnitOfWork unitOfWork = unitOfWork;

        public async Task<AppResponse<NotificationResponseDTO>> CreateNotificationAsync(NotificationRequestDTO notification)
        {
            var dto = notification.FromDTO();

            var savedNotification = unitOfWork.NotificationRepository.InsertOrUpdate(dto);

            if (savedNotification.Failed)
                return AppResponse<NotificationResponseDTO>.Error(savedNotification.Messages);

            await unitOfWork.CommitAsync();

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

            if (notification.IsActionRequired)
                return AppResponse.Error(ValidationMessages.NotificationActionRequired);

            if (notification == null)
                return AppResponse.Error(ValidationMessages.NotificationNotFound);

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
    }
}
