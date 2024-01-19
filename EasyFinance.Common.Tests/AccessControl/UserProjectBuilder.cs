using EasyFinance.Domain.Models.AccessControl;
using EasyFinance.Domain.Models.FinancialProject;

namespace EasyFinance.Common.Tests.AccessControl
{
    public class UserProjectBuilder : IBuilder<UserProject>
    {
        private UserProject userProject;

        public UserProjectBuilder()
        {
            this.userProject = new UserProject();
        }

        public UserProjectBuilder AddUser(User user)
        {
            this.userProject.SetUser(user);
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

        public UserProject Build() => this.userProject;
    }
}
