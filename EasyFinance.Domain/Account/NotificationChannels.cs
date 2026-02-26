using System;

namespace EasyFinance.Domain.Account
{
    [Flags]
    public enum NotificationChannels
    {
        None    = 0,
        Email   = 1 << 0, // 1
        Sms     = 1 << 1, // 2
        Push    = 1 << 2, // 4 (app/native push)
        InApp   = 1 << 3, // 8
        WebPush = 1 << 4  // 16
    }
}
