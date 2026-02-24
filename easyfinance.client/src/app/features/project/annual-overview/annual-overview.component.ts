import { CommonModule, isPlatformBrowser } from '@angular/common';
import { AfterViewInit, Component, inject, Input, OnInit, PLATFORM_ID } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
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
import { ReturnButtonComponent } from '../../../core/components/return-button/return-button.component';
import { CurrentDateComponent } from '../../../core/components/current-date/current-date.component';
import { CurrentDateService } from '../../../core/services/current-date.service';
import { toLocalDate } from '../../../core/utils/date';

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
    CurrencyFormatPipe,
    ReturnButtonComponent,
    CurrentDateComponent
  ],
  providers: [CurrencyFormatPipe],
  templateUrl: './annual-overview.component.html',
  styleUrl: './annual-overview.component.css'
})
export class AnnualOverviewComponent implements OnInit, AfterViewInit {
  readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  chartsReady = false;

  private projectService = inject(ProjectService);
  private globalService = inject(GlobalService);
  private incomeService = inject(IncomeService);
  private categoryService = inject(CategoryService);
  private translateService = inject(TranslateService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private currentDateService = inject(CurrentDateService);
  private currencyFormatPipe = inject(CurrencyFormatPipe);

  @Input({ required: true })
  projectId!: string;

  readonly currentYear = new Date().getFullYear();
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
      const yearParam = params.get('year');
      const normalizedYear = this.isValidYear(yearParam) ? Number(yearParam) : this.currentYear;

      this.selectedYear = normalizedYear;
      this.currentDateService.currentDate = new Date(
        this.selectedYear,
        this.currentDateService.currentDate.getMonth(),
        1,
        12
      );
      this.loadYear(this.selectedYear);
    });
  }

  ngAfterViewInit(): void {
    if (this.isBrowser) {
      setTimeout(() => {
        this.chartsReady = true;
      }, 0);
    }
  }

  updateDate(newDate: Date): void {
    const nextYear = newDate.getFullYear();

    if (nextYear === this.selectedYear) {
      return;
    }

    this.selectedYear = nextYear;
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { year: this.selectedYear },
      queryParamsHandling: 'merge'
    });
  }

  previous(): void {
    this.router.navigate(['/projects', this.projectId]);
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
    const startDate = new Date(year, 0, 1);
    const endDate = new Date(year + 1, 0, 1);
    const monthDates = Array.from({ length: 12 }, (_, monthIndex) => new Date(year, monthIndex, 1));

    return forkJoin({
      incomes: this.incomeService.get(this.projectId, startDate, endDate),
      categories: this.categoryService.get(this.projectId, startDate, endDate)
    }).pipe(
      map(({ incomes, categories }) => {
        const incomesByMonth = new Array<number>(12).fill(0);
        const expensesByMonth = new Array<number>(12).fill(0);

        incomes.forEach(income => {
          const incomeDate = toLocalDate(income.date);
          if (incomeDate.getFullYear() === year) {
            incomesByMonth[incomeDate.getMonth()] += Number(income.amount || 0);
          }
        });

        categories.forEach(category => {
          category.expenses?.forEach(expense => {
            const expenseDate = toLocalDate(expense.date);
            if (expenseDate.getFullYear() === year) {
              expensesByMonth[expenseDate.getMonth()] += Number(expense.amount || 0);
            }
          });
        });

        return {
          labels: monthDates.map(date => formatter.format(date)),
          incomes: incomesByMonth,
          expenses: expensesByMonth
        };
      })
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
          data: data.map(item => this.roundAmount(item.amount)),
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
          data: incomes.map(value => this.roundAmount(value)),
          backgroundColor: '#2ecc71',
          borderRadius: 4,
          maxBarThickness: 26
        },
        {
          label: this.translateService.instant('Expense'),
          data: expenses.map(value => this.roundAmount(value)),
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
    return this.currencyFormatPipe.transform(value, true) || '';
  }

  private roundAmount(value: number | undefined): number {
    return Math.round(Number(value || 0));
  }

  private isValidYear(value: string | null): boolean {
    return !!value && /^\d{4}$/.test(value);
  }
}
