using Microsoft.Extensions.DependencyInjection;

namespace EasyFinance.Server.Config
{
    /// <summary>
    /// Start-up validation of the environment-supplied secrets (CRA Annex I, Part I, point
    /// 2(1)). See <see cref="RequiredSecrets"/> for the rules.
    /// </summary>
    public static class RequiredSecretsRegistration
    {
        /// <summary>
        /// Resolves every required secret and validates it, then registers it. This is the
        /// entry point for a host that does not need a resolved secret before this call.
        /// </summary>
        /// <param name="services">The service collection.</param>
        /// <param name="environment">The host environment: outside Development nothing falls back.</param>
        /// <param name="configuration">Consulted for secrets configured through a configuration key.</param>
        /// <param name="environmentReader">Reads an environment variable; injected so it can be tested.</param>
        /// <param name="environmentPublisher">Writes an environment variable; injected so it can be tested.</param>
        public static IServiceCollection AddRequiredSecrets(
            this IServiceCollection services,
            IHostEnvironment environment,
            IConfiguration configuration,
            Func<string, string?> environmentReader,
            Action<string, string?> environmentPublisher)
        {
            ArgumentNullException.ThrowIfNull(environment);
            ArgumentNullException.ThrowIfNull(environmentReader);

            var resolved = RequiredSecrets.ResolveAll(environment.IsDevelopment(), environmentReader, configuration);

            return services.AddRequiredSecrets(environment, resolved, environmentPublisher, environmentReader, configuration);
        }

        /// <summary>
        /// Validates the secrets that were already resolved, fails the start-up when one
        /// cannot be trusted, and publishes them to the process environment and to the
        /// services that consume them.
        ///
        /// <para>
        /// Resolution is kept separate from this call because <c>Program.cs</c> reads one of
        /// the secrets — the user-key salt — into the application-layer registration first.
        /// </para>
        /// </summary>
        /// <param name="services">The service collection.</param>
        /// <param name="environment">The host environment: outside Development nothing falls back.</param>
        /// <param name="resolved">The result of <see cref="RequiredSecrets.ResolveAll"/>.</param>
        /// <param name="environmentPublisher">Writes an environment variable; injected so it can be tested.</param>
        /// <param name="environmentReader">
        /// Reads an environment variable, used only to describe a rejection precisely (too
        /// short rather than missing). Optional.
        /// </param>
        /// <param name="configuration">Read alongside <paramref name="environmentReader"/>. Optional.</param>
        /// <exception cref="InvalidOperationException">
        /// Thrown when any secret is missing, blank or shorter than
        /// <see cref="RequiredSecrets.MinimumLength"/> outside Development.
        /// </exception>
        public static IServiceCollection AddRequiredSecrets(
            this IServiceCollection services,
            IHostEnvironment environment,
            IReadOnlyDictionary<string, string?> resolved,
            Action<string, string?> environmentPublisher,
            Func<string, string?>? environmentReader = null,
            IConfiguration? configuration = null)
        {
            ArgumentNullException.ThrowIfNull(services);
            ArgumentNullException.ThrowIfNull(environment);
            ArgumentNullException.ThrowIfNull(resolved);
            ArgumentNullException.ThrowIfNull(environmentPublisher);

            var isDevelopment = environment.IsDevelopment();
            var failures = RequiredSecrets.Validate(resolved, environmentReader, configuration);

            if (failures.Count > 0)
            {
                // A production deployment has no business starting degraded. Development does,
                // but says so: a developer who forgot a secret should not discover it the first
                // time the production build refuses to start.
                if (!isDevelopment)
                    throw new InvalidOperationException($"Invalid secret configuration: {string.Join(" ", failures)}");

                foreach (var failure in failures)
                    Console.Error.WriteLine($"Warning: {failure} Development falls back to a built-in value.");

                Console.Error.WriteLine(
                    $"Warning: development only. Set {string.Join(", ", RequiredSecrets.MissingNames(resolved))} before deploying.");
            }

            RequiredSecrets.ApplyEnvironment(resolved, environmentPublisher);

            services.Configure<UserSecretOptions>(options =>
                options.DeleteTokenSecret = resolved.GetValueOrDefault(RequiredSecrets.DeleteTokenSecretName) ?? string.Empty);

            services.AddOptions<UserSecretOptions>();

            return services;
        }
    }
}
