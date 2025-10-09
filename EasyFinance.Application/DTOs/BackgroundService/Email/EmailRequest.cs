namespace EasyFinance.Application.DTOs.BackgroundService.Email
{
    public class EmailRequest(string bodyHtml, string subject, string sender, params string[] to)
    {
        public string BodyHtml { get; } = bodyHtml;
        public string Subject { get; } = subject;
        public string Sender { get; } = sender;
        public string[] To { get; } = to;
    }
}
