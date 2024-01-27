using AutoMapper;
using EasyFinance.Application.DTOs;
using EasyFinance.Domain.Models.FinancialProject;

namespace EasyFinance.Application.Mappers
{
    public class AutoMapperProfiles: Profile
    {
        public AutoMapperProfiles()
        {
            CreateMap<ProjectDtoApp, Project>().ReverseMap();
        }
    }
}
