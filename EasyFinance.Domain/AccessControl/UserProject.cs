using System;
using System.Reflection.Metadata.Ecma335;
using EasyFinance.Domain.FinancialProject;
using EasyFinance.Infrastructure;
using EasyFinance.Infrastructure.DTOs;
using EasyFinance.Infrastructure.Exceptions;

namespace EasyFinance.Domain.AccessControl
{
    public class UserProject : BaseEntity
    {
        private UserProject() { }

        public UserProject(
            User user = default,
            Project project = default,
            Role role = default,
            string email = default)
        {
            SetUser(user, email);
            SetProject(project);
            SetRole(role);
        }

        public User User { get; private set; }
        public string Email { get; private set; } = string.Empty;
        public Project Project { get; private set; }
        public Role Role { get; private set; }
        public Guid Token { get; private set; } = Guid.NewGuid();
        public bool Accepted { get; private set; }
        public DateTime SentAt { get; private set; } = DateTime.UtcNow;
        public DateTime? AcceptedAt { get; private set; }
        public DateTime ExpiryDate { get; private set; } = DateTime.UtcNow.AddDays(7);
        public bool InvitationEmailSent { get; private set; }

        public AppResponse SetUser(User user, string email = "")
        {
            if (user == default && string.IsNullOrEmpty(email))
                return AppResponse.Error(nameof(User), ValidationMessages.EitherUserOrEmailMustBeProvided);

            if (user == default)
                Email = email;
            else
                User = user;

            return AppResponse.Success();
        }

        public AppResponse SetProject(Project project)
        {
            if (project == default)
                return AppResponse.Error(nameof(Project), string.Format(ValidationMessages.PropertyCantBeNull, nameof(Project)));

            Project = project;

            return AppResponse.Success();
        }

        public void SetRole(Role role)
        {
            Role = role;
        }

        public AppResponse SetAccepted()
        {
            if (ExpiryDate < DateTime.UtcNow)
                return AppResponse.Error(nameof(ExpiryDate), ValidationMessages.CantAcceptExpiredInvitation);

            Accepted = true;
            AcceptedAt = DateTime.UtcNow;

            return AppResponse.Success();
        }

        public void SetInvitationEmailSent()
        {
            InvitationEmailSent = true;
        }
    }
}
