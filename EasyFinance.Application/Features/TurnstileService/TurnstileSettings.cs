namespace EasyFinance.Application.Features.TurnstileService
{
    public class TurnstileSettings
    {
        public const string SectionName = "Turnstile";

        public string SecretKey { get; set; } = string.Empty;
        public string SiteKey { get; set; } = string.Empty;
    }
}
