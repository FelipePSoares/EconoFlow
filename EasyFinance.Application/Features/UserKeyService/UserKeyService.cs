using System;
using System.Security.Cryptography;
using System.Text;
using EasyFinance.Application.DTOs.Encryption;
using FpsSoftware.Chassis;

namespace EasyFinance.Application.Features.UserKeyService
{
    public class UserKeyService(string salt) : IUserKeyService
    {
        private readonly string salt = string.IsNullOrWhiteSpace(salt)
            ? throw new ArgumentException("A user key salt is required; it is validated at start-up.", nameof(salt))
            : salt;

        public AppResponse<UserKeyResponseDTO> GenerateUserKey(string userId)
        {
            if (string.IsNullOrEmpty(userId))
                return AppResponse<UserKeyResponseDTO>.Error("User ID cannot be null or empty");

            var bytes = Encoding.UTF8.GetBytes($"{userId}:{salt}");
            var hash = SHA256.HashData(bytes);

            return AppResponse<UserKeyResponseDTO>.Success(new UserKeyResponseDTO() { Key = Convert.ToBase64String(hash) });
        }
    }
}
