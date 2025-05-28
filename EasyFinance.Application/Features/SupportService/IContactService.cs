using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using EasyFinance.Application.DTOs.Support;
using EasyFinance.Domain.AccessControl;
using EasyFinance.Domain.Support;
using EasyFinance.Infrastructure.DTOs;

namespace EasyFinance.Application.Features.SupportService
{
    public interface IContactService
    {
        Task<AppResponse<ContactUsResponseDTO>> CreateAsync(User user,ContactUs contactUs);
        AppResponse<ContactUsResponseDTO> GetById(Guid messageId);
    
    }
}
