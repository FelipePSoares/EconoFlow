using System;
using System.Linq;
using EasyFinance.Application.Contracts.Persistence;
using EasyFinance.Domain.Models.AccessControl;

namespace EasyFinance.Application.Features.AccessControlService
{
    public class AccessControlService : IAccessControlService
    {
        private readonly IUnitOfWork unitOfWork;

        public AccessControlService(IUnitOfWork unitOfWork)
        {
            this.unitOfWork = unitOfWork;
        }

        public bool HasAuthorization(Guid userId, Guid projectId, Role accessNeeded)
        {
            var access = this.unitOfWork.UserProjectRepository.NoTrackable().FirstOrDefault(up => up.User.Id == userId && up.Project.Id == projectId);

            return access != null && access.Role >= accessNeeded;
        }
    }
}
