using System.Collections.Generic;
using EasyFinance.Domain.AccessControl;

namespace EasyFinance.Application.Features.FeatureRolloutService
{
    public interface IFeatureRolloutService
    {
        FeatureFlags GetEnabledFeatures(IList<string> roles);
        bool IsEnabled(IList<string> roles, FeatureFlags feature);
        bool IsBetaTester(IList<string> roles);
    }
}
