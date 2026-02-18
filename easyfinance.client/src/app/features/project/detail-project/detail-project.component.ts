import { Component, Input, OnInit } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { BehaviorSubject, forkJoin, map, Observable } from 'rxjs';
import { CommonModule } from '@angular/common';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { CdkTableDataSourceInput } from '@angular/cdk/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { TranslateModule } from '@ngx-translate/core';
import { ChartData, ChartOptions, TooltipItem } from 'chart.js';
import { BaseChartDirective } from 'ng2-charts';
import { CurrentDateComponent } from '../../../core/components/current-date/current-date.component';
import { CategoryService } from '../../../core/services/category.service';
import { CategoryDto } from '../../category/models/category-dto';
import { IncomeService } from '../../../core/services/income.service';
import { IncomeDto } from '../../income/models/income-dto';
import { ExpenseDto } from '../../expense/models/expense-dto';
import { ProjectService } from '../../../core/services/project.service';
import { CurrencyFormatPipe } from '../../../core/utils/pipes/currency-format.pipe';
import { TransactionDto } from '../models/transaction-dto';
import { UserProjectDto } from '../models/user-project-dto';
import { Role } from '../../../core/enums/Role';
import { PageModalComponent } from '../../../core/components/page-modal/page-modal.component';
import { BudgetBarComponent } from '../../../core/components/budget-bar/budget-bar.component';
import { CurrentDateService } from '../../../core/services/current-date.service';
import { ProjectDto } from '../models/project-dto';
import { MonthlyExpensesChartComponent } from './monthly-expenses-chart/monthly-expenses-chart.component';
import { GlobalService } from '../../../core/services/global.service';
import { TranslateService } from '@ngx-translate/core';

@Component({
    selector: 'app-detail-project',
    imports: [
      CommonModule,
      CurrentDateComponent,
      BudgetBarComponent,
      MonthlyExpensesChartComponent,
      BaseChartDirective,
      CurrencyFormatPipe,
      MatButtonModule,
      MatIconModule,
      MatTableModule,
      TranslateModule
    ],
    templateUrl: './detail-project.component.html',
    styleUrl: './detail-project.component.scss'
})

export class DetailProjectComponent implements OnInit {
  @Input({ required: true })
  projectId!: string;

  userProject!: UserProjectDto;

  btnIncome = 'Income';
  btnCategory = 'Category';
  month: { budget: number, spend: number, overspend: number, remaining: number, earned: number; } = { budget: 0, spend: 0, overspend: 0, remaining: 0, earned: 0 };
  year: { budget: number, spend: number, overspend: number, remaining: number, earned: number; } = { budget: 0, spend: 0, overspend: 0, remaining: 0, earned: 0 };
  buttons: string[] = [this.btnIncome, this.btnCategory];
  showCopyPreviousButton = false;
  setHeight = false;
  currentMonthExpenses: ExpenseDto[] = [];
  yearIncomeExpenseChartData: ChartData<'bar'> = this.createEmptyYearBarChartData();
  yearExpenseCategoryChartData: ChartData<'doughnut'> = this.createEmptyYearCategoryChartData();

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

  yearExpenseCategoryChartOptions: ChartOptions<'doughnut'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom'
      },
      tooltip: {
        callbacks: {
          label: (context: TooltipItem<'doughnut'>) => this.formatCategoryTooltipLabel(context)
        }
      }
    }
  };

  private dataSource = new MatTableDataSource<TransactionDto>();
  private transactions: BehaviorSubject<TransactionDto[]> = new BehaviorSubject<TransactionDto[]>([new TransactionDto()]);
  transactions$: Observable<CdkTableDataSourceInput<TransactionDto>> = this.transactions.asObservable().pipe(
    map((transaction) => {
      const dataSource = this.dataSource;
      dataSource.data = transaction
      return dataSource;
    })
  );

  private categories: BehaviorSubject<CategoryDto[]> = new BehaviorSubject<CategoryDto[]>([new CategoryDto()]);
  categories$: Observable<CategoryDto[]> = this.categories.asObservable();

  constructor(
    private router: Router,
    private projectService: ProjectService,
    private categoryService: CategoryService,
    private incomeService: IncomeService,
    private dialog: MatDialog,
    private currentDateService: CurrentDateService,
    private globalService: GlobalService,
    private translateService: TranslateService
  ) {
  }

  ngOnInit(): void {
    this.projectService.selectedUserProject$.subscribe(userProject => {
      const defaultProject = new UserProjectDto();
      defaultProject.project = new ProjectDto();

      this.userProject = userProject ?? defaultProject;
    });

    this.projectService.getUserProject(this.projectId)
      .subscribe(res => {
        this.projectService.selectUserProject(res);
        this.userProject = res;
      });

    this.fillData(this.currentDateService.currentDate);
  }

  fillData(date: Date) {
    this.projectService.getYearlyInfo(this.projectId, date.getFullYear())
      .subscribe({
        next: res => {
          this.year = {
            budget: res.totalBudget,
            spend: res.totalSpend,
            overspend: res.totalOverspend,
            remaining: res.totalRemaining,
            earned: res.totalEarned
          };
        }
      })

    this.fillCategoriesData(date);
    this.fillYearCharts(date);

    this.incomeService.get(this.projectId, date)
      .pipe(map(incomes => IncomeDto.fromIncomes(incomes)))
      .subscribe({
        next: res => {
          this.month.earned = res.map(c => c.amount).reduce((acc, value) => acc + value, 0);
        }
      });

    this.projectService.getLatest(this.projectId, 5)
      .pipe(map(transactions => TransactionDto.fromTransactions(transactions)))
      .subscribe(
        {
          next: res => { this.transactions.next(res); }
        });
  }

  fillCategoriesData(date: Date) {
    this.categoryService.get(this.projectId, date)
    .pipe(map(categories => CategoryDto.fromCategories(categories)))
    .subscribe({
      next: res => {
        setTimeout(() => {
          this.setHeight = true;
        }, 100);

        this.categories.next(res);

        // Collect current month expenses for chart
        this.currentMonthExpenses = res.flatMap<ExpenseDto>(c =>
          c.expenses.flatMap<ExpenseDto>(expense =>
            expense.items && expense.items.length > 0
              ? expense.items.map<ExpenseDto>(item => ({
                id: item.id,
                amount: item.amount,
                date: item.date
              }) as ExpenseDto)
              : [expense]
          )
        );

        this.month.budget = res.map(c => c.getTotalBudget()).reduce((acc, value) => acc + value, 0);
        this.month.spend = res.map(c => c.getTotalSpend()).reduce((acc, value) => acc + value, 0);
        this.month.overspend = res.map(c => c.getTotalOverspend()).reduce((acc, value) => acc + value, 0);

        this.month.remaining = res.map(c => c.getTotalRemaining()).reduce((acc, value) => acc + value, 0);

        if (this.month.budget === 0) {
          const newDate = new Date(this.currentDateService.currentDate);
          newDate.setMonth(this.currentDateService.currentDate.getMonth() - 1, 1);

          this.categoryService.get(this.projectId, newDate)
            .pipe(map(categories => CategoryDto.fromCategories(categories)))
            .subscribe({
              next: res => {
                const previousBudget = res.map(c => c.getTotalBudget()).reduce((acc, value) => acc + value, 0);
                this.showCopyPreviousButton = previousBudget !== 0;
              }
            });
        } else {
          this.showCopyPreviousButton = false;
        }
      }
    });
  }

  private fillYearCharts(selectedDate: Date): void {
    const formatter = new Intl.DateTimeFormat(this.globalService.currentLanguage, { month: 'short' });
    const monthDates = Array.from({ length: 3 }, (_, index) => {
      const offset = index - 2;
      return new Date(selectedDate.getFullYear(), selectedDate.getMonth() + offset, 1);
    });

    const monthRequests = monthDates.map((monthDate) => {
      return forkJoin({
        incomes: this.incomeService.get(this.projectId, monthDate),
        categories: this.categoryService.get(this.projectId, monthDate)
      }).pipe(
        map(({ incomes, categories }) => ({
          label: formatter.format(monthDate),
          income: incomes.reduce((sum, income) => sum + Number(income.amount || 0), 0),
          categories
        }))
      );
    });

    forkJoin(monthRequests).subscribe({
      next: monthlyData => {
        const categoryTotals: Record<string, number> = {};

        monthlyData.forEach(month => {
          month.categories.forEach(category => {
            const expenseAmount = category.expenses?.reduce((sum, expense) => sum + Number(expense.amount || 0), 0) || 0;
            categoryTotals[category.name] = (categoryTotals[category.name] || 0) + expenseAmount;
          });
        });

        this.yearIncomeExpenseChartData = this.toYearBarChartData(
          monthlyData.map(item => item.label),
          monthlyData.map(item => item.income),
          monthlyData.map(item => item.categories.reduce((sum, category) =>
            sum + (category.expenses?.reduce((expenseSum, expense) => expenseSum + Number(expense.amount || 0), 0) || 0), 0))
        );
        this.yearExpenseCategoryChartData = this.toYearCategoryChartData(categoryTotals);
      },
      error: () => {
        this.yearIncomeExpenseChartData = this.createEmptyYearBarChartData();
        this.yearExpenseCategoryChartData = this.createEmptyYearCategoryChartData();
      }
    });
  }

  updateDate(newDate: Date) {
    this.fillData(newDate);
  }

  listCategories(): void {
    this.router.navigate([{ outlets: { modal: ['projects', this.projectId, 'categories'] } }]);

    this.dialog.open(PageModalComponent, {
      autoFocus: 'input'
    }).afterClosed().subscribe(() => {
      this.fillCategoriesData(this.currentDateService.currentDate);
      this.router.navigate([{ outlets: { modal: null } }]);
    });
  }

  selectCategory(id: string): void {
    this.router.navigate(['/projects', this.projectId, 'categories', id, 'expenses']);
  }

  selectCategories(): void {
    this.router.navigate(['/projects', this.projectId, 'categories']);
  }

  selectIncomes(): void {
    this.router.navigate(['/projects', this.projectId, 'incomes']);
  }

  openAnnualOverview(): void {
    this.router.navigate(['/projects', this.projectId, 'overview', 'annual']);
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

  getClassBasedOnCategory(category: CategoryDto): string {
    if (category.hasOverspend()) {
      return 'danger';
    } else if (category.hasRisk()) {
      return 'warning';
    }

    return '';
  }

  getBgClassBasedOnCategory(category: CategoryDto): string {
    if (category.hasRisk()) {
      return 'bg-warning';
    } else if (category.hasOverspend()) {
      return 'bg-danger';
    } else if (category.hasBudget()) {
      return 'bg-success';
    }

    return '';
  }

  copyPreviousBudget() {
    this.projectService.copyBudgetPreviousMonth(this.projectId, this.currentDateService.currentDate)
      .subscribe({
        next: () => {
          this.fillData(this.currentDateService.currentDate);
        }
      });
  }

  canAddOrEdit(): boolean {
    return this.userProject.role === Role.Admin || this.userProject.role === Role.Manager;
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

  private toYearCategoryChartData(categoryTotals: Record<string, number>): ChartData<'doughnut'> {
    const entries = Object.entries(categoryTotals)
      .filter(([, amount]) => amount > 0)
      .sort((a, b) => b[1] - a[1]);

    if (!entries.length) {
      return this.createEmptyYearCategoryChartData();
    }

    return {
      labels: entries.map(([name]) => name),
      datasets: [
        {
          data: entries.map(([, amount]) => this.roundAmount(amount)),
          backgroundColor: entries.map((_, index) => this.expenseColors[index % this.expenseColors.length]),
          borderColor: '#ffffff',
          borderWidth: 1
        }
      ]
    };
  }

  private createEmptyYearCategoryChartData(): ChartData<'doughnut'> {
    return {
      labels: [],
      datasets: [{ data: [] }]
    };
  }

  private formatCurrency(value: number): string {
    return new Intl.NumberFormat(this.globalService.currentLanguage, {
      style: 'currency',
      currency: this.globalService.currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  }

  private roundAmount(value: number | undefined): number {
    return Math.round(Number(value || 0));
  }

  private formatCategoryTooltipLabel(context: TooltipItem<'doughnut'>): string {
    const label = context.label || '';
    const value = Number(context.parsed) || 0;
    const total = context.dataset.data.reduce((sum, current) => sum + Number(current || 0), 0);
    const percentage = total > 0 ? (value / total) * 100 : 0;

    return `${label}: ${this.formatCurrency(value)} (${percentage.toFixed(1)}%)`;
  }
}
