using System;
using EasyFinance.Domain.AccessControl;

namespace EasyFinance.Application.Features.AccessControlService
{
    public interface IAccessControlService
    {
        bool HasAuthorization(Guid userId, Guid projectId, Role accessNeeded);
    }
}
