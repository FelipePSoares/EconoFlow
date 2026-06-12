import { AfterViewInit, ChangeDetectorRef, Component, inject, Input, OnChanges, OnInit, PLATFORM_ID, SimpleChanges, ViewChild, ChangeDetectionStrategy } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { ChartConfiguration, ChartOptions } from 'chart.js';
import { BaseChartDirective } from 'ng2-charts';
import { ExpenseDto } from '../../../expense/models/expense-dto';
import { ExpenseItemDto } from '../../../expense/models/expense-item-dto';
import { IncomeDto } from '../../../income/models/income-dto';
import { CurrentDateService } from '../../../../core/services/current-date.service';
import { TranslateService } from '@ngx-translate/core';
import { toLocalDate } from '../../../../core/utils/date';
import { ChartColors } from '../../../../core/constants/chart-colors';

@Component({
  selector: 'app-monthly-expenses-chart',
  imports: [BaseChartDirective],
  templateUrl: './monthly-expenses-chart.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './monthly-expenses-chart.component.css'
})
export class MonthlyExpensesChartComponent implements OnInit, OnChanges, AfterViewInit {
  private cdr = inject(ChangeDetectorRef);
  private currentDateService = inject(CurrentDateService);

  private platformId = inject(PLATFORM_ID);
  private translateService = inject(TranslateService);

  @Input() expenses: ExpenseDto[] = [];
  @Input() incomes: IncomeDto[] = [];
  @Input() budget = 0;
  @Input() referenceDate?: Date;
  @ViewChild(BaseChartDirective) chart?: BaseChartDirective;
  isBrowser = isPlatformBrowser(this.platformId);
  chartsReady = false;

  public lineChartData: ChartConfiguration<'line'>['data'] = {
    labels: [],
    datasets: [
      {
        data: [],
        label: this.translateService.instant('Income'),
        fill: true,
        tension: 0.5,
        borderColor: ChartColors.income,
        backgroundColor: ChartColors.incomeAlpha15
      },
      {
        data: [],
        label: this.translateService.instant('Expense'),
        fill: true,
        tension: 0.5,
        borderColor: ChartColors.chartRed,
        backgroundColor: ChartColors.chartRedAlpha20,
        pointBackgroundColor: (context: { parsed?: { y?: number | null } }) => {
          const raw = context?.parsed?.y;
          const value = typeof raw === 'number' ? raw : 0;
          const budget = typeof this.budget === 'number' ? this.budget : 0;
          return value > budget ? ChartColors.budgetExceeded : ChartColors.chartRed;
        },
        pointBorderColor: (context: { parsed?: { y?: number | null } }) => {
          const raw = context?.parsed?.y;
          const value = typeof raw === 'number' ? raw : 0;
          const budget = typeof this.budget === 'number' ? this.budget : 0;
          return value > budget ? ChartColors.budgetExceeded : ChartColors.chartRed;
        }
      },
      {
        data: [],
        label: this.translateService.instant('Budget'),
        borderColor: ChartColors.chartBlue,
        backgroundColor: ChartColors.chartBlueAlpha20,
        borderDash: [5, 5],
        fill: false,
        pointRadius: 0
      }
    ]
  };

  public lineChartOptions: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
        display: true,
      },
    },
    scales: {
      y: {
        beginAtZero: true
      }
    }
  };

  ngOnInit() {
    this.updateChartData();
  }

  ngAfterViewInit(): void {
    if (this.isBrowser) {
      setTimeout(() => {
        this.chartsReady = true;
      }, 0);
    }
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['expenses'] || changes['incomes'] || changes['budget'] || changes['referenceDate']) {
      this.updateChartData();
      // Force chart update with change detection
      setTimeout(() => {
        try {
          // Update the chart
          this.chart?.update();
        } catch {
          // Fallback for older ng2-charts versions
          this.chart?.chart?.update?.();
        }
        this.cdr.markForCheck();
      }, 0);
    }
  }

  updateChartData() {
    // Determine selected month and whether it is the actual current month
    const selectedDate = this.referenceDate
      ? new Date(this.referenceDate)
      : this.currentDateService.currentDate;
    const year = selectedDate.getFullYear();
    const month = selectedDate.getMonth() + 1;
    const daysInMonth = new Date(year, month, 0).getDate();
    const today = new Date();
    const isCurrentMonth = today.getFullYear() == year && today.getMonth() + 1 == month;

    // Aggregate expenses by date
    const expenseEntries = this.toExpenseEntries(this.expenses);
    const dailyExpenseSums: Record<string, number> = {};

    for (const entry of expenseEntries) {
      const dateStr = this.toDateKey(entry.date);
      dailyExpenseSums[dateStr] = (dailyExpenseSums[dateStr] || 0) + entry.amount;
    }

    const dailyIncomeSums: Record<string, number> = {};
    for (const income of this.incomes) {
      const incomeDate = toLocalDate(income.date);
      const dateStr = this.toDateKey(incomeDate);
      dailyIncomeSums[dateStr] = (dailyIncomeSums[dateStr] || 0) + Number(income.amount || 0);
    }

    // Filter to current month
    const monthPrefix = `${year}-${String(month).padStart(2, '0')}-`;
    const currentMonthExpenseSums: Record<number, number> = {};
    for (const [dateStr, sum] of Object.entries(dailyExpenseSums)) {
      if (dateStr.startsWith(monthPrefix)) {
        const day = parseInt(dateStr.split('-')[2], 10);
        currentMonthExpenseSums[day] = sum;
      }
    }

    const currentMonthIncomeSums: Record<number, number> = {};
    for (const [dateStr, sum] of Object.entries(dailyIncomeSums)) {
      if (dateStr.startsWith(monthPrefix)) {
        const day = parseInt(dateStr.split('-')[2], 10);
        currentMonthIncomeSums[day] = sum;
      }
    }

    // Build cumulative
    const cumulativeIncome: (number | null)[] = [];
    const cumulativeExpense: (number | null)[] = [];
    let runningIncome = 0;
    let runningExpense = 0;

    for (let day = 1; day <= daysInMonth; day++) {
      if (isCurrentMonth && day > today.getDate()) {
        cumulativeIncome.push(null);
        cumulativeExpense.push(null);
        continue;
      }

      const dayIncome = currentMonthIncomeSums[day] || 0;
      const dayExpense = currentMonthExpenseSums[day] || 0;
      runningIncome += dayIncome;
      runningExpense += dayExpense;
      cumulativeIncome.push(runningIncome);
      cumulativeExpense.push(runningExpense);
    }

    // Budget line
    const budgetLine = new Array(daysInMonth).fill(this.budget);

    // Labels
    const labels = Array.from({ length: daysInMonth }, (_, i) => String(i + 1));

    // Update chart data
    this.lineChartData = {
      ...this.lineChartData,
      labels,
      datasets: [
        {
          ...this.lineChartData.datasets[0],
          data: cumulativeIncome
        },
        {
          ...this.lineChartData.datasets[1],
          data: cumulativeExpense
        },
        {
          ...this.lineChartData.datasets[2],
          data: budgetLine
        }
      ]
    };
  }

  private toExpenseEntries(expenses: ExpenseDto[]): { date: Date; amount: number }[] {
    return expenses.flatMap(expense => {
      if (expense.items?.length) {
        return this.toExpenseItemEntries(expense.items);
      }

      const amount = Number(expense.amount || 0);
      const date = toLocalDate(expense.date);
      if (isNaN(date.getTime()) || amount <= 0) {
        return [];
      }

      return [{ date, amount }];
    });
  }

  private toExpenseItemEntries(items: ExpenseItemDto[]): { date: Date; amount: number }[] {
    return items.flatMap(item => {
      if (item.items?.length) {
        return this.toExpenseItemEntries(item.items);
      }

      const amount = Number(item.amount || 0);
      const date = toLocalDate(item.date);
      if (isNaN(date.getTime()) || amount <= 0) {
        return [];
      }

      return [{ date, amount }];
    });
  }

  private toDateKey(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }
}
