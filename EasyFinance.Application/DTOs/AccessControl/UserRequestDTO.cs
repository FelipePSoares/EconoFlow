using System;
using EasyFinance.Domain.Account;

namespace EasyFinance.Application.DTOs.AccessControl
{
    public class UserRequestDTO
    {
        public string FirstName { get; set; } = "Default";
        public string LastName { get; set; } = "Default";
        public string LanguageCode { get; set; } = "en";
        public NotificationChannels NotificationChannels { get; set; } = NotificationChannels.None;

    }
}
