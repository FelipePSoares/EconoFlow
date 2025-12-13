        public async Task<AppResponse<ICollection<MonthlyExpenseDTO>>> GetMonthlyExpensesAsync(Guid projectId, int monthsBack)
        {
            var endDate = DateOnly.FromDateTime(DateTime.Now);
            var startDate = endDate.AddMonths(-monthsBack);

            // Get all expenses (both direct expenses and expenses with items)
            var allExpenses = await unitOfWork.ProjectRepository
                .NoTrackable()
                .IgnoreQueryFilters()
                .Where(p => p.Id == projectId)
                .SelectMany(p => p.Categories.SelectMany(c => c.Expenses
                    .Where(e => e.Date >= startDate && e.Date <= endDate)))
                .Include(e => e.Items)
                .ToListAsync();

            // Process expenses to get monthly totals
            var monthlyTotals = new Dictionary<string, decimal>();

            foreach (var expense in allExpenses)
            {
                var monthKey = $"{expense.Date.Year}-{expense.Date.Month:D2}";
                
                if (!monthlyTotals.ContainsKey(monthKey))
                {
                    monthlyTotals[monthKey] = 0;
                }

                // If expense has items, sum the items; otherwise use the expense amount directly
                if (expense.Items != null && expense.Items.Any())
                {
                    var itemTotal = expense.Items
                        .Where(i => i.Date >= startDate && i.Date <= endDate)
                        .Sum(i => i.Amount);
                    monthlyTotals[monthKey] += itemTotal;
                }
                else
                {
                    monthlyTotals[monthKey] += expense.Amount;
                }
            }

            var result = monthlyTotals
                .OrderBy(kvp => kvp.Key)
                .Select(kvp => new MonthlyExpenseDTO
                {
                    Month = kvp.Key,
                    Amount = kvp.Value
                })
                .ToList();

            return AppResponse<ICollection<MonthlyExpenseDTO>>.Success(result);
        }
