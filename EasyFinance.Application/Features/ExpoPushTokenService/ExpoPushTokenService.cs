using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using EasyFinance.Application.Contracts.Persistence;
using EasyFinance.Domain.Account;
using EasyFinance.Infrastructure;
using EasyFinance.Infrastructure.DTOs;
using Microsoft.EntityFrameworkCore;

namespace EasyFinance.Application.Features.ExpoPushTokenService
{
    public class ExpoPushTokenService(IUnitOfWork unitOfWork) : IExpoPushTokenService
    {
        private readonly IUnitOfWork unitOfWork = unitOfWork;

        public async Task<AppResponse> UpsertTokenAsync(Guid userId, string token, string? deviceName)
        {
            if (string.IsNullOrWhiteSpace(token))
                return AppResponse.Error(nameof(token), ValidationMessages.ExpoPushTokenRequired);

            var existing = await unitOfWork.ExpoPushTokenRepository
                .Trackable()
                .FirstOrDefaultAsync(t => t.Token == token);

            if (existing is null)
            {
                var newToken = new ExpoPushToken(userId, token, deviceName);
                var validation = newToken.Validate;
                if (validation.Failed)
                    return validation;

                unitOfWork.ExpoPushTokenRepository.InsertOrUpdate(newToken);
            }
            else
            {
                existing.SetUserId(userId);
                existing.SetDeviceName(deviceName);
                existing.Activate();

                var validation = existing.Validate;
                if (validation.Failed)
                    return validation;
            }

            await unitOfWork.CommitAsync();
            return AppResponse.Success();
        }

        public async Task<AppResponse> RevokeTokenAsync(Guid userId, string token)
        {
            var existing = await unitOfWork.ExpoPushTokenRepository
                .Trackable()
                .FirstOrDefaultAsync(t => t.Token == token);

            if (existing is null)
                return AppResponse.Success();

            if (existing.UserId != userId)
                return AppResponse.Error("forbidden", ValidationMessages.ExpoPushTokenNotOwned);

            existing.Revoke(DateTime.UtcNow);
            await unitOfWork.CommitAsync();
            return AppResponse.Success();
        }

        public async Task<IEnumerable<string>> GetActiveTokensForUserAsync(Guid userId)
        {
            return await unitOfWork.ExpoPushTokenRepository
                .NoTrackable()
                .Where(t => t.UserId == userId && t.RevokedAt == null)
                .Select(t => t.Token)
                .ToListAsync();
        }

        public async Task<IDictionary<Guid, IEnumerable<string>>> GetActiveTokensForUsersAsync(IEnumerable<Guid> userIds)
        {
            var userIdList = userIds.ToList();

            var tokens = await unitOfWork.ExpoPushTokenRepository
                .NoTrackable()
                .Where(t => userIdList.Contains(t.UserId) && t.RevokedAt == null)
                .GroupBy(t => t.UserId)
                .Select(g => new { UserId = g.Key, Tokens = g.Select(t => t.Token).ToList() })
                .ToListAsync();

            return tokens.ToDictionary(
                g => g.UserId,
                g => (IEnumerable<string>)g.Tokens);
        }
    }
}
