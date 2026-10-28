using System;
using System.Collections.Generic;
using System.Linq;
using EasyFinance.Server.Config;
using FluentAssertions;
using FpsSoftware.Chassis;
using Microsoft.Extensions.Configuration;

namespace EasyFinance.Server.Tests.Config
{
    /// <summary>
    /// Guards the start-up validation of the environment-supplied secrets (CRA Annex I,
    /// Part I, point 2(1) — secure-by-default configuration).
    ///
    /// <para>
    /// Each of these secrets used to fail in a different, weaker way: the account-delete
    /// signing key threw per request, the user-key salt silently fell back to a literal
    /// even in Production, and the JWT key fell back to an empty configuration value that
    /// production authentication could not use. A misconfigured server therefore started
    /// and either served a degraded posture or fell over in front of a user. These checks
    /// pin the replacement contract: validated once, up front, with usable defaults in
    /// Development and none anywhere else.
    /// </para>
    ///
    /// <para>
    /// The message assertions deliberately check that a failure names the variable and
    /// never echoes the value: start-up failures are written to logs and, on some
    /// platforms, to crash reports.
    /// </para>
    /// </summary>
    public class RequiredSecretsTests
    {
        private const string ValidKey = "valid-secret-value-with-at-least-32-chars";

        [Fact]
        public void All_ShouldCoverEverySecretTheIssueNames()
        {
            // A secret that is dropped from the list is silently unvalidated again, which is
            // exactly the regression this type exists to prevent.
            RequiredSecrets.All.Select(secret => secret.Name).Should().BeEquivalentTo(
            [
                "EconoFlow_TOKEN_SECRET_KEY",
                "EconoFlow_SECRET_KEY_FOR_DELETE_TOKEN",
                "EconoFlow_USER_KEY_SALT",
                "EconoFlow_UNSUBSCRIBE_HMAC_SECRET"
            ]);
        }

        [Theory]
        [InlineData("EconoFlow_TOKEN_SECRET_KEY")]
        [InlineData("EconoFlow_SECRET_KEY_FOR_DELETE_TOKEN")]
        [InlineData("EconoFlow_USER_KEY_SALT")]
        [InlineData("EconoFlow_UNSUBSCRIBE_HMAC_SECRET")]
        public void Lookup_ShouldReturnTheSecretForItsEnvironmentVariable(string name)
        {
            RequiredSecrets.Find(name).Should().NotBeNull();
            RequiredSecrets.Find(name)!.Name.Should().Be(name);
        }

        [Theory]
        [InlineData(null)]
        [InlineData("")]
        [InlineData("NOT_A_SECRET")]
        public void Find_WithAnUnknownName_ShouldReturnNull(string? name)
        {
            RequiredSecrets.Find(name).Should().BeNull();
        }

        [Fact]
        public void EachSecret_ShouldHaveAUsableDefaultOrKeepItsExistingBehaviour()
        {
            // A Development run must start on nothing but its defaults. A secret without one
            // (the JWT key, resolved by AuthenticationMiddleware, and the unsubscribe key,
            // resolved by UserService under #if DEBUG) keeps the fallback it already had, so
            // it is allowed to have none — it must simply never invent a bad one.
            foreach (var secret in RequiredSecrets.All)
            {
                if (secret.DevelopmentDefault is null)
                {
                    secret.Resolve(isDevelopment: true, _ => null).Should().BeNull(
                        $"{secret.Name} has no development default, so nothing may be made up for it");
                    continue;
                }

                RequiredSecrets.IsAcceptable(secret.DevelopmentDefault).Should().BeTrue(
                    $"{secret.Name} must be usable in Development");
            }
        }

        [Fact]
        public void UserKeySalt_ShouldKeepItsHistoricalValueAsAPrefix()
        {
            // The salt is hashed into every client-side encryption key, which only encrypts
            // non-sensitive UI state. Keeping the historical "Development_Key" as the prefix
            // keeps local data recognisable while the value clears the minimum length.
            RequiredSecrets.Find("EconoFlow_USER_KEY_SALT")!.DevelopmentDefault.Should().StartWith("Development_Key");
        }

        [Fact]
        public void JwtKey_ShouldHaveNoDevelopmentDefault()
        {
            // AuthenticationMiddleware already pins its own development key. Honouring a
            // second one in Program.cs would override that choice with a value the issuer
            // does not use, so the JWT key has no fallback at all: it is optional in
            // Development and required (and length-checked) outside it.
            var secret = RequiredSecrets.Find("EconoFlow_TOKEN_SECRET_KEY")!;

            secret.DevelopmentDefault.Should().BeNull();
            secret.Resolve(isDevelopment: true, _ => null).Should().BeNull();
        }

        [Theory]
        [InlineData(null)]
        [InlineData("")]
        [InlineData("   ")]
        [InlineData("short")]
        public void IsAcceptable_ShouldRejectMissingBlankOrShortValues(string? value)
        {
            RequiredSecrets.IsAcceptable(value).Should().BeFalse();
        }

        [Fact]
        public void IsAcceptable_ShouldRejectOneCharacterFewerThanTheMinimum()
        {
            // Pins the boundary itself, without hand-counted literals: 31 is not enough, 32 is.
            var justShort = new string('a', RequiredSecrets.MinimumLength - 1);

            RequiredSecrets.IsAcceptable(justShort).Should().BeFalse();
            RequiredSecrets.IsAcceptable(justShort + "a").Should().BeTrue();
        }

        [Fact]
        public void IsAcceptable_ShouldAcceptAValueOfExactlyTheMinimumLength()
        {
            var value = new string('a', RequiredSecrets.MinimumLength);

            RequiredSecrets.IsAcceptable(value).Should().BeTrue();
        }

        [Fact]
        public void DescribeFailure_ShouldNameTheVariableButNeverItsValue()
        {
            // Logs and crash reports are not the place for a secret. Only the variable and
            // its length are reported.
            var message = RequiredSecrets.Find("EconoFlow_USER_KEY_SALT")!.DescribeFailure("short", _ => "short");

            message.Should().Contain("EconoFlow_USER_KEY_SALT");
            message.Should().Contain(RequiredSecrets.MinimumLength.ToString());
            message.Should().Contain("must be at least");
            message.Should().NotContain("short");
        }

        [Fact]
        public void Validate_ShouldSayTooShortRatherThanMissing()
        {
            // Regression: the resolved value for a rejected secret is null, so reporting
            // from it alone told an operator the variable "was not set" even when they had
            // set it and merely got it wrong.
            var values = Resolved(ValidKey);
            values["EconoFlow_USER_KEY_SALT"] = null;

            var failure = RequiredSecrets.Validate(values, _ => "eleven-chr").Should().ContainSingle().Subject;

            failure.Should().Contain("EconoFlow_USER_KEY_SALT");
            failure.Should().Contain("must be at least");
            failure.Should().NotContain("was not set");
        }

        [Fact]
        public void Validate_WithoutTheSource_ShouldStillReportAVariableAsMissing()
        {
            var values = Resolved(ValidKey);
            values["EconoFlow_USER_KEY_SALT"] = null;

            RequiredSecrets.Validate(values)
                .Should().ContainSingle()
                .Which.Should().Contain("was not set");
        }

        [Theory]
        [InlineData("EconoFlow_TOKEN_SECRET_KEY")]
        [InlineData("EconoFlow_SECRET_KEY_FOR_DELETE_TOKEN")]
        [InlineData("EconoFlow_USER_KEY_SALT")]
        [InlineData("EconoFlow_UNSUBSCRIBE_HMAC_SECRET")]
        public void Resolve_ShouldPreferTheVariableOverTheConfigurationValue(string name)
        {
            var configuration = Configuration((name, "config-value-that-is-long-enough-to-pass"));

            RequiredSecrets.Find(name)!.Resolve(isDevelopment: false, name => ValidKey, configuration)
                .Should().Be(ValidKey);
        }

        [Theory]
        [InlineData("")]
        [InlineData("   ")]
        public void Resolve_WithABlankVariable_ShouldTreatItAsMissing(string variableValue)
        {
            var named = new RequiredSecret(name: "EconoFlow_USER_KEY_SALT");

            named.Resolve(isDevelopment: false, _ => variableValue).Should().BeNull();
        }

        [Fact]
        public void Resolve_InDevelopment_ShouldFallBackToTheDevelopmentDefault()
        {
            RequiredSecrets.Find("EconoFlow_SECRET_KEY_FOR_DELETE_TOKEN")!
                .Resolve(isDevelopment: true, _ => null)
                .Should().Be(RequiredSecrets.DevelopmentDeleteTokenSecret);
        }

        [Fact]
        public void Resolve_InDevelopment_ShouldStillRejectAShortValue()
        {
            // A declared-but-short variable is a mistake: development must fall back to its
            // own default rather than use it, and production must refuse it outright.
            var secret = RequiredSecrets.Find("EconoFlow_SECRET_KEY_FOR_DELETE_TOKEN")!;

            secret.Resolve(isDevelopment: true, _ => "short").Should().Be(RequiredSecrets.DevelopmentDeleteTokenSecret);
            secret.Resolve(isDevelopment: false, _ => "short").Should().BeNull();
        }

        [Fact]
        public void Resolve_OutsideDevelopment_ShouldNotFallBackToTheDevelopmentDefault()
        {
            RequiredSecrets.Find("EconoFlow_SECRET_KEY_FOR_DELETE_TOKEN")!
                .Resolve(isDevelopment: false, _ => null)
                .Should().BeNull();
        }

        [Fact]
        public void Resolve_WhenTheConfigurationNamesAReplacementVariable_ShouldReadThatOne()
        {
            // Production deploys configuration to an ASP.NET configuration key rather than
            // to the environment, and the secret must still be able to come from there.
            var configuration = Configuration(("TokenSettings:SecretKey", ValidKey));

            RequiredSecrets.Find("EconoFlow_TOKEN_SECRET_KEY")!
                .Resolve(isDevelopment: false, name => name == "TokenSettings:SecretKey" ? ValidKey : null, configuration)
                .Should().Be(ValidKey);
        }

        [Fact]
        public void Validate_WithACompleteResolution_ShouldReportNothing()
        {
            RequiredSecrets.Validate(Resolved(ValidKey)).Should().BeEmpty();
        }

        [Fact]
        public void Validate_ShouldReportEveryMissingSecretAtOnce()
        {
            // One start-up per missing variable would be an afternoon of redeploys.
            var values = RequiredSecrets.All.ToDictionary(secret => secret.Name, secret => (string?)null);

            RequiredSecrets.Validate(values).Should().HaveCount(RequiredSecrets.All.Count);
        }

        [Theory]
        [InlineData("short")]
        [InlineData("")]
        public void Validate_WithAnUnusableValue_ShouldReportTheVariable(string value)
        {
            var values = Resolved(ValidKey);
            values["EconoFlow_USER_KEY_SALT"] = value;

            RequiredSecrets.Validate(values)
                .Should().ContainSingle()
                .Which.Should().Contain("EconoFlow_USER_KEY_SALT");
        }

        [Theory]
        [InlineData("EconoFlow_TOKEN_SECRET_KEY")]
        [InlineData("EconoFlow_SECRET_KEY_FOR_DELETE_TOKEN")]
        [InlineData("EconoFlow_USER_KEY_SALT")]
        [InlineData("EconoFlow_UNSUBSCRIBE_HMAC_SECRET")]
        public void ApplyEnvironment_ShouldPublishTheResolvedValue(string name)
        {
            var published = new Dictionary<string, string?>();
            var values = Resolved(ValidKey);

            RequiredSecrets.ApplyEnvironment(values, (variable, value) => published[variable] = value);

            published[name].Should().Be(ValidKey);
        }

        [Fact]
        public void ApplyEnvironment_WithAnEmptyResolution_ShouldWriteNothing()
        {
            // Writing an empty value would be worse than leaving the variable alone: it
            // would replace a working environment value with nothing.
            var values = RequiredSecrets.All.ToDictionary(secret => secret.Name, secret => (string?)null);
            var published = new Dictionary<string, string?>();

            RequiredSecrets.ApplyEnvironment(values, (variable, value) => published[variable] = value);

            published.Should().BeEmpty();
        }

        [Fact]
        public void MissingNames_ShouldListOnlyTheSecretsThatCouldNotBeResolved()
        {
            var values = Resolved(ValidKey);
            values["EconoFlow_USER_KEY_SALT"] = null;

            RequiredSecrets.MissingNames(values).Should().BeEquivalentTo(["EconoFlow_USER_KEY_SALT"]);
        }

        private static Dictionary<string, string?> Resolved(string value)
            => RequiredSecrets.All.ToDictionary(secret => secret.Name, _ => (string?)value);

        private static IConfiguration Configuration(params (string key, string value)[] values)
        {
            var data = values.ToDictionary(value => value.key, value => (string?)value.value);
            return new ConfigurationBuilder().AddInMemoryCollection(data).Build();
        }
    }
}
