using System;
using EasyFinance.Domain.AccessControl;

namespace EasyFinance.Application.DTOs.AccessControl
{
    public class UserRequestDTO
    {
        public string FirstName { get; set; } = "Default";
        public string LastName { get; set; } = "Default";
        public NotificationChannels NotificationChannels { get; set; } = NotificationChannels.None;

    }
}
