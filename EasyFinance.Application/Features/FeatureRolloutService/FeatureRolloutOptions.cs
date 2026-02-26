using EasyFinance.Domain.AccessControl;

namespace EasyFinance.Application.Features.FeatureRolloutService
{
    public class FeatureRolloutOptions
    {
        public const string SectionName = "FeatureRollout";

        public FeatureFlags EnabledForAllUsers { get; set; } = FeatureFlags.None;
        public FeatureFlags EnabledForBetaTesters { get; set; } = FeatureFlags.None;
    }
}
