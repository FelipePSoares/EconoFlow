using EasyFinance.Application.Features.FeatureRolloutService;
using EasyFinance.Domain.AccessControl;
using FluentAssertions;
using Microsoft.Extensions.Options;

namespace EasyFinance.Application.Tests
{
    public class FeatureRolloutServiceTests
    {
        [Fact]
        public void GetEnabledFeatures_StandardUser_ShouldReturnOnlyGlobalFeatures()
        {
            var service = CreateService(
                enabledForAllUsers: FeatureFlags.WebPush,
                enabledForBetaTesters: FeatureFlags.None);

            var enabledFeatures = service.GetEnabledFeatures([]);

            enabledFeatures.Should().Be(FeatureFlags.WebPush);
        }

        [Fact]
        public void GetEnabledFeatures_BetaTester_ShouldIncludeBetaFeatures()
        {
            var service = CreateService(
                enabledForAllUsers: FeatureFlags.None,
                enabledForBetaTesters: FeatureFlags.WebPush);

            var enabledFeatures = service.GetEnabledFeatures([SystemRoles.BetaTester]);

            enabledFeatures.Should().Be(FeatureFlags.WebPush);
        }

        [Fact]
        public void IsEnabled_FeatureNotInRollout_ShouldReturnFalse()
        {
            var service = CreateService(
                enabledForAllUsers: FeatureFlags.None,
                enabledForBetaTesters: FeatureFlags.None);

            var enabled = service.IsEnabled([SystemRoles.BetaTester], FeatureFlags.WebPush);

            enabled.Should().BeFalse();
        }

        private static IFeatureRolloutService CreateService(FeatureFlags enabledForAllUsers, FeatureFlags enabledForBetaTesters)
            => new FeatureRolloutService(Options.Create(new FeatureRolloutOptions
            {
                EnabledForAllUsers = enabledForAllUsers,
                EnabledForBetaTesters = enabledForBetaTesters
            }));
    }
}
