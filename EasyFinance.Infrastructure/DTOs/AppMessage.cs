namespace EasyFinance.Infrastructure.DTOs
{
    public class AppMessage
    {
        public AppMessage(string code, string description)
        {
            Code = code;
            Description = description;
        }

        public string Code { get; set; } = default!;

        public string Description { get; set; } = default!;
    }
}
