﻿using AutoFixture;
using EasyFinance.Domain.AccessControl;
using System;
using System.Net.Mail;

namespace EasyFinance.Common.Tests.AccessControl
{
    public class UserBuilder : IBuilder<User>
    {
        private User user;

        public UserBuilder()
        {
            var fixture = new Fixture();

            this.user = new User();
            this.AddFirstName(fixture.Create<string>());
            this.AddLastName(fixture.Create<string>());
            this.AddEmail(fixture.Create<MailAddress>().Address);
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
