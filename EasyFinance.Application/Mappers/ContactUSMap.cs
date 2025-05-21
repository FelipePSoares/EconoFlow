using System;
using System.Collections.Generic;
using System.Linq;
using EasyFinance.Application.DTOs.Support;
using EasyFinance.Domain.AccessControl;
using EasyFinance.Domain.Support;

namespace EasyFinance.Application.Mappers
{
    public static class ContactUSMap
    {
        public static ContactUsResponseDTO ToDTO(this ContactUs contactUs)
        {
            ArgumentNullException.ThrowIfNull(contactUs);

            return new ContactUsResponseDTO()
            {
                Name = contactUs.Name,
                Email = contactUs.Email,
                Subject = contactUs.Subject,
                Message = contactUs.Message
            };
        }

        public static ContactUs FromDTO(this ContactUsRequestDTO contactUsDTO, User user)
        {
            ArgumentNullException.ThrowIfNull(contactUsDTO);

            return new ContactUs(contactUsDTO.Email, contactUsDTO.Subject, contactUsDTO.Message, contactUsDTO.Name, user);
        }

        public static ContactUsRequestDTO ToRequestDTO(this ContactUs contactUs)
        {
            ArgumentNullException.ThrowIfNull(contactUs);

            return new ContactUsRequestDTO()
            {
                Name = contactUs.Name,
                Email = contactUs.Email,
                Subject = contactUs.Subject,
                Message = contactUs.Message
            };
        }
        public static ContactUs FromDTO(this ContactUsRequestDTO contactUsDTO)
        {
            ArgumentNullException.ThrowIfNull(contactUsDTO);

            return new ContactUs(contactUsDTO.Email, contactUsDTO.Subject, contactUsDTO.Message, contactUsDTO.Name);
        }
    }
}
