using EasyFinance.Application.DTOs.Financial;
using EasyFinance.Domain.Financial;
using EasyFinance.Infrastructure.DTOs;
using Microsoft.AspNetCore.JsonPatch;
using System;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace EasyFinance.Application.Features.CategoryService
{
    public interface ICategoryService
    {
        Task<AppResponse<ICollection<Category>>> GetAllAsync(Guid projectId);
        Task<AppResponse<ICollection<CategoryResponseDTO>>> GetAsync(Guid projectId, DateTime from, DateTime to);
        Task<AppResponse<ICollection<Category>>> GetAsync(Guid projectId, int year);
        Task<AppResponse<CategoryResponseDTO>> GetByIdAsync(Guid categoryId);
        Task<AppResponse<CategoryResponseDTO>> CreateAsync(Guid projectId, Category category);
        Task<AppResponse<Category>> UpdateAsync(Category category);
        Task<AppResponse<CategoryResponseDTO>> UpdateAsync(Guid projectId, Guid categoryId, JsonPatchDocument<CategoryRequestDTO> categoryDto);
        Task<AppResponse> DeleteAsync(Guid categoryId);
        Task<AppResponse<ICollection<Category>>> GetDefaultCategoriesAsync(Guid projectId);
    }
}
