using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using EasyFinance.Application.Contracts.Persistence;
using EasyFinance.Domain.Models.Financial;
using EasyFinance.Infrastructure;
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

        public async Task<Category> CreateAsync(Guid projectId, Category category)
        {
            if (category == default)
                throw new ArgumentNullException(nameof(category), string.Format(ValidationMessages.PropertyCantBeNullOrEmpty, nameof(category)));

            var project = await unitOfWork.ProjectRepository.Trackable().Include(p => p.Categories).FirstOrDefaultAsync(p => p.Id == projectId);

            var categoryExistent = project.Categories.FirstOrDefault(c => c.Name == category.Name && !c.Archive);
            if (categoryExistent != default)
                return categoryExistent;

            this.unitOfWork.CategoryRepository.InsertOrUpdate(category);
            project.Categories.Add(category);
            this.unitOfWork.ProjectRepository.InsertOrUpdate(project);

            await unitOfWork.CommitAsync();

            return category;
        }

        public async Task DeleteAsync(Guid categoryId)
        {
            if (categoryId == Guid.Empty)
                throw new ArgumentNullException("The id is not valid");

            var category = await unitOfWork.CategoryRepository.Trackable().FirstOrDefaultAsync(category => category.Id == categoryId);

            if (category == null)
                return;

            category.SetArchive();

            unitOfWork.CategoryRepository.InsertOrUpdate(category);
            await unitOfWork.CommitAsync();
        }

        public async Task<ICollection<Category>> GetAllAsync(Guid projectId)
            => (await this.unitOfWork.ProjectRepository.NoTrackable().Include(p => p.Categories).FirstOrDefaultAsync(p => p.Id == projectId))?.Categories.Where(c => !c.Archive).ToList();

        public async Task<ICollection<Category>> GetAsync(Guid projectId, DateTime from, DateTime to)
            => (await this.unitOfWork.ProjectRepository.NoTrackable()
            .Include(p => p.Categories)
                .ThenInclude(c => c.Expenses.Where(e => e.Date >= from && e.Date < to))
            .FirstOrDefaultAsync(p => p.Id == projectId))?
            .Categories
            .Where(c => !c.Archive)
            .ToList();

        public async Task<ICollection<Category>> GetDefaultCategoriesAsync(Guid projectId)
        {
            if (projectId == Guid.Empty)
                throw new ArgumentNullException(nameof(projectId));

            var project = await unitOfWork.ProjectRepository
                .NoTrackable()
                .Include(p => p.Categories)
                .FirstOrDefaultAsync(p => p.Id == projectId);

            // Extract the category names
            var categoryNames = project.Categories.Select(c => c.Name).ToList();
            var defaultCategories = Category.GetAll();
            var filteredCategories = defaultCategories
                .Where(dc => !categoryNames.Contains(dc.Name))
                .ToList();

            return filteredCategories;
        }

        public async Task<ICollection<Category>> GetAsync(Guid projectId, int year)
            => (await this.unitOfWork.ProjectRepository.NoTrackable()
            .Include(p => p.Categories)
                .ThenInclude(c => c.Expenses.Where(e => e.Date.Year == year))
            .FirstOrDefaultAsync(p => p.Id == projectId))?
            .Categories
            .Where(c => !c.Archive)
            .ToList();

        public async Task<Category> GetByIdAsync(Guid categoryId)
            => await this.unitOfWork.CategoryRepository.Trackable()
                .Include(c => c.Expenses).FirstOrDefaultAsync(p => p.Id == categoryId);

        public async Task<Category> UpdateAsync(Category category)
        {
            if (category == default)
                throw new ArgumentNullException(string.Format(ValidationMessages.PropertyCantBeNullOrEmpty, nameof(category)));

            unitOfWork.CategoryRepository.InsertOrUpdate(category);
            await unitOfWork.CommitAsync();

            return category;
        }
    }
}
