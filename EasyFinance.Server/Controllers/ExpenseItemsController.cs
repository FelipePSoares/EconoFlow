using EasyFinance.Application.Features.ExpenseItemService;
using EasyFinance.Domain.AccessControl;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using System.Net;

namespace EasyFinance.Server.Controllers
{
    [ApiController]
    [Route("api/Projects/{projectId}/Categories/{categoryId}/Expenses/{expenseId}/[controller]")]
    public class ExpenseItemsController : BaseController
    {
        private readonly IExpenseItemService expenseItemService;

        public ExpenseItemsController(IExpenseItemService expenseItemService, UserManager<User> userManager)
        {
            this.expenseItemService = expenseItemService;
        }

        [HttpDelete("{expenseItemId}")]
        public async Task<IActionResult> DeleteAsync(Guid expenseItemId)
        {
            var result = await this.expenseItemService.DeleteAsync(expenseItemId);

            return ValidateResponse(result, HttpStatusCode.OK);
        }
    }
}
