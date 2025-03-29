using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using EasyFinance.Application.DTOs.Financial;
using EasyFinance.Domain.Financial;
using EasyFinance.Infrastructure.DTOs;
using Microsoft.AspNetCore.JsonPatch;

namespace EasyFinance.Application.Features.CategoryService
{
    public interface ICategoryService
    {
        Task<AppResponse<ICollection<CategoryResponseDTO>>> GetAllAsync(Guid projectId);
        Task<AppResponse<ICollection<CategoryResponseDTO>>> GetAsync(Guid projectId, DateOnly? from, DateOnly? to);
        Task<AppResponse<ICollection<CategoryResponseDTO>>> GetAsync(Guid projectId, int year);
        Task<AppResponse<CategoryResponseDTO>> GetByIdAsync(Guid categoryId);
        Task<AppResponse<CategoryResponseDTO>> CreateAsync(Guid projectId, Category category);
        Task<AppResponse<CategoryResponseDTO>> UpdateAsync(Category category);
        Task<AppResponse<CategoryResponseDTO>> UpdateAsync(Guid categoryId, JsonPatchDocument<CategoryRequestDTO> categoryDto);
        Task<AppResponse> ArchiveAsync(Guid categoryId);
        Task<AppResponse<ICollection<CategoryResponseDTO>>> GetDefaultCategoriesAsync(Guid projectId);
    }
}
