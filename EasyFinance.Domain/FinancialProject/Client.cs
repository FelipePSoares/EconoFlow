using System;
using EasyFinance.Infrastructure;
using EasyFinance.Infrastructure.DTOs;

namespace EasyFinance.Domain.FinancialProject
{
    public class Client : BaseEntity
    {
        private Client() { }

        public Client(
            Guid id = default,
            string name = "Default",
            string email = default,
            string phone = default,
            bool isActive = true,
            string description = default) : base(id)
        {
            SetName(name);
            SetEmail(email);
            SetPhone(phone);
            SetDescription(description);

            this.IsActive = isActive;
        }

        public string Name { get; private set; } = string.Empty;
        public string Email { get; private set; } = string.Empty;
        public string Phone { get; private set; } = string.Empty;
        public bool IsActive { get; private set; } = true;
        public string Description { get; private set; } = string.Empty;
        public bool IsArchived { get; private set; } = false;

        public override AppResponse Validate
        {
            get
            {
                var response = AppResponse.Success();

                if (string.IsNullOrEmpty(Name))
                    response.AddErrorMessage(nameof(Name), string.Format(ValidationMessages.PropertyCantBeNullOrEmpty, nameof(Name)));

                return response;
            }
        }

        public void SetName(string name){
            this.Name = name;
        }

        public void SetEmail(string email){
            this.Email = email;
        }

        public void SetPhone(string phone){
            this.Phone = phone;
        }

        public void SetDescription(string description){
            this.Description = description;
        }

        public void SetActive(){
            this.IsActive = true;
        }

        public void SetDeative(){
            this.IsActive = false;
        }

        public void SetArchived(){
            this.IsArchived = true;
        }
    }
}
