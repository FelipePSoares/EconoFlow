using System;
using EasyFinance.Domain.AccessControl;

namespace EasyFinance.Application.DTOs.Support
{
    public class ContactUsRequestDTO
    {
        public string Name { get; set; }= "Default";
        public string Email { get; set; }
        public string Subject { get; set; }
        public string Message { get; set; }
    }
}
