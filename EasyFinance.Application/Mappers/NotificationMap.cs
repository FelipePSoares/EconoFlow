using System.Collections.Generic;
using System.Linq;
using EasyFinance.Application.DTOs.Account;
using EasyFinance.Domain.Account;

namespace EasyFinance.Application.Mappers
{
    public static class NotificationMap
    {
        public static IQueryable<NotificationResponseDTO> ToDTO(this IQueryable<Notification> notifications)
            => notifications.Select(n => n.ToDTO());

        public static IEnumerable<NotificationResponseDTO> ToDTO(this IEnumerable<Notification> notifications)
            => notifications.Select(n => n.ToDTO());

        public static NotificationResponseDTO ToDTO(this Notification notification)
            => new(notification);

        public static Notification FromDTO(this NotificationRequestDTO dto) 
            => new(
                dto.User,
                dto.CodeMessage,
                dto.Type,
                dto.Category,
                dto.ActionLabelCode,
                dto.LimitNotificationChannels,
                dto.ExpiresAt,
                dto.Metadata,
                dto.IsSticky,
                dto.IsActionRequired);
    }
}
