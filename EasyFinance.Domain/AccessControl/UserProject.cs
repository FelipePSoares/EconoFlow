using System;
using EasyFinance.Domain.FinancialProject;
using EasyFinance.Infrastructure;
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

        public void SetUser(User user, string email = "")
        {
            if (user == default && string.IsNullOrEmpty(email))
                throw new ValidationException(nameof(User), ValidationMessages.EitherUserOrEmailMustBeProvided);

            if (user == default)
                Email = email;
            else
                User = user;
        }

        public void SetProject(Project project)
        {
            Project = project ?? throw new ValidationException(nameof(Project), string.Format(ValidationMessages.PropertyCantBeNull, nameof(Project)));
        }

        public void SetRole(Role role)
        {
            Role = role;
        }

        public void SetAccepted()
        {
            if (ExpiryDate < DateTime.UtcNow)
                throw new ValidationException(nameof(ExpiryDate), ValidationMessages.CantAcceptExpiredInvitation);

            Accepted = true;
            AcceptedAt = DateTime.UtcNow;
        }

        public void SetInvitationEmailSent()
        {
            InvitationEmailSent = true;
        }
    }
}
