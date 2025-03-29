using System;
using EasyFinance.Domain.FinancialProject;
using EasyFinance.Infrastructure;
using EasyFinance.Infrastructure.DTOs;

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
            SetUser(user);
            SetUser(email);
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

        public override AppResponse Validate
        {
            get
            {
                var response = AppResponse.Success();

                if (User?.Id == default && string.IsNullOrEmpty(Email))
                    response.AddErrorMessage(nameof(User), ValidationMessages.EitherUserOrEmailMustBeProvided);

                if (Project == default)
                    response.AddErrorMessage(nameof(Project), string.Format(ValidationMessages.PropertyCantBeNull, nameof(Project)));

                return response;
            }
        }

        public void SetUser(User user) => User = user;
        public void SetUser(string email) => Email = email;

        public void SetProject(Project project) => Project = project;

        public void SetRole(Role role) => Role = role;

        public AppResponse SetAccepted()
        {
            if (ExpiryDate < DateTime.UtcNow)
                return AppResponse.Error(nameof(ExpiryDate), ValidationMessages.CantAcceptExpiredInvitation);

            Accepted = true;
            AcceptedAt = DateTime.UtcNow;

            return AppResponse.Success();
        }

        public void SetInvitationEmailSent() => InvitationEmailSent = true;
    }
}
