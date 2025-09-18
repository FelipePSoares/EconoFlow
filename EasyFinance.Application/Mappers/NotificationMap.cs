using System.Collections.Generic;
using System.Linq;
using EasyFinance.Application.DTOs.Account;
using EasyFinance.Domain.Account;

namespace EasyFinance.Application.Mappers
{
    public static class NotificationMap
    {
        public static IQueryable<NotificationResponseDTO> ToDTO(this IQueryable<Notification> notifications)
            => notifications.Select(n => new NotificationResponseDTO(n));

        public static IEnumerable<NotificationResponseDTO> ToDTO(this IEnumerable<Notification> notifications)
            => notifications.Select(n => new NotificationResponseDTO(n));
    }
}
