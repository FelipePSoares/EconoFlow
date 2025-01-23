using System;
using System.Collections.Generic;
using System.Linq;
using System.Net;
using System.Threading.Tasks;
using EasyFinance.Application.Features.ExpenseItemService;
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
        private readonly IExpenseItemService expenseService;

        public TransactionsController(IIncomeService incomeService, IExpenseItemService expenseService)
        {
            this.incomeService = incomeService;
            this.expenseService = expenseService;
        }

        [HttpGet("{projectId}/latests/{numberOfTransactions}")]
        public IActionResult GetLatestTransactions(Guid projectId, int numberOfTransactions)
        {
            var incomes = incomeService.GetLatestAsync(projectId, numberOfTransactions);
            var expenses = expenseService.GetLatestAsync(projectId, numberOfTransactions);
            
            Task.WaitAll(incomes, expenses);

            var transactions = incomes.Data.Select(i => new { Type = "Income", i.Id, i.Date, i.Amount, i.Name })
                .Concat(expenses.Data.Select(e => new { Type = "Expense", e.Id, e.Date, e.Amount, e.Name }))
                .OrderByDescending(t => t.Date)
                .Take(numberOfTransactions)
                .Cast<object>()  // Add this cast
                .ToList();

            var response = AppResponse<ICollection<object>>.Success(transactions);
            return ValidateResponse(response, HttpStatusCode.OK);
        }
    }
}