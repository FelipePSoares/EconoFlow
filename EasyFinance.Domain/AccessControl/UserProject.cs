using System;
using EasyFinance.Domain.Models.FinancialProject;
using EasyFinance.Infrastructure;
using EasyFinance.Infrastructure.Exceptions;

namespace EasyFinance.Domain.Models.AccessControl
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
            this.SetUser(user, email);
            this.SetProject(project);
            this.SetRole(role);
        }

        public User User { get; private set; } = new User();
        public string Email { get; set; } = string.Empty;
        public Project Project { get; private set; } = new Project();
        public Role Role { get; private set; }
        public Guid Token { get; private set; } = Guid.NewGuid();
        public bool Accepted { get; private set; }
        public DateTime SentAt { get; private set; } = DateTime.UtcNow;
        public DateTime? AcceptedAt { get; private set; }
        public DateTime ExpiryDate { get; private set; } = DateTime.UtcNow.AddDays(7);

        public void SetUser(User user, string email = default)
        {
            if (user == default && string.IsNullOrEmpty(email))
                throw new ValidationException(nameof(this.User), ValidationMessages.EitherUserOrEmailMustBeProvided);

            if (user == default)
                this.Email = email;
            else
                this.User = user;
        }

        public void SetProject(Project project)
        {
            this.Project = project ?? throw new ValidationException(nameof(this.Project), string.Format(ValidationMessages.PropertyCantBeNull, nameof(this.Project)));
        }

        public void SetRole(Role role)
        {
            this.Role = role;
        }

        public void SetAccepted()
        {
            if (this.ExpiryDate < DateTime.UtcNow)
                throw new ValidationException(nameof(this.ExpiryDate), ValidationMessages.CantAcceptExpiredInvitation);

            this.Accepted = true;
            this.AcceptedAt = DateTime.UtcNow;
        }
    }
}
