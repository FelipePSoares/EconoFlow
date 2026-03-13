import { CdkTableDataSourceInput } from '@angular/cdk/table';
import { Component, DestroyRef, inject, Input, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatDialog } from '@angular/material/dialog';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { NavigationEnd, Router, UrlSegment } from '@angular/router';
import { BehaviorSubject, filter, map, Observable } from 'rxjs';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { TranslateModule } from '@ngx-translate/core';
import { CurrentDateComponent } from '../../../core/components/current-date/current-date.component';
import { ReturnButtonComponent } from '../../../core/components/return-button/return-button.component';
import { CategoryService } from '../../../core/services/category.service';
import { CategoryDto } from '../../category/models/category-dto';
import { ProjectService } from '../../../core/services/project.service';
import { CurrencyFormatPipe } from '../../../core/utils/pipes/currency-format.pipe';
import { UserProjectDto } from '../models/user-project-dto';
import { Role } from '../../../core/enums/Role';
import { PageModalComponent } from '../../../core/components/page-modal/page-modal.component';
import { BudgetBarComponent } from '../../../core/components/budget-bar/budget-bar.component';
import { CurrentDateService } from '../../../core/services/current-date.service';
import { ProjectDto } from '../models/project-dto';
import { GlobalService } from '../../../core/services/global.service';
import { TranslateService } from '@ngx-translate/core';
import { Category } from '../../../core/models/category';
import { toLocalDate } from '../../../core/utils/date';
import { TransactionDto } from '../models/transaction-dto';

@Component({
    selector: 'app-detail-project',
    imports: [
      CommonModule,
      ReturnButtonComponent,
      CurrentDateComponent,
      BudgetBarComponent,
      CurrencyFormatPipe,
      MatButtonModule,
      MatTableModule,
      TranslateModule
    ],
    providers: [CurrencyFormatPipe],
    templateUrl: './detail-project.component.html',
    styleUrl: './detail-project.component.scss'
})

export class DetailProjectComponent implements OnInit {
  private destroyRef = inject(DestroyRef);
  private router = inject(Router);
  private projectService = inject(ProjectService);
  private categoryService = inject(CategoryService);
  private dialog = inject(MatDialog);
  private currentDateService = inject(CurrentDateService);
  private globalService = inject(GlobalService);
  private translateService = inject(TranslateService);
  private hadModalOutlet = false;
  currentLanguage = this.globalService.currentLanguage;

  @Input({ required: true })
  projectId!: string;

  userProject!: UserProjectDto;

  btnIncome = 'Income';
  btnCategory = 'Category';
  month: { budget: number, spend: number, overspend: number, remaining: number; } = { budget: 0, spend: 0, overspend: 0, remaining: 0 };
  buttons: string[] = [this.btnIncome, this.btnCategory];
  showCopyPreviousButton = false;
  setHeight = false;
  private categories: BehaviorSubject<CategoryDto[]> = new BehaviorSubject<CategoryDto[]>([new CategoryDto()]);
  categories$: Observable<CategoryDto[]> = this.categories.asObservable();
  private latestTransactionsDataSource = new MatTableDataSource<TransactionDto>();
  private latestTransactions = new BehaviorSubject<TransactionDto[]>([]);
  latestTransactions$: Observable<CdkTableDataSourceInput<TransactionDto>> = this.latestTransactions.asObservable().pipe(
    map(items => {
      this.latestTransactionsDataSource.data = items;
      return this.latestTransactionsDataSource;
    })
  );

  ngOnInit(): void {
    this.hadModalOutlet = this.hasModalOutlet(this.router.url);

    this.translateService.onLangChange
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(event => {
        this.currentLanguage = event.lang;
      });

    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(event => {
        const hasModalOutlet = this.hasModalOutlet(event.urlAfterRedirects);

        if (this.hadModalOutlet && !hasModalOutlet && this.isCurrentProjectDetailRoute(event.urlAfterRedirects)) {
          this.fillData(this.currentDateService.currentDate);
        }

        this.hadModalOutlet = hasModalOutlet;
      });

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
    const monthDates = Array.from({ length: 3 }, (_, index) => {
      const offset = index - 2;
      return new Date(date.getFullYear(), date.getMonth() + offset, 1);
    });
    const startDate = monthDates[0];
    const endDate = new Date(monthDates[2].getFullYear(), monthDates[2].getMonth() + 1, 1);

    this.categoryService.get(this.projectId, startDate, endDate)
      .subscribe({
        next: categories => {
          this.fillCategoriesData(date, categories);
        },
        error: () => {
          this.categories.next([]);
          this.month = { budget: 0, spend: 0, overspend: 0, remaining: 0 };
          this.showCopyPreviousButton = false;
        }
      });

    this.projectService.getLatest(this.projectId, 20)
      .pipe(
        map(items => TransactionDto.fromTransactions(items)
          .filter(transaction => transaction.type === 'Expense')
          .slice(0, 5))
      )
      .subscribe({
        next: transactions => this.latestTransactions.next(transactions),
        error: () => this.latestTransactions.next([])
      });
  }

  fillCategoriesData(date: Date, categoriesInRange: Category[]) {
    const currentMonthCategories = this.filterCategoriesByMonth(categoriesInRange, date);
    const currentMonthCategoriesDto = CategoryDto.fromCategories(currentMonthCategories);

    setTimeout(() => {
      this.setHeight = true;
    }, 100);

    this.categories.next(currentMonthCategoriesDto);

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

  updateDate(newDate: Date) {
    this.fillData(newDate);
  }

  previous(): void {
    this.router.navigate(['/projects', this.projectId]);
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

  getCategoryFillHeightClass(category: CategoryDto): string {
    if (!this.setHeight) {
      return 'card-fill-height-0';
    }

    const percentage = category.getPercentageSpend() ?? 0;
    const roundedHeight = this.clampToDisplayHeight(percentage);
    return `card-fill-height-${roundedHeight}`;
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

  private clampToDisplayHeight(value: number): number {
    if (!Number.isFinite(value)) {
      return 0;
    }

    const bounded = Math.max(0, Math.min(100, value));
    return Math.round(bounded / 5) * 5;
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

  private hasModalOutlet(url: string): boolean {
    return !!this.router.parseUrl(url).root.children['modal'];
  }

  private isCurrentProjectDetailRoute(url: string): boolean {
    const primarySegments = this.router.parseUrl(url).root.children['primary']?.segments ?? [];
    const projectIdSegment = this.getSegmentPath(primarySegments, 1);

    return this.getSegmentPath(primarySegments, 0) === 'projects'
      && projectIdSegment === this.projectId
      && this.getSegmentPath(primarySegments, 2) === 'expense-overview'
      && primarySegments.length === 3;
  }

  private getSegmentPath(segments: UrlSegment[], index: number): string {
    return segments.at(index)?.path ?? '';
  }
}
