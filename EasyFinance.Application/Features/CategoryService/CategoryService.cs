using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using EasyFinance.Application.Contracts.Persistence;
using EasyFinance.Application.DTOs.Financial;
using EasyFinance.Application.Mappers;
using EasyFinance.Domain.Financial;
using EasyFinance.Infrastructure;
using EasyFinance.Infrastructure.DTOs;
using Microsoft.AspNetCore.JsonPatch;
using Microsoft.EntityFrameworkCore;

namespace EasyFinance.Application.Features.CategoryService
{
    public class CategoryService : ICategoryService
    {
        private readonly IUnitOfWork unitOfWork;

        public CategoryService(IUnitOfWork unitOfWork)
        {
            this.unitOfWork = unitOfWork;
        }

        public async Task<AppResponse<CategoryResponseDTO>> CreateAsync(Guid projectId, Category category)
        {
            if (category == default)
                return AppResponse<CategoryResponseDTO>.Error(code: nameof(category), description: string.Format(ValidationMessages.PropertyCantBeNullOrEmpty, nameof(category)));

            var project = await unitOfWork.ProjectRepository.Trackable().Include(p => p.Categories).FirstOrDefaultAsync(p => p.Id == projectId);

            var categoryExistent = project.Categories.FirstOrDefault(c => c.Name == category.Name);
            if (categoryExistent != default)
                return AppResponse<CategoryResponseDTO>.Success(categoryExistent.ToDTO());

            var nextDisplayOrder = project.Categories.Any() ? project.Categories.Max(c => c.DisplayOrder) + 1 : 0;
            category.SetDisplayOrder(nextDisplayOrder);

            var savedCategory = this.unitOfWork.CategoryRepository.InsertOrUpdate(category);
            if (savedCategory.Failed)
                return AppResponse<CategoryResponseDTO>.Error(savedCategory.Messages);

            project.Categories.Add(savedCategory.Data);

            var savedProject = this.unitOfWork.ProjectRepository.InsertOrUpdate(project);
            if (savedProject.Failed)
                return AppResponse<CategoryResponseDTO>.Error(savedProject.Messages);

            await unitOfWork.CommitAsync();
            return AppResponse<CategoryResponseDTO>.Success(savedCategory.Data.ToDTO());
        }

        public async Task<AppResponse> ArchiveAsync(Guid categoryId)
        {
            if (categoryId == Guid.Empty)
                return AppResponse.Error(code: nameof(categoryId), description: ValidationMessages.InvalidCategoryId);

            var category = await unitOfWork.CategoryRepository
                .Trackable()
                .FirstOrDefaultAsync(category => category.Id == categoryId) ?? throw new KeyNotFoundException(ValidationMessages.CategoryNotFound);

            category.SetArchive();

            var savedCategory = unitOfWork.CategoryRepository.InsertOrUpdate(category);
            if (savedCategory.Failed)
                return AppResponse.Error(savedCategory.Messages);

            await unitOfWork.CommitAsync();

            return AppResponse.Success();
        }

        public async Task<AppResponse<ICollection<CategoryResponseDTO>>> GetAllAsync(Guid projectId)
        {
            var result = SortCategories(
                (await unitOfWork.ProjectRepository
                .NoTrackable()
                .Include(p => p.Categories)
                .FirstOrDefaultAsync(p => p.Id == projectId))?
                .Categories
                .ToDTO());

            return AppResponse<ICollection<CategoryResponseDTO>>.Success(result);
        }

        public async Task<AppResponse<ICollection<CategoryResponseDTO>>> GetAsync(Guid projectId, DateOnly? from, DateOnly? to)
        {
            ICollection<CategoryResponseDTO> categories = [];

            if (from.HasValue && to.HasValue)
                categories = SortCategories((await this.unitOfWork.ProjectRepository.NoTrackable()
                        .Include(p => p.Categories
                            .Where(c =>
                                c.Expenses.Any(e => e.Date >= from && e.Date < to) // keep category if it has expenses
                                || !c.IsArchived                                   // keep if not archived
                            ))
                                .ThenInclude(c => c.Expenses
                                    .Where(e => e.Date >= from && e.Date < to))
                                        .ThenInclude(e => e.Items)
                        .IgnoreQueryFilters() // ignore global IsArchived filter
                        .FirstOrDefaultAsync(p => p.Id == projectId))?
                        .Categories
                        .ToDTO());
            else
                categories = SortCategories((await this.unitOfWork.ProjectRepository.NoTrackable()
                        .Include(p => p.Categories)
                        .FirstOrDefaultAsync(p => p.Id == projectId))?
                        .Categories
                        .ToDTO());

            return AppResponse<ICollection<CategoryResponseDTO>>.Success(categories);
        }

        public async Task<AppResponse<ICollection<CategoryWithPercentageDTO>>> GetDefaultCategoriesAsync(Guid projectId)
        {
            if (projectId == Guid.Empty)
                return AppResponse<ICollection<CategoryWithPercentageDTO>>.Error(code: nameof(projectId), description: ValidationMessages.PropertyCantBeNullOrEmpty);

            var project = await unitOfWork.ProjectRepository
                .NoTrackable()
                .Include(p => p.Categories)
                .FirstOrDefaultAsync(p => p.Id == projectId);

            var categoryNames = project.Categories.Select(c => c.Name).ToList();
            var defaultCategories = Category.GetAllDefaultCategories();
            var filteredCategories = defaultCategories
                .Where(dc => !categoryNames.Contains(dc.category.Name))
                .Select(c => new CategoryWithPercentageDTO()
                {
                    Name = c.category.Name,
                    Percentage = c.percentage
                })
                .ToList();

            return AppResponse<ICollection<CategoryWithPercentageDTO>>.Success(filteredCategories);
        }

        public async Task<AppResponse<ICollection<CategoryResponseDTO>>> GetAsync(Guid projectId, int year)
        {
            var result = SortCategories((await this.unitOfWork.ProjectRepository.NoTrackable()
                    .Include(p => p.Categories)
                    .ThenInclude(c => c.Expenses.Where(e => e.Date.Year == year))
                    .ThenInclude(e => e.Items)
                    .IgnoreQueryFilters() // disables the global filter IsArchived
                    .FirstOrDefaultAsync(p => p.Id == projectId))?
                    .Categories
                    .ToDTO());

            return AppResponse<ICollection<CategoryResponseDTO>>.Success(result);
        }

        public async Task<AppResponse<CategoryResponseDTO>> GetByIdAsync(Guid categoryId)
        {
            var result =
                await unitOfWork.CategoryRepository
                .Trackable()
                .Include(c => c.Expenses)
                .IgnoreQueryFilters() // disables the global filter IsArchived
                .FirstOrDefaultAsync(p => p.Id == categoryId);

            return AppResponse<CategoryResponseDTO>.Success(result.ToDTO());
        }

        public async Task<AppResponse<CategoryResponseDTO>> UpdateAsync(Category category)
        {
            if (category == default)
                return AppResponse<CategoryResponseDTO>.Error(code: nameof(category), description: string.Format(ValidationMessages.PropertyCantBeNullOrEmpty, nameof(category)));

            var savedCategory = unitOfWork.CategoryRepository.InsertOrUpdate(category);
            if (savedCategory.Failed)
                return AppResponse<CategoryResponseDTO>.Error(savedCategory.Messages);

            await unitOfWork.CommitAsync();

            return AppResponse<CategoryResponseDTO>.Success(category.ToDTO());
        }

        public async Task<AppResponse<CategoryResponseDTO>> UpdateAsync(Guid categoryId, JsonPatchDocument<CategoryRequestDTO> categoryDto)
        {
            if (categoryDto == default)
                return AppResponse<CategoryResponseDTO>.Error(code: nameof(categoryDto), description: string.Format(ValidationMessages.PropertyCantBeNullOrEmpty, nameof(categoryDto)));

            var existingCategory =
               await unitOfWork.CategoryRepository
               .Trackable()
               .Include(c => c.Expenses)
               .FirstOrDefaultAsync(p => p.Id == categoryId) ?? throw new KeyNotFoundException(ValidationMessages.CategoryNotFound);

            var dto = existingCategory.ToRequestDTO();
            categoryDto.ApplyTo(dto);

            dto.FromDTO(existingCategory);

            var updatedCategory = await UpdateAsync(existingCategory);

            return AppResponse<CategoryResponseDTO>.Success(updatedCategory.Data);
        }

        public async Task<AppResponse> UpdateOrderAsync(Guid projectId, ICollection<CategoryOrderRequestDTO> categoriesOrder)
        {
            if (projectId == Guid.Empty)
                return AppResponse.Error(code: nameof(projectId), description: ValidationMessages.InvalidProjectId);

            if (categoriesOrder == default || !categoriesOrder.Any())
                return AppResponse.Error(code: nameof(categoriesOrder), description: string.Format(ValidationMessages.PropertyCantBeNullOrEmpty, nameof(categoriesOrder)));

            if (categoriesOrder.Any(item => item.CategoryId == Guid.Empty || item.DisplayOrder < 0))
                return AppResponse.Error(code: nameof(categoriesOrder), description: ValidationMessages.InvalidCategoryId);

            if (categoriesOrder.GroupBy(item => item.CategoryId).Any(group => group.Count() > 1))
                return AppResponse.Error(code: nameof(categoriesOrder), description: ValidationMessages.InvalidCategoryId);

            var project = await unitOfWork.ProjectRepository
                .Trackable()
                .Include(p => p.Categories)
                .FirstOrDefaultAsync(p => p.Id == projectId);

            if (project == default)
                return AppResponse.Error(code: nameof(projectId), description: ValidationMessages.ProjectNotFound);

            var categoriesById = project.Categories.ToDictionary(category => category.Id);
            if (categoriesOrder.Any(item => !categoriesById.ContainsKey(item.CategoryId)))
                return AppResponse.Error(code: nameof(categoriesOrder), description: ValidationMessages.InvalidCategoryId);

            foreach (var categoryOrder in categoriesOrder)
            {
                var category = categoriesById[categoryOrder.CategoryId];
                category.SetDisplayOrder(categoryOrder.DisplayOrder);
                var saveCategory = unitOfWork.CategoryRepository.InsertOrUpdate(category);

                if (saveCategory.Failed)
                    return AppResponse.Error(saveCategory.Messages);
            }

            await unitOfWork.CommitAsync();
            return AppResponse.Success();
        }

        private static ICollection<CategoryResponseDTO> SortCategories(IEnumerable<CategoryResponseDTO> categories)
        {
            return categories?
                .OrderBy(category => category.DisplayOrder)
                .ThenBy(category => category.Name)
                .ToList() ?? [];
        }
    }
}
