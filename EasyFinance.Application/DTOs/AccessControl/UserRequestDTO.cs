namespace EasyFinance.Application.DTOs.AccessControl
{
    public class UserRequestDTO
    {
        public string FirstName { get; set; } = "Default";
        public string LastName { get; set; } = "Default";
        public string PreferredCurrency { get; set; } = string.Empty;
        public string TimeZoneId { get; set; } = string.Empty;
    }
}
