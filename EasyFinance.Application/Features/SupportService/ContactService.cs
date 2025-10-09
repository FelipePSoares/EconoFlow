using System;
using System.Linq;
using System.Threading.Tasks;
using EasyFinance.Application.Contracts.Persistence;
using EasyFinance.Application.DTOs.BackgroundService.Email;
using EasyFinance.Application.DTOs.Support;
using EasyFinance.Application.Features.EmailService;
using EasyFinance.Application.Mappers;
using EasyFinance.Domain.AccessControl;
using EasyFinance.Domain.Support;
using EasyFinance.Infrastructure;
using EasyFinance.Infrastructure.DTOs;
using Microsoft.Extensions.Logging;

namespace EasyFinance.Application.Features.SupportService
{
    public class ContactService(IUnitOfWork unitOfWork, ILogger<ContactService> logger, IEmailService emailService) : IContactService
    {
        private readonly IUnitOfWork unitOfWork = unitOfWork;
        private readonly ILogger<ContactService> logger = logger;
        private readonly IEmailService emailService = emailService;

        public async Task<AppResponse<ContactUsResponseDTO>> CreateAsync(User user,ContactUs contactUs)
        {
            if (contactUs == default)
                return AppResponse<ContactUsResponseDTO>.Error(code: nameof(contactUs), description: string.Format(ValidationMessages.PropertyCantBeNullOrEmpty, nameof(contactUs)));

            contactUs.SetCreatedBy(user);
           
            var savedContact = this.unitOfWork.ContactUsRepository.InsertOrUpdate(contactUs);
            if (savedContact.Failed)
            {
                this.logger.LogError("Failed to save contact message: {Errors}", savedContact.Messages);
                return AppResponse<ContactUsResponseDTO>.Error(savedContact.Messages);
            }

            await unitOfWork.CommitAsync();

            await this.emailService.SendEmailAsync(
                "contact@econoflow.pt",
                EmailTemplates.NewSupportMessageReceived,
                ("Name", contactUs.Name),
                ("Email", contactUs.Email),
                ("Subject", contactUs.Subject),
                ("Message", contactUs.Message)
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
