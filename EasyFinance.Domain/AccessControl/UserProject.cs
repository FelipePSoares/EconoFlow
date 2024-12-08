using System;
using EasyFinance.Domain.Models.FinancialProject;
using EasyFinance.Infrastructure;
using EasyFinance.Infrastructure.Exceptions;

namespace EasyFinance.Domain.Models.AccessControl
{
    public class UserProject : BaseEntity
    {
        private UserProject() { }

        public UserProject(User? user = default,  Project project = default, Role role = default, string? email = default)
        {
            if (user == null && string.IsNullOrEmpty(email))
                throw new ValidationException("Either a User or an Email must be provided for the UserProject.");

            this.User = user;
            this.Email = email;
            this.SetProject(project ?? new Project());
            this.SetRole(role);
        }

        public User? User { get; private set; } 
        public string? Email { get; set; }      
        public Project Project { get; private set; } = new Project();
        public Role Role { get; private set; }

        public Guid Token { get; private set; }     
        public bool Accepted { get; private set; }        
        public DateTime SentAt { get; private set; }       
        public DateTime? AcceptedAt { get; private set; }
        public bool Expired { get; private set; } 
        public DateTime ExpiryDate { get; private set; } 

        public void SetUser(User user)
        {
            if (user == default)
                throw new ValidationException(nameof(this.User), string.Format(ValidationMessages.PropertyCantBeNull, nameof(this.User)));

            this.User = user;
        }

        public void SetProject(Project project)
        {
            if (project == default)
                throw new ValidationException(nameof(this.Project), string.Format(ValidationMessages.PropertyCantBeNull, nameof(this.Project)));

            this.Project = project;
        }

        public void SetRole(Role role)
        {
            this.Role = role;
        }
    }
}
