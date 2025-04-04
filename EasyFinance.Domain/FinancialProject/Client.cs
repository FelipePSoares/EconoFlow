using System;
using EasyFinance.Domain.Financial;
using EasyFinance.Infrastructure;
using EasyFinance.Infrastructure.DTOs;
using EasyFinance.Infrastructure.Validators;

namespace EasyFinance.Domain.FinancialProject
{
    public class Client : BaseEntity
    {
        private Client() { }

        public Client(Guid Id, string Name = "") : base(Id)
        {
            
        }

        public string Name { get; private set; } = string.Empty;
        public string Email { get; private set; } = string.Empty;
        public string Phone { get; private set; } = string.Empty;
        public bool IsActive { get; private set; } = true;
        public string Description { get; private set; } = string.Empty;

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
    }
}
