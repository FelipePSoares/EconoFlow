using EasyFinance.Application.Features.ExpenseItemService;
using EasyFinance.Domain.Models.AccessControl;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;

namespace EasyFinance.Server.Controllers
{
    [ApiController]
    [Route("api/Projects/{projectId}/Categories/{categoryId}/Expenses/{expenseId}/[controller]")]
    public class ExpenseItemsController : Controller
    {
        private readonly IExpenseItemService expenseItemService;
        private readonly UserManager<User> userManager;

        public ExpenseItemsController(IExpenseItemService expenseItemService, UserManager<User> userManager)
        {
            this.expenseItemService = expenseItemService;
            this.userManager = userManager;
        }

        [HttpDelete("{expenseItemId}")]
        public async Task<IActionResult> DeleteAsync(Guid expenseItemId)
        {
            await this.expenseItemService.DeleteAsync(expenseItemId);

            return NoContent();
        }
    }
}
