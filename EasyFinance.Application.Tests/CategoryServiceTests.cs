using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using EasyFinance.Application.Contracts.Persistence;
using EasyFinance.Application.DTOs.Financial;
using EasyFinance.Application.Features.CategoryService;
using EasyFinance.Common.Tests;
using EasyFinance.Common.Tests.Financial;
using EasyFinance.Common.Tests.FinancialProject;
using EasyFinance.Domain.Financial;
using EasyFinance.Domain.FinancialProject;
using EasyFinance.Infrastructure;
using FluentAssertions;
using Microsoft.AspNetCore.JsonPatch;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Moq;

namespace EasyFinance.Application.Tests
{
    [Collection("Sequential")]
    public class CategoryServiceTests : BaseTests
    {
        private readonly CategoryService categoryService;
        private readonly Mock<IUnitOfWork> unitOfWorkMock;
        private readonly Mock<IGenericRepository<Category>> categoryRepositoryMock;
        private readonly Mock<IGenericRepository<Project>> projectRepositoryMock;

        public CategoryServiceTests()
        {
            unitOfWorkMock = new Mock<IUnitOfWork>();
            categoryRepositoryMock = new Mock<IGenericRepository<Category>>();
            projectRepositoryMock = new Mock<IGenericRepository<Project>>();

            unitOfWorkMock.Setup(uw => uw.CategoryRepository).Returns(categoryRepositoryMock.Object);
            unitOfWorkMock.Setup(uw => uw.ProjectRepository).Returns(projectRepositoryMock.Object);

            categoryService = new CategoryService(unitOfWorkMock.Object);

            PrepareInMemoryDatabase();
        }

        [Fact]
        public async Task CreateAsync_WithNullCategory_ShouldReturnError()
        {
            // Arrange
            var projectId = Guid.NewGuid();
            Category? category = default;

            // Act
            var result = await categoryService.CreateAsync(projectId, category);

            // Assert
            result.Succeeded.Should().BeFalse();
            result.Messages.Should().HaveCount(1);
            result.Messages.First().Description.Should().Be(string.Format(ValidationMessages.PropertyCantBeNullOrEmpty, nameof(category)));
        }

        [Fact]
        public async Task CreateAsync_WithExistingCategoryName_ShouldReturnExistingCategory()
        {
            using var scope = this.serviceProvider.CreateScope();
            var scopedServices = scope.ServiceProvider;
            var service = scopedServices.GetRequiredService<ICategoryService>();
            var unitOfWork = scopedServices.GetRequiredService<IUnitOfWork>();

            // Arrange
            var projectId = this.project1.Id;
            var existingCategoryName = this.project1.Categories.First().Name;
            var duplicate = new CategoryBuilder().AddName(existingCategoryName).Build();

            // Act
            var result = await service.CreateAsync(projectId, duplicate);

            // Assert
            result.Succeeded.Should().BeTrue();
            result.Data.Name.Should().Be(existingCategoryName);
        }

        [Fact]
        public async Task CreateAsync_WithNewCategory_ShouldPersistCategory()
        {
            using var scope = this.serviceProvider.CreateScope();
            var scopedServices = scope.ServiceProvider;
            var service = scopedServices.GetRequiredService<ICategoryService>();
            var unitOfWork = scopedServices.GetRequiredService<IUnitOfWork>();

            // Arrange
            var projectId = this.project1.Id;
            var newCategory = new CategoryBuilder().AddName("New Unique Category").Build();
            var initialCount = this.project1.Categories.Count;

            // Act
            var result = await service.CreateAsync(projectId, newCategory);

            // Assert
            result.Succeeded.Should().BeTrue();
            result.Data.Name.Should().Be("New Unique Category");

            var project = await unitOfWork.ProjectRepository
                .NoTrackable()
                .Include(p => p.Categories)
                .FirstAsync(p => p.Id == projectId);
            project.Categories.Count.Should().Be(initialCount + 1);
        }

        [Fact]
        public async Task ArchiveAsync_WithEmptyId_ShouldReturnError()
        {
            // Act
            var result = await categoryService.ArchiveAsync(Guid.Empty);

            // Assert
            result.Succeeded.Should().BeFalse();
            result.Messages.Should().HaveCount(1);
            result.Messages.First().Description.Should().Be(ValidationMessages.InvalidCategoryId);
        }

        [Fact]
        public async Task ArchiveAsync_WithValidId_ShouldMarkCategoryArchived()
        {
            using var scope = this.serviceProvider.CreateScope();
            var scopedServices = scope.ServiceProvider;
            var service = scopedServices.GetRequiredService<ICategoryService>();
            var unitOfWork = scopedServices.GetRequiredService<IUnitOfWork>();

            // Arrange
            var categoryId = this.project1.Categories.First().Id;

            // Act
            var result = await service.ArchiveAsync(categoryId);

            // Assert
            result.Succeeded.Should().BeTrue();

            var category = await unitOfWork.CategoryRepository
                .NoTrackable()
                .IgnoreQueryFilters()
                .FirstAsync(c => c.Id == categoryId);
            category.IsArchived.Should().BeTrue();
        }

        [Fact]
        public async Task GetAllAsync_ShouldReturnAllCategoriesForProject()
        {
            using var scope = this.serviceProvider.CreateScope();
            var scopedServices = scope.ServiceProvider;
            var service = scopedServices.GetRequiredService<ICategoryService>();

            // Act
            var result = await service.GetAllAsync(this.project1.Id);

            // Assert
            result.Succeeded.Should().BeTrue();
            result.Data.Should().NotBeEmpty();
            result.Data.Count.Should().Be(this.project1.Categories.Count);
        }

        [Fact]
        public async Task GetByIdAsync_WithValidId_ShouldReturnCategory()
        {
            using var scope = this.serviceProvider.CreateScope();
            var scopedServices = scope.ServiceProvider;
            var service = scopedServices.GetRequiredService<ICategoryService>();

            // Arrange
            var categoryId = this.project1.Categories.First().Id;
            var expectedName = this.project1.Categories.First().Name;

            // Act
            var result = await service.GetByIdAsync(categoryId);

            // Assert
            result.Succeeded.Should().BeTrue();
            result.Data.Should().NotBeNull();
            result.Data.Name.Should().Be(expectedName);
        }

        [Fact]
        public async Task UpdateAsync_WithNullCategory_ShouldReturnError()
        {
            // Arrange
            Category? category = default;

            // Act
            var result = await categoryService.UpdateAsync(category);

            // Assert
            result.Succeeded.Should().BeFalse();
            result.Messages.Should().HaveCount(1);
            result.Messages.First().Description.Should().Be(string.Format(ValidationMessages.PropertyCantBeNullOrEmpty, nameof(category)));
        }

        [Fact]
        public async Task UpdateAsync_WithValidCategory_ShouldPersistChanges()
        {
            using var scope = this.serviceProvider.CreateScope();
            var scopedServices = scope.ServiceProvider;
            var service = scopedServices.GetRequiredService<ICategoryService>();
            var unitOfWork = scopedServices.GetRequiredService<IUnitOfWork>();

            // Arrange
            var existingCategory = await unitOfWork.CategoryRepository
                .Trackable()
                .FirstAsync(c => c.Id == this.project1.Categories.First().Id);
            var updatedName = "Updated Category Name";
            existingCategory.SetName(updatedName);

            // Act
            var result = await service.UpdateAsync(existingCategory);

            // Assert
            result.Succeeded.Should().BeTrue();
            result.Data.Name.Should().Be(updatedName);
        }

        [Fact]
        public async Task UpdateOrderAsync_WithEmptyProjectId_ShouldReturnError()
        {
            // Arrange
            var order = new List<CategoryOrderRequestDTO>
            {
                new() { CategoryId = Guid.NewGuid(), DisplayOrder = 0 }
            };

            // Act
            var result = await categoryService.UpdateOrderAsync(Guid.Empty, order);

            // Assert
            result.Succeeded.Should().BeFalse();
            result.Messages.First().Description.Should().Be(ValidationMessages.InvalidProjectId);
        }

        [Fact]
        public async Task UpdateOrderAsync_WithEmptyOrderList_ShouldReturnError()
        {
            // Act
            var result = await categoryService.UpdateOrderAsync(Guid.NewGuid(), new List<CategoryOrderRequestDTO>());

            // Assert
            result.Succeeded.Should().BeFalse();
            result.Messages.First().Description.Should().Be(string.Format(ValidationMessages.PropertyCantBeNullOrEmpty, "categoriesOrder"));
        }

        [Fact]
        public async Task UpdateOrderAsync_WithValidOrder_ShouldUpdateDisplayOrder()
        {
            using var scope = this.serviceProvider.CreateScope();
            var scopedServices = scope.ServiceProvider;
            var service = scopedServices.GetRequiredService<ICategoryService>();
            var unitOfWork = scopedServices.GetRequiredService<IUnitOfWork>();

            // Arrange
            var projectId = this.project1.Id;
            var categoryId = this.project1.Categories.First().Id;
            var newOrder = new List<CategoryOrderRequestDTO>
            {
                new() { CategoryId = categoryId, DisplayOrder = 5 }
            };

            // Act
            var result = await service.UpdateOrderAsync(projectId, newOrder);

            // Assert
            result.Succeeded.Should().BeTrue();
            var updatedCategory = await unitOfWork.CategoryRepository
                .NoTrackable()
                .FirstAsync(c => c.Id == categoryId);
            updatedCategory.DisplayOrder.Should().Be(5);
        }

        [Fact]
        public async Task GetAsync_WithDateRange_ShouldReturnCategoriesWithMatchingExpenses()
        {
            using var scope = this.serviceProvider.CreateScope();
            var service = scope.ServiceProvider.GetRequiredService<ICategoryService>();

            var yesterday = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-1));
            var tomorrow = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(1));

            var result = await service.GetAsync(this.project1.Id, yesterday, tomorrow);

            result.Succeeded.Should().BeTrue();
            result.Data.Should().NotBeEmpty();
            result.Data.Should().HaveCount(this.project1.Categories.Count);
        }

        [Fact]
        public async Task GetAsync_WithDateRange_ExcludingExpenses_ShouldReturnEmptyExpenses()
        {
            using var scope = this.serviceProvider.CreateScope();
            var service = scope.ServiceProvider.GetRequiredService<ICategoryService>();

            // Range that doesn't include yesterday's expenses
            var from = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-30));
            var to = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-2));

            var result = await service.GetAsync(this.project1.Id, from, to);

            result.Succeeded.Should().BeTrue();
            // Categories with no expenses in range are still returned (non-archived)
            result.Data.Should().NotBeNull();
        }

        [Fact]
        public async Task GetAsync_ByYear_WithCurrentYear_ShouldReturnCategoriesWithExpenses()
        {
            using var scope = this.serviceProvider.CreateScope();
            var service = scope.ServiceProvider.GetRequiredService<ICategoryService>();

            var currentYear = DateTime.UtcNow.Year;

            var result = await service.GetAsync(this.project1.Id, currentYear);

            result.Succeeded.Should().BeTrue();
            result.Data.Should().NotBeNull();
            result.Data.Should().HaveCount(this.project1.Categories.Count);
        }

        [Fact]
        public async Task GetAsync_ByYear_WithPastYear_ShouldReturnCategoriesWithNoExpenses()
        {
            using var scope = this.serviceProvider.CreateScope();
            var service = scope.ServiceProvider.GetRequiredService<ICategoryService>();

            var result = await service.GetAsync(this.project1.Id, 2000);

            result.Succeeded.Should().BeTrue();
            result.Data.Should().NotBeNull();
            // All categories returned but with empty expense collections
            result.Data.All(c => !c.Expenses.Any()).Should().BeTrue();
        }

        [Fact]
        public async Task UpdateAsync_WithPatch_ShouldReturnError_WhenPatchDocumentIsNull()
        {
            var categoryId = this.project1.Categories.First().Id;
            JsonPatchDocument<CategoryRequestDTO>? patch = default;

            var result = await categoryService.UpdateAsync(categoryId, patch);

            result.Succeeded.Should().BeFalse();
            result.Messages.First().Description.Should().Be(string.Format(ValidationMessages.PropertyCantBeNullOrEmpty, nameof(patch)));
        }

        [Fact]
        public async Task UpdateAsync_WithPatch_ShouldApplyNameChange()
        {
            using var scope = this.serviceProvider.CreateScope();
            var service = scope.ServiceProvider.GetRequiredService<ICategoryService>();
            var unitOfWork = scope.ServiceProvider.GetRequiredService<IUnitOfWork>();

            var categoryId = this.project1.Categories.First().Id;
            var newName = "Patched Category Name";

            var patch = new JsonPatchDocument<CategoryRequestDTO>();
            patch.Replace(c => c.Name, newName);

            var result = await service.UpdateAsync(categoryId, patch);

            result.Succeeded.Should().BeTrue();
            result.Data.Name.Should().Be(newName);

            var saved = await unitOfWork.CategoryRepository
                .NoTrackable()
                .FirstAsync(c => c.Id == categoryId);
            saved.Name.Should().Be(newName);
        }

        [Fact]
        public async Task GetDefaultCategoriesAsync_WithEmptyProjectId_ShouldReturnError()
        {
            // Act
            var result = await categoryService.GetDefaultCategoriesAsync(Guid.Empty);

            // Assert
            result.Succeeded.Should().BeFalse();
            result.Messages.First().Description.Should().Be(ValidationMessages.PropertyCantBeNullOrEmpty);
        }

        [Fact]
        public async Task GetDefaultCategoriesAsync_WithValidProject_ShouldReturnUnusedDefaults()
        {
            using var scope = this.serviceProvider.CreateScope();
            var scopedServices = scope.ServiceProvider;
            var service = scopedServices.GetRequiredService<ICategoryService>();

            // Act
            var result = await service.GetDefaultCategoriesAsync(this.project1.Id);

            // Assert
            result.Succeeded.Should().BeTrue();
            result.Data.Should().NotBeNull();
        }
    }
}
