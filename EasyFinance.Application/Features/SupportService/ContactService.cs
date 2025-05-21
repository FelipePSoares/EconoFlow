using System;
using System.Collections.Generic;
using System.Linq;
using System.Runtime.InteropServices;
using System.Threading.Tasks;
using EasyFinance.Application.Contracts.Persistence;
using EasyFinance.Application.DTOs.Financial;
using EasyFinance.Application.DTOs.Support;
using EasyFinance.Application.Mappers;
using EasyFinance.Domain.AccessControl;
using EasyFinance.Domain.Financial;
using EasyFinance.Domain.Support;
using EasyFinance.Infrastructure;
using EasyFinance.Infrastructure.DTOs;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.UI.Services;
using Microsoft.AspNetCore.JsonPatch;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace EasyFinance.Application.Features.SupportService
{
    public class ContactService : IContactService
    {
        private readonly ILogger<ContactService> logger;
        private readonly IUnitOfWork unitOfWork;
        private readonly IEmailSender emailSender;

        public ContactService(IUnitOfWork unitOfWork, ILogger<ContactService> logger, IEmailSender emailSender)
        {
            this.unitOfWork = unitOfWork;
            this.logger = logger;
            this.emailSender = emailSender;
        }
        public async Task<AppResponse<ContactUsResponseDTO>> CreateAsync(ContactUs contactUs)
        {
            if (contactUs == default)
                return AppResponse<ContactUsResponseDTO>.Error(code: nameof(contactUs), description: string.Format(ValidationMessages.PropertyCantBeNullOrEmpty, nameof(contactUs)));

            contactUs.SetCreatedBy(contactUs.Name);

            var savedContact = this.unitOfWork.ContactUsRepository.InsertOrUpdate(contactUs);
            if (savedContact.Failed)
                return AppResponse<ContactUsResponseDTO>.Error(savedContact.Messages);
            await unitOfWork.CommitAsync();

            // Send email notification asynchronously after saving the contact message
            await emailSender.SendEmailAsync( "abc@gmail.com", "New Support Message Received",$"You have received a new message from {contactUs.Name} ({contactUs.Email}):\n\nSubject: {contactUs.Subject}\n\nMessage:\n{contactUs.Message}"
            );

            return AppResponse<ContactUsResponseDTO>.Success(contactUs.ToDTO());
        }
        
        public AppResponse<ContactUsResponseDTO> GetById(Guid messageId)
        {
            var result = unitOfWork.ContactUsRepository.Trackable().FirstOrDefault(p => p.Id == messageId);

            return AppResponse<ContactUsResponseDTO>.Success(result.ToDTO());
        }
    }
}
