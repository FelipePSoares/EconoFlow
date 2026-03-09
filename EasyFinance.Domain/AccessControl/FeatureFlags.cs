using System;

namespace EasyFinance.Domain.AccessControl
{
    [Flags]
    public enum FeatureFlags
    {
        None = 0,
        WebPush = 1 << 0,
        PwaInstall = 1 << 1
    }
}
