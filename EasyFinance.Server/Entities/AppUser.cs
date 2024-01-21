namespace EasyFinance.Server.Entities
{
    public class AppUser
    {
        public string Email { get; set; }
        public byte[] PasswordHash { get; set; }
        public byte[] PasswordSalt{ get; set; }

    }
}
