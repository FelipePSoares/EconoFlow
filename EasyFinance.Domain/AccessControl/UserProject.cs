using System;
using EasyFinance.Domain.Models.FinancialProject;
using EasyFinance.Infrastructure;
using EasyFinance.Infrastructure.Exceptions;

namespace EasyFinance.Domain.Models.AccessControl
{
    public class UserProject : BaseEntity
    {
        public UserProject(User user = default, Project project = default, Role role = default) 
        {
            this.SetUser(user ?? new User());
            this.SetProject(project ?? new Project());
            this.SetRole(role);
        }

        public User User { get; private set; } = new User();
        public Project Project { get; private set; } = new Project();
        public Role Role { get; private set; }

        public void SetUser(User user)
        {
            this.User = user;

            if (this.User == default)
                throw new ValidationException(nameof(this.User), string.Format(ValidationMessages.PropertyCantBeNull, nameof(this.User)));
        }

        public void SetProject(Project project)
        {
            this.Project = project;

            if (this.Project == default)
                throw new ValidationException(nameof(this.Project), string.Format(ValidationMessages.PropertyCantBeNull, nameof(this.Project)));
        }

        public void SetRole(Role role)
        {
            this.Role = role;
        }
    }
}
