using AutoMapper;
using EasyFinance.Application.DTOs;
using EasyFinance.Server.DTOs;

namespace EasyFinance.Server.Mappers
{
    public class ApiAutoMapperProfiles : Profile
    {
        public ApiAutoMapperProfiles() 
        {
            CreateMap<ProjectDto, ProjectDtoApp>().ReverseMap();
        }  
    }
}
