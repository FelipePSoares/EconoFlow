import { CommonModule } from '@angular/common';
import { Component, Input, OnInit } from '@angular/core';
import { ChartData, ChartOptions, TooltipItem } from 'chart.js';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { BaseChartDirective } from 'ng2-charts';
import { forkJoin, map, Observable } from 'rxjs';
import { CurrencyFormatPipe } from '../../../core/utils/pipes/currency-format.pipe';
import { ProjectService } from '../../../core/services/project.service';
import { AnnualCategorySummary } from '../models/annual-category-summary-dto';
import { GlobalService } from '../../../core/services/global.service';
import { UserProjectDto } from '../models/user-project-dto';
import { ProjectDto } from '../models/project-dto';
import { IncomeService } from '../../../core/services/income.service';
import { CategoryService } from '../../../core/services/category.service';

interface CategoryInsight {
  name: string;
  amount: number;
  percentage: number;
}

@Component({
  selector: 'app-annual-overview',
  imports: [
    CommonModule,
    TranslateModule,
    BaseChartDirective,
    CurrencyFormatPipe
  ],
  templateUrl: './annual-overview.component.html',
  styleUrl: './annual-overview.component.css'
})
export class AnnualOverviewComponent implements OnInit {
  @Input({ required: true })
  projectId!: string;

  readonly currentYear = new Date().getFullYear();
  readonly yearOptions = Array.from({ length: 8 }, (_, index) => this.currentYear - index);
  selectedYear = this.currentYear;

  userProject!: UserProjectDto;

  totalExpenses = 0;
  totalIncomes = 0;
  balance = 0;

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

  expenseChartData: ChartData<'doughnut'> = this.createEmptyChartData();
  monthlyIncomeExpenseChartData: ChartData<'bar'> = this.createEmptyBarChartData();

  doughnutChartOptions: ChartOptions<'doughnut'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom'
      },
      tooltip: {
        callbacks: {
          label: (context: TooltipItem<'doughnut'>) => this.formatTooltipLabel(context)
        }
      }
    }
  };

  barChartOptions: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom'
      },
      tooltip: {
        callbacks: {
          label: (context: TooltipItem<'bar'>) => {
            const label = context.dataset.label || '';
            const value = Number(context.parsed.y) || 0;
            return `${label}: ${this.formatCurrency(value)}`;
          }
        }
      }
    },
    scales: {
      x: {
        stacked: false
      },
      y: {
        beginAtZero: true,
        ticks: {
          callback: (value) => this.formatCurrency(Number(value))
        }
      }
    }
  };

  constructor(
    private projectService: ProjectService,
    private globalService: GlobalService,
    private incomeService: IncomeService,
    private categoryService: CategoryService,
    private translateService: TranslateService
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

    this.loadYear(this.selectedYear);
  }

  onYearChange(event: Event): void {
    const target = event.target as HTMLSelectElement | null;
    const selectedYear = Number(target?.value ?? this.currentYear);
    this.selectedYear = Number.isFinite(selectedYear) ? selectedYear : this.currentYear;
    this.loadYear(this.selectedYear);
  }

  private loadYear(year: number): void {
    forkJoin({
      yearlySummary: this.projectService.getYearlyInfo(this.projectId, year),
      expensesByCategory: this.projectService.getAnnualExpensesByCategory(this.projectId, year),
      monthlyBreakdown: this.getMonthlyIncomeExpenseBreakdown(year)
    }).subscribe({
      next: ({ yearlySummary, expensesByCategory, monthlyBreakdown }) => {
        this.totalExpenses = yearlySummary.totalSpend + yearlySummary.totalOverspend;
        this.totalIncomes = yearlySummary.totalEarned;
        this.balance = this.totalIncomes - this.totalExpenses;

        this.expenseChartData = this.toChartData(expensesByCategory, this.expenseColors);
        this.expenseInsights = this.toInsights(expensesByCategory);
        this.monthlyIncomeExpenseChartData = this.toMonthlyBarChartData(
          monthlyBreakdown.labels,
          monthlyBreakdown.incomes,
          monthlyBreakdown.expenses
        );
      },
      error: () => {
        this.totalExpenses = 0;
        this.totalIncomes = 0;
        this.balance = 0;
        this.expenseChartData = this.createEmptyChartData();
        this.expenseInsights = [];
        this.monthlyIncomeExpenseChartData = this.createEmptyBarChartData();
      }
    });
  }

  private getMonthlyIncomeExpenseBreakdown(year: number): Observable<{ labels: string[]; incomes: number[]; expenses: number[] }> {
    const formatter = new Intl.DateTimeFormat(this.globalService.currentLanguage, { month: 'short' });
    const monthRequests = Array.from({ length: 12 }, (_, monthIndex) => {
      const monthDate = new Date(year, monthIndex, 1);
      return forkJoin({
        incomes: this.incomeService.get(this.projectId, monthDate),
        categories: this.categoryService.get(this.projectId, monthDate)
      }).pipe(
        map(({ incomes, categories }) => ({
          label: formatter.format(monthDate),
          income: incomes.reduce((sum, income) => sum + (income.amount || 0), 0),
          expense: categories.reduce((sum, category) =>
            sum + (category.expenses?.reduce((expenseSum, expense) => expenseSum + (expense.amount || 0), 0) || 0), 0)
        }))
      );
    });

    return forkJoin(monthRequests).pipe(
      map(monthlyData => ({
        labels: monthlyData.map(item => item.label),
        incomes: monthlyData.map(item => item.income),
        expenses: monthlyData.map(item => item.expense)
      }))
    );
  }

  private toChartData(data: AnnualCategorySummary[], colors: string[]): ChartData<'doughnut'> {
    if (!data.length) {
      return this.createEmptyChartData();
    }

    return {
      labels: data.map(item => item.name),
      datasets: [
        {
          data: data.map(item => item.amount),
          backgroundColor: data.map((_, index) => colors[index % colors.length]),
          borderColor: '#ffffff',
          borderWidth: 1
        }
      ]
    };
  }

  private toInsights(data: AnnualCategorySummary[]): CategoryInsight[] {
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

  private createEmptyChartData(): ChartData<'doughnut'> {
    return {
      labels: [],
      datasets: [{ data: [] }]
    };
  }

  private toMonthlyBarChartData(labels: string[], incomes: number[], expenses: number[]): ChartData<'bar'> {
    if (!labels.length) {
      return this.createEmptyBarChartData();
    }

    return {
      labels,
      datasets: [
        {
          label: this.translateService.instant('Income'),
          data: incomes,
          backgroundColor: '#2ecc71',
          borderRadius: 4,
          maxBarThickness: 26
        },
        {
          label: this.translateService.instant('Expense'),
          data: expenses,
          backgroundColor: '#ff6b6b',
          borderRadius: 4,
          maxBarThickness: 26
        }
      ]
    };
  }

  private createEmptyBarChartData(): ChartData<'bar'> {
    return {
      labels: [],
      datasets: [
        { data: [] },
        { data: [] }
      ]
    };
  }

  private formatTooltipLabel(context: TooltipItem<'doughnut'>): string {
    const label = context.label || '';
    const value = Number(context.parsed) || 0;
    const total = context.dataset.data.reduce((sum, current) => sum + Number(current || 0), 0);
    const percentage = total > 0 ? (value / total) * 100 : 0;

    return `${label}: ${this.formatCurrency(value)} (${percentage.toFixed(1)}%)`;
  }

  private formatCurrency(value: number): string {
    return new Intl.NumberFormat(this.globalService.currentLanguage, {
      style: 'currency',
      currency: this.globalService.currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  }
}
