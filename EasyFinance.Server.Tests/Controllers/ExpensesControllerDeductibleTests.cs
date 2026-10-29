using System;
using System.Linq;
using System.Security.Claims;
using System.Text.Json;
using System.Threading.Tasks;
using EasyFinance.Application.Contracts.Persistence;
using EasyFinance.Application.DTOs.Financial;
using EasyFinance.Application.Features.AttachmentService;
using EasyFinance.Application.Features.ExpenseService;
using EasyFinance.Common.Tests;
using EasyFinance.Common.Tests.AccessControl;
using EasyFinance.Common.Tests.Financial;
using EasyFinance.Domain.AccessControl;
using EasyFinance.Domain.Financial;
using EasyFinance.Domain.Shared;
using EasyFinance.Server.Controllers;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.JsonPatch;
using Microsoft.AspNetCore.JsonPatch.Operations;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Moq;
using Shouldly;

namespace EasyFinance.Server.Tests.Controllers
{
    /// <summary>
    /// Regression guards for the item-level deductible flag (issue #1058).
    /// <c>PATCH api/Projects/{projectId}/Categories/{categoryId}/Expenses/{expenseId}</c> must persist
    /// <c>items/{index}/isDeductible</c> and return the persisted flag on the response DTO, without
    /// touching the expense-level flag.
    ///
    /// Coverage note: the <c>add /items/-</c> variant is deliberately not covered here. That path is
    /// currently rejected with a 400 before anything is persisted — <c>UpdateAsync</c> validates the new
    /// item in <c>FromDTO</c>, which requires <c>CreatedBy</c>, but only assigns the creator afterwards.
    /// That is a separate defect; the deductible flag itself binds correctly on the way to that validation.
    /// </summary>
    [Collection("Sequential")]
    public class ExpensesControllerDeductibleTests : BaseTests
    {
        private readonly Guid projectId;
        private readonly Guid categoryId;
        private readonly Guid expenseId;

        public ExpensesControllerDeductibleTests()
        {
            PrepareInMemoryDatabase();

            this.projectId = this.project1.Id;
            this.categoryId = this.project1.Categories.First().Id;
            this.expenseId = this.project1.Categories.First().Expenses.First().Id;
        }

        [Fact]
        public async Task UpdateAsync_PatchReplaceItemIsDeductibleTrue_PersistsAndReturnsDeductibleItem()
        {
            var controller = BuildController();
            await this.SeedExpenseWithSingleItemAsync(isDeductible: false);

            var patch = BuildPatch(new Operation<ExpenseRequestDTO>("replace", "/items/0/isDeductible", null, true));

            var result = OkResult(await controller.Update(this.projectId, this.categoryId, this.expenseId, patch));

            var response = result.Value.ShouldBeOfType<ExpenseResponseDTO>();
            response.Items.ShouldHaveSingleItem().IsDeductible.ShouldBeTrue();

            var persisted = await this.ReloadExpenseAsync();
            persisted.Items.ShouldHaveSingleItem().IsDeductible.ShouldBeTrue();
        }

        [Fact]
        public async Task UpdateAsync_PatchReplaceItemIsDeductibleFalse_ClearsPersistedFlag()
        {
            var controller = BuildController();
            await this.SeedExpenseWithSingleItemAsync(isDeductible: true);

            var patch = BuildPatch(new Operation<ExpenseRequestDTO>("replace", "/items/0/isDeductible", null, false));

            var result = OkResult(await controller.Update(this.projectId, this.categoryId, this.expenseId, patch));

            var response = result.Value.ShouldBeOfType<ExpenseResponseDTO>();
            response.Items.ShouldHaveSingleItem().IsDeductible.ShouldBeFalse();

            var persisted = await this.ReloadExpenseAsync();
            persisted.Items.ShouldHaveSingleItem().IsDeductible.ShouldBeFalse();
        }

        [Fact]
        public async Task UpdateAsync_PatchReplaceItemIsDeductible_DoesNotChangeExpenseLevelFlag()
        {
            var controller = BuildController();
            await this.SeedExpenseWithSingleItemAsync(isDeductible: false);

            var patch = BuildPatch(new Operation<ExpenseRequestDTO>("replace", "/items/0/isDeductible", null, true));

            var result = OkResult(await controller.Update(this.projectId, this.categoryId, this.expenseId, patch));

            var response = result.Value.ShouldBeOfType<ExpenseResponseDTO>();
            response.Items.ShouldHaveSingleItem().IsDeductible.ShouldBeTrue();
            response.IsDeductible.ShouldBeFalse();

            var persisted = await this.ReloadExpenseAsync();
            persisted.Items.ShouldHaveSingleItem().IsDeductible.ShouldBeTrue();
            persisted.IsDeductible.ShouldBeFalse();
        }

        private ExpensesController BuildController()
        {
            var scope = this.serviceProvider.CreateScope();
            var scopedServices = scope.ServiceProvider;
            var expenseService = scopedServices.GetRequiredService<IExpenseService>();
            var userManager = scopedServices.GetRequiredService<UserManager<User>>();

            return new ExpensesController(
                expenseService,
                new Mock<IAttachmentService>().Object,
                userManager)
            {
                ControllerContext = new ControllerContext
                {
                    HttpContext = new DefaultHttpContext
                    {
                        User = new ClaimsPrincipal(new ClaimsIdentity(
                        [
                            new Claim(ClaimTypes.NameIdentifier, this.user1.Id.ToString())
                        ]))
                    }
                }
            };
        }

        private static JsonPatchDocument<ExpenseRequestDTO> BuildPatch(params Operation<ExpenseRequestDTO>[] operations)
        {
            var patch = new JsonPatchDocument<ExpenseRequestDTO>();
            patch.Operations.AddRange(operations);
            return patch;
        }

        private static ObjectResult OkResult(IActionResult result)
        {
            if (result is BadRequestObjectResult badRequest)
                throw new InvalidOperationException("PATCH failed: " + JsonSerializer.Serialize(badRequest.Value));

            var objectResult = result.ShouldBeOfType<ObjectResult>();
            objectResult.StatusCode.ShouldBe(StatusCodes.Status200OK);
            return objectResult;
        }

        private async Task<Expense> ReloadExpenseAsync()
        {
            using var scope = this.serviceProvider.CreateScope();
            var unitOfWork = scope.ServiceProvider.GetRequiredService<IUnitOfWork>();
            return await unitOfWork.ExpenseRepository
                .NoTrackable()
                .Include(e => e.Items)
                .FirstAsync(e => e.Id == this.expenseId);
        }

        /// <summary>
        /// Rewrites the seeded expense to a known baseline: dated today, no expense-level deductible
        /// flag, and exactly one item carrying the requested flag. The item is built through the domain
        /// builder so it has a creator — an item built by <c>FromDTO</c> is validated before
        /// <c>UpdateAsync</c> assigns one.
        /// </summary>
        private async Task SeedExpenseWithSingleItemAsync(bool isDeductible)
        {
            using var scope = this.serviceProvider.CreateScope();
            var unitOfWork = scope.ServiceProvider.GetRequiredService<IUnitOfWork>();

            var expense = await unitOfWork.ExpenseRepository
                .Trackable()
                .Include(e => e.Items)
                .FirstAsync(e => e.Id == this.expenseId);

            var itemBuilder = new ExpenseItemBuilder();
            itemBuilder
                .AddName("Expense Item")
                .AddCreatedBy(this.user1)
                .AddDate(SystemClock.TodayDate)
                .AddAmount(25);
            itemBuilder.SetIsDeductible(isDeductible);

            expense.SetDate(SystemClock.TodayDate);
            expense.SetIsDeductible(false);
            expense.SetItems([itemBuilder.Build()]);

            unitOfWork.ExpenseRepository.InsertOrUpdate(expense);

            await unitOfWork.CommitAsync();
        }
    }
}
