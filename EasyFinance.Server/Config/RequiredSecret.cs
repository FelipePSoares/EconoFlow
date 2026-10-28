using System;
using System.Collections.Generic;
using System.Linq;
using Microsoft.Extensions.Configuration;

namespace EasyFinance.Server.Config
{
    /// <summary>
    /// One environment-supplied secret that the application must be able to trust before it
    /// serves a request.
    /// </summary>
    public sealed class RequiredSecret(string name)
    {
        /// <summary>The environment variable that normally supplies the secret.</summary>
        public string Name { get; } = name;

        /// <summary>
        /// The configuration key consulted when the environment variable is absent, used by
        /// deployments that configure the secret through ASP.NET configuration instead.
        /// </summary>
        public string? ConfigurationKey { get; init; }

        /// <summary>
        /// The value a Development run uses when the secret is absent. Never used outside
        /// Development. A secret may legitimately have none — for those, Development keeps
        /// its existing behaviour, which this property does not change.
        /// </summary>
        public string? DevelopmentDefault { get; init; }

        /// <summary>
        /// Resolves the secret for the current run, or returns <c>null</c> when it cannot be
        /// trusted.
        ///
        /// <para>
        /// A value that is present but too short is never passed through: in Development it
        /// falls back to the development default and, outside it, fails the start-up. Accepting
        /// it would let a mistake hide until Production. A missing value, by contrast, is what
        /// an ordinary Development run looks like, so it simply falls back.
        /// </para>
        /// </summary>
        public string? Resolve(bool isDevelopment, Func<string, string?> environmentReader, IConfiguration? configuration = null)
        {
            ArgumentNullException.ThrowIfNull(environmentReader);

            var value = ReadSuppliedValue(environmentReader, configuration);

            if (RequiredSecrets.IsAcceptable(value))
                return value;

            // Development keeps its built-in default; a secret without one is left to
            // whatever fallback its consumer already had.
            return isDevelopment ? DevelopmentDefault : null;
        }

        /// <summary>
        /// Reports why the secret cannot be used, based on what the deployment actually
        /// supplied. <paramref name="resolvedValue"/> is the resolution (which is <c>null</c>
        /// for a rejected value), so it is only consulted to confirm a usable secret; the
        /// message distinguishes "not set" from "too short" by reading the source again,
        /// because an operator needs to know which mistake they made.
        /// Never includes the value itself — start-up failures are logged.
        /// </summary>
        public string DescribeFailure(
            string? resolvedValue,
            Func<string, string?>? environmentReader = null,
            IConfiguration? configuration = null)
        {
            if (RequiredSecrets.IsAcceptable(resolvedValue))
                return string.Empty;

            var supplied = environmentReader is null ? null : ReadSuppliedValue(environmentReader, configuration);

            return string.IsNullOrWhiteSpace(supplied)
                ? $"{Name} is required but was not set or was empty."
                : $"{Name} must be at least {RequiredSecrets.MinimumLength} characters long but was {supplied.Length}.";
        }

        private string? ReadSuppliedValue(Func<string, string?> environmentReader, IConfiguration? configuration)
        {
            var value = environmentReader(Name);
            if (string.IsNullOrWhiteSpace(value) && ConfigurationKey is not null)
                value = configuration?[ConfigurationKey];

            return value;
        }
    }

    /// <summary>
    /// The secrets the application validates once at start-up (CRA Annex I, Part I, point
    /// 2(1) — products are delivered with a secure-by-default configuration).
    ///
    /// <para>
    /// Before this type, each secret failed differently and all of them too late: the
    /// account-delete key threw per request, the user-key salt silently used a published
    /// literal even in Production, the unsubscribe key threw on first use, and the JWT key
    /// fell back to an empty configuration value the token service cannot sign with. The
    /// rule now is uniform — resolved and validated before the host is built, with usable
    /// defaults in Development and none anywhere else.
    /// </para>
    /// </summary>
    public static class RequiredSecrets
    {
        /// <summary>
        /// Shortest acceptable value. Matches the 32-character placeholder CI and the
        /// development stack already use, and comfortably clears the 128-bit minimum
        /// HS256 requires.
        /// </summary>
        public const int MinimumLength = 32;

        /// <summary>Environment variable holding the salt hashed into every user encryption key.</summary>
        public const string UserKeySaltName = "EconoFlow_USER_KEY_SALT";

        /// <summary>Environment variable holding the key that signs account-deletion tokens.</summary>
        public const string DeleteTokenSecretName = "EconoFlow_SECRET_KEY_FOR_DELETE_TOKEN";

        private const string TokenSecretName = "EconoFlow_TOKEN_SECRET_KEY";
        private const string UnsubscribeSecretName = "EconoFlow_UNSUBSCRIBE_HMAC_SECRET";

        /// <summary>
        /// Development fallbacks. They are literal and committed on purpose: a local run must
        /// start on nothing but its defaults, and a value that is not secret cannot be leaked.
        /// Both keep the historical "Development_" prefix so a local database stays
        /// recognisable, and both now clear <see cref="MinimumLength"/>.
        /// </summary>
        public const string DevelopmentDeleteTokenSecret = "Development_Secret_Key_For_Delete_Token_Change_It";

        public const string DevelopmentUserKeySalt = "Development_Key_For_User_Encryption_Change_It";

        private static readonly IReadOnlyList<RequiredSecret> Secrets =
        [
            // No development default: AuthenticationMiddleware already pins its own key in
            // Development, and overriding it here would give the process a signing key the
            // authentication setup does not use.
            new(TokenSecretName)
            {
                ConfigurationKey = "TokenSettings:SecretKey"
            },

            // The account-delete endpoint no longer reads the variable itself; it receives
            // this resolution through UserSecretOptions.
            new(DeleteTokenSecretName)
            {
                DevelopmentDefault = DevelopmentDeleteTokenSecret
            },

            new(UserKeySaltName)
            {
                DevelopmentDefault = DevelopmentUserKeySalt
            },

            // The development default lives in UserService under #if DEBUG, because that code
            // path runs for Debug builds outside Development too. Resolving it here as well
            // would recompute an equivalent key and break existing secrets, so Development may
            // keep trusting UserService's fallback.
            new(UnsubscribeSecretName)
        ];

        /// <summary>Every secret this application validates, in reporting order.</summary>
        public static IReadOnlyList<RequiredSecret> All => Secrets;

        /// <summary>Finds a secret by its environment variable name; <c>null</c> when unknown.</summary>
        public static RequiredSecret? Find(string? name)
            => string.IsNullOrEmpty(name) ? null : Secrets.FirstOrDefault(secret => secret.Name == name);

        /// <summary>
        /// Whether a value is good enough to use: present, not blank, and long enough.
        /// </summary>
        public static bool IsAcceptable(string? value)
            => !string.IsNullOrWhiteSpace(value) && value.Length >= MinimumLength;

        /// <summary>
        /// Resolves every secret. A secret that cannot be trusted is absent from the result.
        /// </summary>
        public static Dictionary<string, string?> ResolveAll(
            bool isDevelopment,
            Func<string, string?> environmentReader,
            IConfiguration? configuration = null)
        {
            ArgumentNullException.ThrowIfNull(environmentReader);

            return Secrets.ToDictionary(
                secret => secret.Name,
                secret => secret.Resolve(isDevelopment, environmentReader, configuration));
        }

        /// <summary>
        /// Validates a resolution. Reports every unusable secret at once, so a deployment is
        /// not fixed one redeploy per variable. Pass the same reader and configuration the
        /// resolution used, so a too-short value is reported as such rather than as missing.
        /// </summary>
        public static IReadOnlyList<string> Validate(
            IReadOnlyDictionary<string, string?> values,
            Func<string, string?>? environmentReader = null,
            IConfiguration? configuration = null)
        {
            ArgumentNullException.ThrowIfNull(values);

            return Secrets
                .Where(secret => !IsAcceptable(values.GetValueOrDefault(secret.Name)))
                .Select(secret => secret.DescribeFailure(values.GetValueOrDefault(secret.Name), environmentReader, configuration))
                .ToList();
        }

        /// <summary>The names of the secrets that could not be resolved.</summary>
        public static IReadOnlyList<string> MissingNames(IReadOnlyDictionary<string, string?> values)
        {
            ArgumentNullException.ThrowIfNull(values);

            return Secrets
                .Where(secret => string.IsNullOrWhiteSpace(values.GetValueOrDefault(secret.Name)))
                .Select(secret => secret.Name)
                .ToList();
        }

        /// <summary>
        /// Publishes the resolved values to the process environment, where the services that
        /// consume them read them from, using the same variable names. Only non-empty values
        /// are written: replacing a working variable with nothing would be worse than leaving
        /// it alone.
        /// </summary>
        public static void ApplyEnvironment(
            IReadOnlyDictionary<string, string?> values,
            Action<string, string?> setEnvironmentVariable)
        {
            ArgumentNullException.ThrowIfNull(values);
            ArgumentNullException.ThrowIfNull(setEnvironmentVariable);

            foreach (var secret in Secrets)
            {
                var value = values.GetValueOrDefault(secret.Name);
                if (!string.IsNullOrWhiteSpace(value))
                    setEnvironmentVariable(secret.Name, value);
            }
        }
    }
}
