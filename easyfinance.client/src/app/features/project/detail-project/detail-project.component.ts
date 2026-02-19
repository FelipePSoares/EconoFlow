import { AfterViewInit, Component, inject, Input, OnInit, PLATFORM_ID } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { BehaviorSubject, map, Observable } from 'rxjs';
import { CommonModule, isPlatformBrowser } from '@angular/common';
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
import { Category } from '../../../core/models/category';

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
    providers: [CurrencyFormatPipe],
    templateUrl: './detail-project.component.html',
    styleUrl: './detail-project.component.scss'
})

export class DetailProjectComponent implements OnInit, AfterViewInit {
  readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  chartsReady = false;

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
    private translateService: TranslateService,
    private currencyFormatPipe: CurrencyFormatPipe
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

  ngAfterViewInit(): void {
    if (this.isBrowser) {
      setTimeout(() => {
        this.chartsReady = true;
      }, 0);
    }
  }

  fillData(date: Date) {
    const monthDates = Array.from({ length: 3 }, (_, index) => {
      const offset = index - 2;
      return new Date(date.getFullYear(), date.getMonth() + offset, 1);
    });
    const startDate = monthDates[0];
    const endDate = new Date(monthDates[2].getFullYear(), monthDates[2].getMonth() + 1, 1);

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

    this.categoryService.get(this.projectId, startDate, endDate)
      .subscribe({
        next: categories => {
          this.fillCategoriesData(date, categories);
          this.fillYearCharts(date, categories);
        },
        error: () => {
          this.categories.next([]);
          this.currentMonthExpenses = [];
          this.month = { budget: 0, spend: 0, overspend: 0, remaining: 0, earned: this.month.earned };
          this.showCopyPreviousButton = false;
        }
      });

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

  fillCategoriesData(date: Date, categoriesInRange: Category[]) {
    const currentMonthCategories = this.filterCategoriesByMonth(categoriesInRange, date);
    const currentMonthCategoriesDto = CategoryDto.fromCategories(currentMonthCategories);

    setTimeout(() => {
      this.setHeight = true;
    }, 100);

    this.categories.next(currentMonthCategoriesDto);

    // Collect current month expenses for chart
    this.currentMonthExpenses = currentMonthCategoriesDto.flatMap<ExpenseDto>(c =>
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

    this.month.budget = currentMonthCategoriesDto.map(c => c.getTotalBudget()).reduce((acc, value) => acc + value, 0);
    this.month.spend = currentMonthCategoriesDto.map(c => c.getTotalSpend()).reduce((acc, value) => acc + value, 0);
    this.month.overspend = currentMonthCategoriesDto.map(c => c.getTotalOverspend()).reduce((acc, value) => acc + value, 0);
    this.month.remaining = currentMonthCategoriesDto.map(c => c.getTotalRemaining()).reduce((acc, value) => acc + value, 0);

    const previousMonthDate = new Date(date.getFullYear(), date.getMonth() - 1, 1);
    const previousMonthCategories = this.filterCategoriesByMonth(categoriesInRange, previousMonthDate);
    const previousBudget = previousMonthCategories
      .flatMap(category => category.expenses || [])
      .reduce((acc, expense) => acc + Number(expense.budget || 0), 0);

    this.showCopyPreviousButton = this.month.budget === 0 && previousBudget !== 0;
  }

  private fillYearCharts(selectedDate: Date, categoriesInRange: Category[]): void {
    const formatter = new Intl.DateTimeFormat(this.globalService.currentLanguage, { month: 'short' });
    const monthDates = Array.from({ length: 3 }, (_, index) => {
      const offset = index - 2;
      return new Date(selectedDate.getFullYear(), selectedDate.getMonth() + offset, 1);
    });
    const startDate = monthDates[0];
    const endDate = new Date(monthDates[2].getFullYear(), monthDates[2].getMonth() + 1, 1);
    const monthKeys = monthDates.map(date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`);

    this.incomeService.get(this.projectId, startDate, endDate).subscribe({
      next: incomes => {
        const incomesByMonth = new Map<string, number>(monthKeys.map(key => [key, 0]));
        const expensesByMonth = new Map<string, number>(monthKeys.map(key => [key, 0]));

        incomes.forEach(income => {
          const incomeDate = new Date(income.date);
          const key = `${incomeDate.getFullYear()}-${String(incomeDate.getMonth() + 1).padStart(2, '0')}`;
          if (incomesByMonth.has(key)) {
            incomesByMonth.set(key, (incomesByMonth.get(key) || 0) + Number(income.amount || 0));
          }
        });

        categoriesInRange.forEach(category => {
          category.expenses?.forEach(expense => {
            const expenseDate = new Date(expense.date);
            const key = `${expenseDate.getFullYear()}-${String(expenseDate.getMonth() + 1).padStart(2, '0')}`;
            const amount = Number(expense.amount || 0);

            if (expensesByMonth.has(key)) {
              expensesByMonth.set(key, (expensesByMonth.get(key) || 0) + amount);
            }
          });
        });

        this.yearIncomeExpenseChartData = this.toYearBarChartData(
          monthDates.map(date => formatter.format(date)),
          monthKeys.map(key => incomesByMonth.get(key) || 0),
          monthKeys.map(key => expensesByMonth.get(key) || 0)
        );
      },
      error: () => {
        this.yearIncomeExpenseChartData = this.createEmptyYearBarChartData();
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
      this.fillData(this.currentDateService.currentDate);
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

  private createEmptyYearCategoryChartData(): ChartData<'doughnut'> {
    return {
      labels: [],
      datasets: [{ data: [] }]
    };
  }

  private formatCurrency(value: number): string {
    return this.currencyFormatPipe.transform(value, true) || '';
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

  private filterCategoriesByMonth(categories: Category[], date: Date): Category[] {
    const targetYear = date.getFullYear();
    const targetMonth = date.getMonth();

    return categories
      .map(category => ({
        ...category,
        expenses: (category.expenses || []).filter(expense => {
          const expenseDate = new Date(expense.date);
          return expenseDate.getFullYear() === targetYear && expenseDate.getMonth() === targetMonth;
        })
      }))
      .filter(category => category.expenses.length > 0 || !category.isArchived);
  }
}
