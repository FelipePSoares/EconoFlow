using System;
using System.ComponentModel.DataAnnotations;
using EasyFinance.Domain.AccessControl;
using EasyFinance.Infrastructure;
using EasyFinance.Infrastructure.DTOs;

namespace EasyFinance.Domain.Support
{
    public class ContactUs : BaseEntity
    {
        private ContactUs() { }
         public ContactUs(string email, string subject, string message, string name = "default", User createdBy = default)
        {
            SetCreatedBy(createdBy ?? new User());
            SetName(name);
            SetEmail(email);
            SetSubject(subject);
            SetMessage(message);
        }

        [Required]
        public string Name { get; private set; }

        [Required, EmailAddress]
        public string Email { get; private set; }

        public string Subject { get; set; }
        [Required]
        public string Message { get; set; }

        public User CreatedBy { get; private set; } = new User();

        public void SetName(string name)
        {
            Name = name;
        }
        public void SetEmail(string email)
        {
            Email = email;
        }
        public void SetSubject(string subject)
        {

            Subject = subject;
        }
        public void SetMessage(string message)
        {
            Message = message;
        }

        public override AppResponse Validate {
            get
            {
                var response = AppResponse.Success();

                if (string.IsNullOrEmpty(Name))
                    response.AddErrorMessage(nameof(Name), string.Format(ValidationMessages.PropertyCantBeNullOrEmpty, nameof(Name)));
                if (string.IsNullOrEmpty(Email))
                    response.AddErrorMessage(nameof(Email), string.Format(ValidationMessages.PropertyCantBeNullOrEmpty, nameof(Email)));
                
                
                return response;
            }
        }
        public void SetCreatedBy(User createdBy)
        {
            CreatedBy = createdBy;
        }
    }
}