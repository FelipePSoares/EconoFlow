import { CdkTableDataSourceInput } from '@angular/cdk/table';
import { CommonModule } from '@angular/common';
import { Component, DestroyRef, Input, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { BehaviorSubject, Observable, catchError, forkJoin, map, of, switchMap } from 'rxjs';
import { CurrentDateComponent } from '../../../core/components/current-date/current-date.component';
import { CategoryService } from '../../../core/services/category.service';
import { CurrentDateService } from '../../../core/services/current-date.service';
import { GlobalService } from '../../../core/services/global.service';
import { IncomeService } from '../../../core/services/income.service';
import { PlanService } from '../../../core/services/plan.service';
import { ProjectService } from '../../../core/services/project.service';
import { toLocalDate } from '../../../core/utils/date';
import { CurrencyFormatPipe } from '../../../core/utils/pipes/currency-format.pipe';
import { CategoryDto } from '../../category/models/category-dto';
import { IncomeDto } from '../../income/models/income-dto';
import { ProjectDto } from '../models/project-dto';
import { TransactionDto } from '../models/transaction-dto';
import { UserProjectDto } from '../models/user-project-dto';

@Component({
  selector: 'app-project-overview',
  imports: [
    CommonModule,
    CurrentDateComponent,
    MatTableModule,
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

  @Input({ required: true })
  projectId!: string;

  userProject!: UserProjectDto;
  currentLanguage = this.globalService.currentLanguage;
  totalIncome = 0;
  totalSavedInvested = 0;
  totalExpense = 0;

  private dataSource = new MatTableDataSource<TransactionDto>();
  private transactions = new BehaviorSubject<TransactionDto[]>([]);
  transactions$: Observable<CdkTableDataSourceInput<TransactionDto>> = this.transactions.asObservable().pipe(
    map(items => {
      this.dataSource.data = items;
      return this.dataSource;
    })
  );

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

  private fillData(date: Date): void {
    const startDate = new Date(date.getFullYear(), date.getMonth(), 1);
    const endDate = new Date(date.getFullYear(), date.getMonth() + 1, 1);

    this.incomeService.get(this.projectId, startDate, endDate)
      .pipe(map(incomes => IncomeDto.fromIncomes(incomes)))
      .subscribe({
        next: incomes => {
          this.totalIncome = incomes.reduce((sum, current) => sum + Number(current.amount || 0), 0);
        },
        error: () => {
          this.totalIncome = 0;
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
        this.totalSavedInvested = total;
      });

    this.categoryService.get(this.projectId, startDate, endDate)
      .subscribe({
        next: categories => {
          const categoryDtos = CategoryDto.fromCategories(categories);
          this.totalExpense = categoryDtos.reduce(
            (sum, category) => sum + category.getTotalSpend() + category.getTotalOverspend(),
            0
          );
        },
        error: () => {
          this.totalExpense = 0;
        }
      });

    this.projectService.getLatest(this.projectId, 5)
      .pipe(map(items => TransactionDto.fromTransactions(items)))
      .subscribe({
        next: transactions => this.transactions.next(transactions),
        error: () => this.transactions.next([])
      });
  }

}
