using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using EasyFinance.Domain.Models.Financial;

namespace EasyFinance.Application.Features.CategoryService
{
    public interface ICategoryService
    {
        Task<ICollection<Category>> GetAllAsync(Guid projectId);
        Task<ICollection<Category>> GetAsync(Guid projectId, DateTime from, DateTime to);
        Task<ICollection<Category>> GetAsync(Guid projectId, int year);
        Task<Category> GetByIdAsync(Guid categoryId);
        Task<Category> CreateAsync(Guid projectId, Category category);
        Task<Category> UpdateAsync(Category category);
        Task DeleteAsync(Guid categoryId);
    }
}
