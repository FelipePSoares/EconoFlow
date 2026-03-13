import { CommonModule } from '@angular/common';
import { Component, DestroyRef, Input, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ChartData, ChartOptions, TooltipItem } from 'chart.js';
import { catchError, forkJoin, map, of, switchMap } from 'rxjs';
import { CurrentDateComponent } from '../../../core/components/current-date/current-date.component';
import { Category } from '../../../core/models/category';
import { CategoryService } from '../../../core/services/category.service';
import { CurrentDateService } from '../../../core/services/current-date.service';
import { GlobalService } from '../../../core/services/global.service';
import { IncomeService } from '../../../core/services/income.service';
import { PlanService } from '../../../core/services/plan.service';
import { ProjectService } from '../../../core/services/project.service';
import { toLocalDate } from '../../../core/utils/date';
import { CurrencyFormatPipe } from '../../../core/utils/pipes/currency-format.pipe';
import { CategoryDto } from '../../category/models/category-dto';
import { ExpenseDto } from '../../expense/models/expense-dto';
import { IncomeDto } from '../../income/models/income-dto';
import { OverviewAnnualChartCardComponent } from './overview-annual-chart-card/overview-annual-chart-card.component';
import { OverviewMonthlyChartCardComponent } from './overview-monthly-chart-card/overview-monthly-chart-card.component';
import { ProjectDto } from '../models/project-dto';
import { UserProjectDto } from '../models/user-project-dto';

@Component({
  selector: 'app-project-overview',
  imports: [
    CommonModule,
    CurrentDateComponent,
    OverviewMonthlyChartCardComponent,
    OverviewAnnualChartCardComponent,
    CurrencyFormatPipe,
    TranslateModule
  ],
  providers: [CurrencyFormatPipe],
  templateUrl: './project-overview.component.html',
  styleUrl: './project-overview.component.css'
})
export class ProjectOverviewComponent implements OnInit {
  private projectService = inject(ProjectService);
  private categoryService = inject(CategoryService);
  private incomeService = inject(IncomeService);
  private planService = inject(PlanService);
  private currentDateService = inject(CurrentDateService);
  private globalService = inject(GlobalService);
  private translateService = inject(TranslateService);
  private router = inject(Router);
  private destroyRef = inject(DestroyRef);
  private currencyFormatPipe = inject(CurrencyFormatPipe);

  @Input({ required: true })
  projectId!: string;

  userProject!: UserProjectDto;
  currentLanguage = this.globalService.currentLanguage;
  totalIncome = 0;
  totalSaved = 0;
  totalExpense = 0;
  month: { budget: number, spend: number, overspend: number, remaining: number; } = { budget: 0, spend: 0, overspend: 0, remaining: 0 };
  year: { budget: number, spend: number, overspend: number, remaining: number; } = { budget: 0, spend: 0, overspend: 0, remaining: 0 };
  currentMonthExpenses: ExpenseDto[] = [];
  currentMonthIncomes: IncomeDto[] = [];
  yearIncomeExpenseChartData: ChartData<'bar'> = this.createEmptyYearBarChartData();

  yearIncomeExpenseChartOptions: ChartOptions<'bar'> = {
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
    this.translateService.onLangChange
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(event => {
        this.currentLanguage = event.lang;
      });

    this.projectService.selectedUserProject$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(userProject => {
        const defaultProject = new UserProjectDto();
        defaultProject.project = new ProjectDto();
        this.userProject = userProject ?? defaultProject;
      });

    this.projectService.getUserProject(this.projectId).subscribe(userProject => {
      this.userProject = userProject;
      this.projectService.selectUserProject(userProject);
    });

    this.fillData(this.currentDateService.currentDate);
  }

  updateDate(newDate: Date): void {
    this.fillData(newDate);
  }

  openExpenseOverview(): void {
    this.router.navigate(['/projects', this.projectId, 'expense-overview']);
  }

  openIncomes(): void {
    this.router.navigate(['/projects', this.projectId, 'incomes']);
  }

  openIncomePlanMode(): void {
    this.router.navigate(['/projects', this.projectId, 'income-plans']);
  }

  openAnnualOverview(): void {
    const yearValue = this.currentDateService.currentDate.getFullYear();
    this.router.navigate(['/projects', this.projectId, 'overview', 'annual'], {
      queryParams: { year: yearValue }
    });
  }

  openMonthlyOverview(): void {
    const currentDate = this.currentDateService.currentDate;
    const monthValue = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
    this.router.navigate(['/projects', this.projectId, 'overview', 'monthly'], {
      queryParams: { month: monthValue }
    });
  }

  getCurrentDate(): Date {
    return this.currentDateService.currentDate;
  }

  private fillData(date: Date): void {
    const selectedMonthStartDate = new Date(date.getFullYear(), date.getMonth(), 1);
    const selectedMonthEndDate = new Date(date.getFullYear(), date.getMonth() + 1, 1);
    const monthDates = Array.from({ length: 3 }, (_, index) => {
      const offset = index - 2;
      return new Date(date.getFullYear(), date.getMonth() + offset, 1);
    });
    const rangeStartDate = monthDates[0];
    const rangeEndDate = new Date(monthDates[2].getFullYear(), monthDates[2].getMonth() + 1, 1);

    this.incomeService.get(this.projectId, selectedMonthStartDate, selectedMonthEndDate)
      .pipe(map(incomes => IncomeDto.fromIncomes(incomes)))
      .subscribe({
        next: incomes => {
          this.totalIncome = incomes.reduce((sum, current) => sum + Number(current.amount || 0), 0);
          this.currentMonthIncomes = incomes;
        },
        error: () => {
          this.totalIncome = 0;
          this.currentMonthIncomes = [];
        }
      });

    this.planService.getPlans(this.projectId)
      .pipe(
        switchMap(plans => {
          if (!plans.length) {
            return of(0);
          }

          const planEntriesRequests = plans.map(plan =>
            this.planService.getEntries(this.projectId, plan.id).pipe(
              map(entries => entries.reduce((sum, entry) => {
                const entryDate = toLocalDate(entry.date);
                const isSelectedMonth = entryDate.getFullYear() === date.getFullYear()
                  && entryDate.getMonth() === date.getMonth();

                return isSelectedMonth ? sum + Number(entry.amountSigned || 0) : sum;
              }, 0)),
              catchError(() => of(0))
            )
          );

          return forkJoin(planEntriesRequests).pipe(
            map(planTotals => planTotals.reduce((sum, amount) => sum + amount, 0))
          );
        }),
        catchError(() => of(0))
      )
      .subscribe(total => {
        this.totalSaved = total;
      });

    this.projectService.getYearlyInfo(this.projectId, date.getFullYear())
      .subscribe({
        next: summary => {
          this.year = {
            budget: summary.totalBudget,
            spend: summary.totalSpend,
            overspend: summary.totalOverspend,
            remaining: summary.totalRemaining
          };
        },
        error: () => {
          this.year = { budget: 0, spend: 0, overspend: 0, remaining: 0 };
        }
      });

    this.categoryService.get(this.projectId, rangeStartDate, rangeEndDate)
      .subscribe({
        next: categories => {
          this.fillSummaryAndMonthlyChartData(date, categories);
          this.fillYearCharts(date, categories);
        },
        error: () => {
          this.totalExpense = 0;
          this.month = { budget: 0, spend: 0, overspend: 0, remaining: 0 };
          this.currentMonthExpenses = [];
          this.yearIncomeExpenseChartData = this.createEmptyYearBarChartData();
        }
      });
  }

  private fillSummaryAndMonthlyChartData(date: Date, categoriesInRange: Category[]): void {
    const currentMonthCategories = this.filterCategoriesByMonth(categoriesInRange, date);
    const currentMonthCategoryDtos = CategoryDto.fromCategories(currentMonthCategories);
    const monthTotalsInCents = currentMonthCategoryDtos
      .flatMap(category => category.expenses)
      .reduce(
        (totals, expense) => {
          const amountInCents = this.toCents(expense.amount);
          const budgetInCents = this.toCents(expense.budget);
          const overspendInCents = Math.max(amountInCents - budgetInCents, 0);
          const spendInCents = amountInCents - overspendInCents;
          const remainingInCents = budgetInCents - spendInCents;

          totals.budget += budgetInCents;
          totals.spend += spendInCents;
          totals.overspend += overspendInCents;
          totals.remaining += remainingInCents;

          return totals;
        },
        { budget: 0, spend: 0, overspend: 0, remaining: 0 }
      );

    this.month = {
      budget: this.fromCents(monthTotalsInCents.budget),
      spend: this.fromCents(monthTotalsInCents.spend),
      overspend: this.fromCents(monthTotalsInCents.overspend),
      remaining: this.fromCents(monthTotalsInCents.remaining)
    };
    this.totalExpense = this.fromCents(monthTotalsInCents.spend + monthTotalsInCents.overspend);
    this.currentMonthExpenses = currentMonthCategoryDtos.flatMap(category => category.expenses);
  }

  private fillYearCharts(selectedDate: Date, categoriesInRange: Category[]): void {
    const formatter = new Intl.DateTimeFormat(this.currentLanguage, { month: 'short' });
    const monthDates = Array.from({ length: 3 }, (_, index) => {
      const offset = index - 2;
      return new Date(selectedDate.getFullYear(), selectedDate.getMonth() + offset, 1);
    });
    const startDate = monthDates[0];
    const endDate = new Date(monthDates[2].getFullYear(), monthDates[2].getMonth() + 1, 1);
    const monthKeys = monthDates.map(item => `${item.getFullYear()}-${String(item.getMonth() + 1).padStart(2, '0')}`);

    this.incomeService.get(this.projectId, startDate, endDate).subscribe({
      next: incomes => {
        const incomesByMonth = new Map<string, number>(monthKeys.map(key => [key, 0]));
        const expensesByMonth = new Map<string, number>(monthKeys.map(key => [key, 0]));

        incomes.forEach(income => {
          const incomeDate = toLocalDate(income.date);
          const key = `${incomeDate.getFullYear()}-${String(incomeDate.getMonth() + 1).padStart(2, '0')}`;
          if (incomesByMonth.has(key)) {
            incomesByMonth.set(key, (incomesByMonth.get(key) || 0) + Number(income.amount || 0));
          }
        });

        categoriesInRange.forEach(category => {
          category.expenses?.forEach(expense => {
            const expenseDate = toLocalDate(expense.date);
            const key = `${expenseDate.getFullYear()}-${String(expenseDate.getMonth() + 1).padStart(2, '0')}`;
            const amount = Number(expense.amount || 0);

            if (expensesByMonth.has(key)) {
              expensesByMonth.set(key, (expensesByMonth.get(key) || 0) + amount);
            }
          });
        });

        this.yearIncomeExpenseChartData = this.toYearBarChartData(
          monthDates.map(item => formatter.format(item)),
          monthKeys.map(key => incomesByMonth.get(key) || 0),
          monthKeys.map(key => expensesByMonth.get(key) || 0)
        );
      },
      error: () => {
        this.yearIncomeExpenseChartData = this.createEmptyYearBarChartData();
      }
    });
  }

  private toYearBarChartData(labels: string[], incomes: number[], expenses: number[]): ChartData<'bar'> {
    if (!labels.length) {
      return this.createEmptyYearBarChartData();
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

  private createEmptyYearBarChartData(): ChartData<'bar'> {
    return {
      labels: [],
      datasets: [
        { data: [] },
        { data: [] }
      ]
    };
  }

  private formatCurrency(value: number): string {
    return this.currencyFormatPipe.transform(value, true) || '';
  }

  private roundAmount(value: number | undefined): number {
    return Math.round(Number(value || 0));
  }

  private toCents(value: number | undefined): number {
    return Math.round(Number(value || 0) * 100);
  }

  private fromCents(value: number): number {
    return value / 100;
  }

  private filterCategoriesByMonth(categories: Category[], date: Date): Category[] {
    const targetYear = date.getFullYear();
    const targetMonth = date.getMonth();

    return categories
      .map(category => ({
        ...category,
        expenses: (category.expenses || []).filter(expense => {
          const expenseDate = toLocalDate(expense.date);
          return expenseDate.getFullYear() === targetYear && expenseDate.getMonth() === targetMonth;
        })
      }))
      .filter(category => category.expenses.length > 0 || !category.isArchived);
  }

}
