﻿using System;
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

            this.unitOfWork.CategoryRepository.InsertOrUpdate(category);
            project.Categories.Add(category);
            this.unitOfWork.ProjectRepository.InsertOrUpdate(project);

            await unitOfWork.CommitAsync();
            return AppResponse<CategoryResponseDTO>.Success(category.ToDTO());
        }

        public async Task<AppResponse> DeleteAsync(Guid categoryId)
        {
            if (categoryId == Guid.Empty)
                return AppResponse.Error(code: nameof(categoryId), description: ValidationMessages.InvalidCategoryId);

            var category = await unitOfWork.CategoryRepository.Trackable().FirstOrDefaultAsync(category => category.Id == categoryId);

            if (category == null)
                return AppResponse.Error(code: ValidationMessages.NotFound, description: ValidationMessages.CategoryNotFound);

            category.SetArchive();

            unitOfWork.CategoryRepository.InsertOrUpdate(category);
            await unitOfWork.CommitAsync();

            return AppResponse.Success();
        }

        public async Task<AppResponse<ICollection<CategoryResponseDTO>>> GetAllAsync(Guid projectId)
        {
            var result =
                (await unitOfWork.ProjectRepository
                .NoTrackable()
                .Include(p => p.Categories)
                .FirstOrDefaultAsync(p => p.Id == projectId))?
                .Categories
                .ToDTO()
                .ToList();

            return AppResponse<ICollection<CategoryResponseDTO>>.Success(result);
        }

        public async Task<AppResponse<ICollection<CategoryResponseDTO>>> GetAsync(Guid projectId, DateOnly from, DateOnly to)
        {
            var result = (await this.unitOfWork.ProjectRepository.NoTrackable()
                    .Include(p => p.Categories)
                    .ThenInclude(c => c.Expenses.Where(e => e.Date >= from && e.Date < to))
                    .FirstOrDefaultAsync(p => p.Id == projectId))?
                    .Categories
                    .ToDTO()
                    .ToList();

            return AppResponse<ICollection<CategoryResponseDTO>>.Success(result);
        }

        public async Task<AppResponse<ICollection<CategoryResponseDTO>>> GetDefaultCategoriesAsync(Guid projectId)
        {
            if (projectId == Guid.Empty)
                return AppResponse<ICollection<CategoryResponseDTO>>.Error(code: nameof(projectId), description: ValidationMessages.PropertyCantBeNullOrEmpty);

            var project = await unitOfWork.ProjectRepository
                .NoTrackable()
                .Include(p => p.Categories)
                .FirstOrDefaultAsync(p => p.Id == projectId);

            // Extract the category names
            var categoryNames = project.Categories.Select(c => c.Name).ToList();
            var defaultCategories = Category.GetAll();
            var filteredCategories = defaultCategories
                .Where(dc => !categoryNames.Contains(dc.Name))
                .ToDTO()
                .ToList();

            return AppResponse<ICollection<CategoryResponseDTO>>.Success(filteredCategories);
        }

        public async Task<AppResponse<ICollection<CategoryResponseDTO>>> GetAsync(Guid projectId, int year)
        {
            var result = (await this.unitOfWork.ProjectRepository.NoTrackable()
                    .Include(p => p.Categories)
                    .ThenInclude(c => c.Expenses.Where(e => e.Date.Year == year))
                    .FirstOrDefaultAsync(p => p.Id == projectId))?
                    .Categories
                    .ToDTO()
                    .ToList();

            return AppResponse<ICollection<CategoryResponseDTO>>.Success(result);
        }

        public async Task<AppResponse<CategoryResponseDTO>> GetByIdAsync(Guid categoryId)
        {
            var result =
                await unitOfWork.CategoryRepository
                .Trackable()
                .Include(c => c.Expenses)
                .FirstOrDefaultAsync(p => p.Id == categoryId);

            return AppResponse<CategoryResponseDTO>.Success(result.ToDTO());
        }

        public async Task<AppResponse<CategoryResponseDTO>> UpdateAsync(Category category)
        {
            if (category == default)
                return AppResponse<CategoryResponseDTO>.Error(code: nameof(category), description: string.Format(ValidationMessages.PropertyCantBeNullOrEmpty, nameof(category)));

            unitOfWork.CategoryRepository.InsertOrUpdate(category);
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
               .FirstOrDefaultAsync(p => p.Id == categoryId);

            if (existingCategory == null)
                return AppResponse<CategoryResponseDTO>.Error(code: nameof(categoryId), description: string.Format(ValidationMessages.CategoryNotFound, nameof(categoryId)));

            var dto = existingCategory.ToRequestDTO();
            categoryDto.ApplyTo(dto);

            dto.FromDTO(existingCategory);

            var updatedCategory = await UpdateAsync(existingCategory);

            return AppResponse<CategoryResponseDTO>.Success(updatedCategory.Data);
        }
    }
}
