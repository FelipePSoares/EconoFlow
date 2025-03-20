namespace EasyFinance.Application.DTOs.AccessControl
{
    public class TokenResponseDTO
    {
        public TokenResponseDTO(string accessToken, string refreshToken)
        {
            this.AccessToken = accessToken;
            this.RefreshToken = refreshToken;
        }

        public string AccessToken { get; set; } = string.Empty;
        public string RefreshToken { get; set; } = string.Empty;
    }
}
