using EasyFinance.Common.Tests.FinancialProject;
using EasyFinance.Domain.AccessControl;
using EasyFinance.Domain.FinancialProject;
using System;

namespace EasyFinance.Common.Tests.AccessControl
{
    public class UserProjectBuilder : IBuilder<UserProject>
    {
        private UserProject userProject;

        public UserProjectBuilder()
        {
            var user = new UserBuilder().Build();
            var project = new ProjectBuilder().Build();

            this.userProject = new UserProject(user, project, Role.Admin);
        }

        public UserProjectBuilder AddUser(User user, string email = "")
        {
            this.userProject.SetUser(user, email);
            return this;
        }

        public UserProjectBuilder AddProject(Project project)
        {
            this.userProject.SetProject(project);
            return this;
        }

        public UserProjectBuilder AddRole(Role role)
        {
            this.userProject.SetRole(role);
            return this;
        }

        public UserProjectBuilder SetExpiryDate(DateTime value)
        {
            this.userProject.GetType().GetProperty("ExpiryDate").SetValue(this.userProject, value);
            return this;
        }

        public UserProject Build() => this.userProject;
    }
}
