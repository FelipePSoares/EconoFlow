using System;

namespace EasyFinance.Domain.AccessControl
{
    [Flags]
    public enum NotificationChannels
    {
        None    = 0,
        Email   = 1 << 0, // 1
        Sms     = 1 << 1, // 2
        Push    = 1 << 2, // 4
    }
}
