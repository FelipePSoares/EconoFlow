using System;
using EasyFinance.Domain.AccessControl;

namespace EasyFinance.Application.DTOs.Support
{
    public class ContactUsResponseDTO
    {
        public Guid Id { get; set; }
        public string Name { get; set; }
        public string Email { get; set; }
        public string Subject { get; set; }
        public string Message { get; set; }

        public User createdBy { get; set; }
    }
}
