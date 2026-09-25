namespace EasyFinance.Application.DTOs.BackgroundService.Email
{
    /// <summary>
    /// An e-mail ready to be delivered. The sender address is taken from
    /// <c>SmtpSettings</c> rather than carried per request.
    /// </summary>
    public class EmailRequest(string bodyHtml, string subject, params string[] to)
    {
        public string BodyHtml { get; } = bodyHtml;
        public string Subject { get; } = subject;
        public string[] To { get; } = to;
    }
}
