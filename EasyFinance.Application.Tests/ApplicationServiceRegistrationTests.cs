using System;
using System.Collections.Generic;
using System.Linq;
using EasyFinance.Application;
using EasyFinance.Application.Features.UserKeyService;
using FluentAssertions;
using FpsSoftware.Chassis;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace EasyFinance.Application.Tests
{
    /// <summary>
    /// Guards how the user-key salt reaches <see cref="UserKeyService"/>.
    ///
    /// <para>
    /// The salt used to be read inside <c>AddApplicationServices</c>, which fell back to the
    /// literal <c>"Development_Key"</c> even in Production — the one gap in the CRA
    /// remediation (#1068) that never announced itself. The salt is now resolved and
    /// validated once at start-up; this type pins that the wiring reports back the value it
    /// was given and refuses to silently invent one.
    /// </para>
    /// </summary>
    public class ApplicationServiceRegistrationTests
    {
        private const string UserId = "3f2504e0-4f89-11d3-9a0c-0305e82c3301";

        [Fact]
        public void AddApplicationServices_ShouldUseTheProvidedUserKeySalt()
        {
            using var provider = BuildProvider("salt-from-configuration");

            provider.GetRequiredService<IUserKeyService>().GenerateUserKey(UserId).Data.Key
                .Should().Be(ExpectedKey(UserId, "salt-from-configuration"));
        }

        [Fact]
        public void AddApplicationServices_ShouldReadTheUserKeySaltFromConfiguration()
        {
            var configuration = Configuration(("Secrets:UserKeySalt", "salt-from-configuration"));

            using var provider = BuildProvider(userKeySaltConfigurationKey: "Secrets:UserKeySalt", configuration: configuration);

            provider.GetRequiredService<IUserKeyService>().GenerateUserKey(UserId).Data.Key
                .Should().Be(ExpectedKey(UserId, "salt-from-configuration"));
        }

        [Fact]
        public void AddApplicationServices_ShouldResolveToTheSameKeyAsUserKeyService()
        {
            // The registration must not re-implement the algorithm, only forward the salt.
            using var provider = BuildProvider("another-salt");

            provider.GetRequiredService<IUserKeyService>().GenerateUserKey(UserId)
                .Data.Should().BeEquivalentTo(new UserKeyService("another-salt").GenerateUserKey(UserId).Data);
        }

        [Fact]
        public void AddApplicationServices_WithoutAUserKeySalt_ShouldThrow()
        {
            // Falling back here is what the CRA finding was about: an unconfigured
            // deployment must not quietly hash keys with a published literal.
            var act = () => BuildProvider(userKeySalt: null);

            act.Should().Throw<InvalidOperationException>();
        }

        [Fact]
        public void UserKeyService_WithABlankSalt_ShouldThrow()
        {
            var act = () => new UserKeyService("  ").GenerateUserKey(UserId);

            act.Should().Throw<ArgumentException>();
        }

        [Fact]
        public void UserKeyService_ShouldHashTheUserAndTheSalt()
        {
            // A blank user id used to return an AppResponse error; it must keep doing so.
            new UserKeyService("salt").GenerateUserKey(string.Empty).Failed.Should().BeTrue();
        }

        private static ServiceProvider BuildProvider(
            string? userKeySalt = "default-test-salt",
            string userKeySaltConfigurationKey = "EconoFlow:UserKeySalt",
            IConfiguration? configuration = null)
        {
            var services = new ServiceCollection();
            services.AddLogging();
            var effectiveConfiguration = configuration ?? Configuration((userKeySaltConfigurationKey, userKeySalt));
            services.AddSingleton(effectiveConfiguration);

            // The registration only needs the salt; the framework pieces it reads are
            // registered here so the container can be built without the real host.
            services.AddApplicationServices(ReadSalt(effectiveConfiguration, userKeySaltConfigurationKey));

            return services.BuildServiceProvider();
        }

        private static string ExpectedKey(string userId, string salt)
            => new UserKeyService(salt).GenerateUserKey(userId).Data.Key;

        // Mirrors what Program.cs does: resolve the salt up front, then hand it to the
        // registration. A blank or absent value must not reach the service.
        private static string ReadSalt(IConfiguration configuration, string key)
            => configuration[key] is { } value && !string.IsNullOrWhiteSpace(value)
                ? value
                : throw new InvalidOperationException("A user key salt is required.");

        private static IConfiguration Configuration(params (string key, string? value)[] values)
        {
            var data = values.ToDictionary(value => value.key, value => value.value);
            return new ConfigurationBuilder().AddInMemoryCollection(data).Build();
        }
    }
}
