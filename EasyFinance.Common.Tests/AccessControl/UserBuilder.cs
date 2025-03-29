using AutoFixture;
using EasyFinance.Domain.AccessControl;
using System;
using System.Net.Mail;

namespace EasyFinance.Common.Tests.AccessControl
{
    public class UserBuilder : BaseTests, IBuilder<User>
    {
        private User user;

        public UserBuilder()
        {
            this.user = new User();
            this.user.UserName = Fixture.Create<string>();
            this.AddFirstName(Fixture.Create<string>());
            this.AddLastName(Fixture.Create<string>());
            this.AddEmail(Fixture.Create<MailAddress>().Address);
            this.AddEnabled(true);
        }

        public UserBuilder AddFirstName(string firstName)
        {
            this.user.SetFirstName(firstName);
            return this;
        }

        public UserBuilder AddLastName(string lastName)
        {
            this.user.SetLastName(lastName);
            return this;
        }

        public UserBuilder AddEmail(string email)
        {
            this.user.Email = email;
            return this;
        }

        public UserBuilder AddEnabled(bool enabled)
        {
            this.user.Enabled = enabled;
            return this;
        }

        public UserBuilder AddId(Guid guid)
        {
            this.user.Id = guid;
            return this;
        }

        public User Build() => this.user;

    }
}
