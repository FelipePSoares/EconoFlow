namespace EasyFinance.Server.Config
{
    /// <summary>
    /// The secrets that were resolved and validated at start-up and are handed to the
    /// services that consume them.
    ///
    /// <para>
    /// Passing them through options instead of re-reading the environment keeps the single
    /// validated value as the only one in use, and lets a test supply it without touching
    /// process-wide state.
    /// </para>
    /// </summary>
    public class UserSecretOptions
    {
        /// <summary>Key that signs the account-deletion confirmation tokens.</summary>
        public string DeleteTokenSecret { get; set; } = string.Empty;
    }
}
