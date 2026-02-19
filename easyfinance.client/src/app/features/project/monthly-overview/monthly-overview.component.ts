import { CommonModule } from '@angular/common';
import { Component, Input, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ChartData, ChartOptions, TooltipItem } from 'chart.js';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { BaseChartDirective } from 'ng2-charts';
import { forkJoin } from 'rxjs';
import { Category } from '../../../core/models/category';
import { Income } from '../../../core/models/income';
import { CategoryService } from '../../../core/services/category.service';
import { GlobalService } from '../../../core/services/global.service';
import { IncomeService } from '../../../core/services/income.service';
import { ProjectService } from '../../../core/services/project.service';
import { CurrencyFormatPipe } from '../../../core/utils/pipes/currency-format.pipe';
import { ProjectDto } from '../models/project-dto';
import { UserProjectDto } from '../models/user-project-dto';
import { ReturnButtonComponent } from '../../../core/components/return-button/return-button.component';
import { CurrentDateComponent } from '../../../core/components/current-date/current-date.component';
import { CurrentDateService } from '../../../core/services/current-date.service';

interface CategoryInsight {
  name: string;
  amount: number;
  percentage: number;
}

interface ExpenseEntry {
  date: Date;
  amount: number;
}

@Component({
  selector: 'app-monthly-overview',
  imports: [
    CommonModule,
    TranslateModule,
    BaseChartDirective,
    CurrencyFormatPipe,
    ReturnButtonComponent,
    CurrentDateComponent
  ],
  providers: [CurrencyFormatPipe],
  templateUrl: './monthly-overview.component.html',
  styleUrl: './monthly-overview.component.scss'
})
export class MonthlyOverviewComponent implements OnInit {
  @Input({ required: true })
  projectId!: string;

  userProject!: UserProjectDto;

  selectedMonth = this.toMonthInputValue(new Date());
  selectedDate = new Date();

  totalExpenses = 0;
  totalIncomes = 0;
  balance = 0;
  totalBudget = 0;

  expenseInsights: CategoryInsight[] = [];

  private expenseColors = [
    '#ff6b6b',
    '#4ecdc4',
    '#ffe66d',
    '#5dade2',
    '#f39c12',
    '#9b59b6',
    '#2ecc71',
    '#e74c3c',
    '#1abc9c',
    '#f1c40f'
  ];

  dailyIncomeExpenseChartData: ChartData<'line'> = this.createEmptyLineChartData();
  expenseChartData: ChartData<'doughnut'> = this.createEmptyDoughnutChartData();

  lineChartOptions: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom'
      },
      tooltip: {
        callbacks: {
          label: (context: TooltipItem<'line'>) => {
            const label = context.dataset.label || '';
            const value = Number(context.parsed.y) || 0;
            return `${label}: ${this.formatCurrency(value)}`;
          }
        }
      }
    },
    scales: {
      x: {
        title: { display: false }
      },
      y: {
        beginAtZero: true,
        ticks: {
          callback: (value) => this.formatCurrency(Number(value))
        }
      }
    }
  };

  doughnutChartOptions: ChartOptions<'doughnut'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom'
      },
      tooltip: {
        callbacks: {
          label: (context: TooltipItem<'doughnut'>) => this.formatDoughnutTooltip(context)
        }
      }
    }
  };

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private projectService: ProjectService,
    private incomeService: IncomeService,
    private categoryService: CategoryService,
    private globalService: GlobalService,
    private translateService: TranslateService,
    private currentDateService: CurrentDateService,
    private currencyFormatPipe: CurrencyFormatPipe
  ) { }

  ngOnInit(): void {
    this.projectService.selectedUserProject$.subscribe(userProject => {
      const defaultProject = new UserProjectDto();
      defaultProject.project = new ProjectDto();
      this.userProject = userProject ?? defaultProject;
    });

    this.projectService.getUserProject(this.projectId).subscribe(userProject => {
      this.userProject = userProject;
      this.projectService.selectUserProject(userProject);
    });

    this.route.queryParamMap.subscribe(params => {
      const monthParam = params.get('month');
      const normalizedMonth = this.isValidMonthValue(monthParam)
        ? monthParam!
        : this.toMonthInputValue(new Date());

      this.selectedMonth = normalizedMonth;
      this.selectedDate = this.toDateFromMonth(normalizedMonth);
      this.currentDateService.currentDate = new Date(this.selectedDate.getFullYear(), this.selectedDate.getMonth(), 1, 12);
      this.loadMonth(this.selectedDate);
    });
  }

  updateDate(newDate: Date): void {
    this.selectedMonth = this.toMonthInputValue(newDate);
    this.selectedDate = new Date(newDate.getFullYear(), newDate.getMonth(), 1);

    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { month: this.selectedMonth },
      queryParamsHandling: 'merge'
    });
  }

  previous(): void {
    this.router.navigate(['/projects', this.projectId], {
      queryParams: { month: this.selectedMonth }
    });
  }

  private loadMonth(date: Date): void {
    const startDate = new Date(date.getFullYear(), date.getMonth(), 1);
    const endDate = new Date(date.getFullYear(), date.getMonth() + 1, 1);

    forkJoin({
      incomes: this.incomeService.get(this.projectId, startDate, endDate),
      categories: this.categoryService.get(this.projectId, startDate, endDate)
    }).subscribe({
      next: ({ incomes, categories }) => {
        const expenseEntries = this.toExpenseEntries(categories);
        const expenseByCategory = this.toExpenseByCategory(categories);

        this.totalIncomes = incomes.reduce((sum, income) => sum + Number(income.amount || 0), 0);
        this.totalExpenses = expenseEntries.reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
        this.totalBudget = categories.reduce((sum, category) =>
          sum + (category.expenses || []).reduce((expenseSum, expense) => expenseSum + Number(expense.budget || 0), 0), 0);
        this.balance = this.totalIncomes - this.totalExpenses;

        this.dailyIncomeExpenseChartData = this.toDailyLineChartData(date, incomes, expenseEntries, this.totalBudget);
        this.expenseChartData = this.toDoughnutChartData(expenseByCategory, this.expenseColors);
        this.expenseInsights = this.toInsights(expenseByCategory);
      },
      error: () => {
        this.totalExpenses = 0;
        this.totalIncomes = 0;
        this.totalBudget = 0;
        this.balance = 0;
        this.dailyIncomeExpenseChartData = this.createEmptyLineChartData();
        this.expenseChartData = this.createEmptyDoughnutChartData();
        this.expenseInsights = [];
      }
    });
  }

  private toDailyLineChartData(date: Date, incomes: Income[], expenses: ExpenseEntry[], budget: number): ChartData<'line'> {
    const daysInMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
    const labels = Array.from({ length: daysInMonth }, (_, index) => String(index + 1));
    const dailyIncome = new Array(daysInMonth).fill(0);
    const dailyExpense = new Array(daysInMonth).fill(0);

    incomes.forEach(income => {
      const day = new Date(income.date).getDate();
      if (day >= 1 && day <= daysInMonth) {
        dailyIncome[day - 1] += Number(income.amount || 0);
      }
    });

    expenses.forEach(expense => {
      const day = new Date(expense.date).getDate();
      if (day >= 1 && day <= daysInMonth) {
        dailyExpense[day - 1] += Number(expense.amount || 0);
      }
    });

    const cumulativeIncome = dailyIncome.reduce<number[]>((acc, value, index) => {
      acc.push((acc[index - 1] || 0) + value);
      return acc;
    }, []);

    const cumulativeExpense = dailyExpense.reduce<number[]>((acc, value, index) => {
      acc.push((acc[index - 1] || 0) + value);
      return acc;
    }, []);
    const budgetLine = new Array(daysInMonth).fill(this.roundAmount(budget));

    return {
      labels,
      datasets: [
        {
          label: this.translateService.instant('Income'),
          data: cumulativeIncome.map(value => this.roundAmount(value)),
          borderColor: '#2ecc71',
          backgroundColor: 'rgba(46, 204, 113, 0.15)',
          pointRadius: 2,
          tension: 0.3,
          fill: true
        },
        {
          label: this.translateService.instant('Expense'),
          data: cumulativeExpense.map(value => this.roundAmount(value)),
          borderColor: '#ff6b6b',
          backgroundColor: 'rgba(255, 107, 107, 0.12)',
          pointRadius: 2,
          tension: 0.3,
          fill: true
        },
        {
          label: this.translateService.instant('Budget'),
          data: budgetLine,
          borderColor: '#5dade2',
          backgroundColor: 'rgba(93, 173, 226, 0.15)',
          borderDash: [5, 5],
          pointRadius: 0,
          tension: 0,
          fill: false
        }
      ]
    };
  }

  private toExpenseEntries(categories: Category[]): ExpenseEntry[] {
    return categories.flatMap(category =>
      (category.expenses || []).flatMap(expense =>
        expense.items && expense.items.length
          ? expense.items.map(item => ({ date: item.date, amount: Number(item.amount || 0) }))
          : [{ date: expense.date, amount: Number(expense.amount || 0) }]
      )
    );
  }

  private toExpenseByCategory(categories: Category[]): { name: string; amount: number }[] {
    return categories
      .map(category => ({
        name: category.name,
        amount: (category.expenses || []).reduce((sum, expense) => sum + Number(expense.amount || 0), 0)
      }))
      .filter(item => item.amount > 0)
      .sort((a, b) => b.amount - a.amount);
  }

  private toDoughnutChartData(data: { name: string; amount: number }[], colors: string[]): ChartData<'doughnut'> {
    if (!data.length) {
      return this.createEmptyDoughnutChartData();
    }

    return {
      labels: data.map(item => item.name),
      datasets: [
        {
          data: data.map(item => this.roundAmount(item.amount)),
          backgroundColor: data.map((_, index) => colors[index % colors.length]),
          borderColor: '#ffffff',
          borderWidth: 1
        }
      ]
    };
  }

  private toInsights(data: { name: string; amount: number }[]): CategoryInsight[] {
    const total = data.reduce((sum, item) => sum + item.amount, 0);

    if (!total) {
      return [];
    }

    return data.slice(0, 5).map(item => ({
      name: item.name,
      amount: item.amount,
      percentage: (item.amount / total) * 100
    }));
  }

  private createEmptyLineChartData(): ChartData<'line'> {
    return {
      labels: [],
      datasets: [
        { data: [] },
        { data: [] },
        { data: [] }
      ]
    };
  }

  private createEmptyDoughnutChartData(): ChartData<'doughnut'> {
    return {
      labels: [],
      datasets: [{ data: [] }]
    };
  }

  private formatDoughnutTooltip(context: TooltipItem<'doughnut'>): string {
    const label = context.label || '';
    const value = Number(context.parsed) || 0;
    const total = context.dataset.data.reduce((sum, current) => sum + Number(current || 0), 0);
    const percentage = total > 0 ? (value / total) * 100 : 0;

    return `${label}: ${this.formatCurrency(value)} (${percentage.toFixed(1)}%)`;
  }

  private formatCurrency(value: number): string {
    return this.currencyFormatPipe.transform(value, true) || '';
  }

  private roundAmount(value: number | undefined): number {
    return Math.round(Number(value || 0));
  }

  private toMonthInputValue(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  }

  private toDateFromMonth(monthValue: string): Date {
    const [year, month] = monthValue.split('-').map(Number);
    return new Date(year, month - 1, 1);
  }

  private isValidMonthValue(value: string | null): boolean {
    return !!value && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
  }
}
