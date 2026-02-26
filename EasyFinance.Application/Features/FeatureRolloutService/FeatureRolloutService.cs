using System;
using System.Collections.Generic;
using System.Linq;
using EasyFinance.Domain.AccessControl;
using Microsoft.Extensions.Options;

namespace EasyFinance.Application.Features.FeatureRolloutService
{
    public class FeatureRolloutService(IOptions<FeatureRolloutOptions> featureRolloutOptions) : IFeatureRolloutService
    {
        private readonly FeatureRolloutOptions featureRolloutOptions = featureRolloutOptions.Value;

        public FeatureFlags GetEnabledFeatures(IList<string> roles)
        {
            var enabledFeatures = featureRolloutOptions.EnabledForAllUsers;

            if (IsBetaTester(roles))
                enabledFeatures |= featureRolloutOptions.EnabledForBetaTesters;

            return enabledFeatures;
        }

        public bool IsEnabled(IList<string> roles, FeatureFlags feature)
        {
            if (feature == FeatureFlags.None)
                return false;

            return GetEnabledFeatures(roles).HasFlag(feature);
        }

        public bool IsBetaTester(IList<string> roles)
            => roles?.Contains(SystemRoles.BetaTester, StringComparer.OrdinalIgnoreCase) == true;
    }
}
