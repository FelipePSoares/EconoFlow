using System;
using System.Collections.Generic;
using System.Linq;
using System.Net;
using System.Threading.Tasks;
using EasyFinance.Application.Features.ExpenseItemService;
using EasyFinance.Application.Features.ExpenseService;
using EasyFinance.Application.Features.IncomeService;
using EasyFinance.Infrastructure.DTOs;
using Microsoft.AspNetCore.Mvc;

namespace EasyFinance.Server.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class TransactionsController : BaseController
    {
        private readonly IIncomeService incomeService;
        private readonly IExpenseService expenseService;
        private readonly IExpenseItemService expenseItemService;

        public TransactionsController(IIncomeService incomeService, IExpenseService expenseService, IExpenseItemService expenseItemService)
        {
            this.incomeService = incomeService;
            this.expenseService = expenseService;
            this.expenseItemService = expenseItemService;
        }

        [HttpGet("{projectId}/latests/{numberOfTransactions}")]
        public async Task<IActionResult> GetLatestTransactions(Guid projectId, int numberOfTransactions)
        {
            var incomes = incomeService.GetLatestAsync(projectId, numberOfTransactions);
            var expenses = expenseService.GetLatestAsync(projectId, numberOfTransactions);
            var expenseItems = expenseItemService.GetLatestAsync(projectId, numberOfTransactions);

            await Task.WhenAll(incomes, expenses, expenseItems);

            var transactions = incomes.Result.Data.Select(i => new { Type = "Income", i.Id, i.Date, i.Amount, i.Name })
                .Concat(expenses.Result.Data.Select(e => new { Type = "Expense", e.Id, e.Date, Amount = e.Amount * -1, e.Name }))
                .Concat(expenseItems.Result.Data.Select(e => new { Type = "Expense", e.Id, e.Date, Amount = e.Amount * -1, e.Name }))
                .OrderByDescending(t => t.Date)
                .Take(numberOfTransactions)
                .Cast<object>()  // Add this cast
                .ToList();

            var response = AppResponse<ICollection<object>>.Success(transactions);
            return ValidateResponse(response, HttpStatusCode.OK);
        }
    }
}