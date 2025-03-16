import { Component, Input, OnInit } from '@angular/core';
import { CurrentDateComponent } from '../../../core/components/current-date/current-date.component';
import { ReturnButtonComponent } from '../../../core/components/return-button/return-button.component';
import { ActivatedRoute, Router } from '@angular/router';
import { CategoryService } from '../../../core/services/category.service';
import { BehaviorSubject, map, Observable } from 'rxjs';
import { Category } from '../../../core/models/category';
import { CategoryDto } from '../../category/models/category-dto';
import { mapper } from '../../../core/utils/mappings/mapper';
import { IncomeService } from '../../../core/services/income.service';
import { Income } from '../../../core/models/income';
import { IncomeDto } from '../../income/models/income-dto';
import { CommonModule } from '@angular/common';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faArrowUp, faArrowDown } from '@fortawesome/free-solid-svg-icons';
import { ProjectService } from '../../../core/services/project.service';
import { CurrencyFormatPipe } from '../../../core/utils/pipes/currency-format.pipe';
import { dateUTC } from '../../../core/utils/date';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { TransactionDto } from '../models/transaction-dto';
import { Transaction } from 'src/app/core/models/transaction';
import { CdkTableDataSourceInput } from '@angular/cdk/table';
import { ProjectDto } from '../models/project-dto';
import { ErrorMessageService } from '../../../core/services/error-message.service';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { UserProjectDto } from '../models/user-project-dto';
import { Role } from '../../../core/enums/Role';

@Component({
    selector: 'app-detail-project',
    imports: [
        CommonModule,
        CurrentDateComponent,
        ReturnButtonComponent,
        FontAwesomeModule,
        CurrencyFormatPipe,
        MatButtonModule,
        MatIconModule,
        MatTableModule,
    ],
    templateUrl: './detail-project.component.html',
    styleUrl: './detail-project.component.css'
})

export class DetailProjectComponent implements OnInit {
  @Input({ required: true })
  projectId!: string;

  userProject!: UserProjectDto;

  faArrowUp = faArrowUp;
  faArrowDown = faArrowDown;
  btnIncome = 'Income';
  btnCategory = 'Category';
  month: { budget: number, spend: number, overspend: number, remaining: number, earned: number; } = { budget: 0, spend: 0, overspend: 0, remaining: 0, earned: 0 };
  year: { budget: number, spend: number, overspend: number, remaining: number, earned: number; } = { budget: 0, spend: 0, overspend: 0, remaining: 0, earned: 0 };
  buttons: string[] = [this.btnIncome, this.btnCategory];
  showCopyPreviousButton = false;

  private dataSource = new MatTableDataSource<TransactionDto>();
  private transactions: BehaviorSubject<TransactionDto[]> = new BehaviorSubject<TransactionDto[]>([new TransactionDto()]);
  transactions$: Observable<CdkTableDataSourceInput<TransactionDto>> = this.transactions.asObservable().pipe(
    map((transaction) => {
      const dataSource = this.dataSource;
      dataSource.data = transaction
      return dataSource;
    })
  );

  constructor(private router: Router, private route: ActivatedRoute, private projectService: ProjectService, private categoryService: CategoryService, private incomeService: IncomeService, private errorMessageService: ErrorMessageService) {
  }

  ngOnInit(): void {
    this.projectService.selectedUserProject$.subscribe(userProject => {
      this.userProject = userProject ?? new UserProjectDto();
    });

    this.projectService.getUserProject(this.projectId)
      .subscribe(res => {
        this.projectService.selectUserProject(res);
        this.userProject = res;
      });

    this.fillData(CurrentDateComponent.currentDate);
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

    this.categoryService.get(this.projectId, date)
      .pipe(map(categories => mapper.mapArray(categories, Category, CategoryDto)))
      .subscribe({
        next: res => {
          this.month.budget = res.map(c => c.getTotalBudget()).reduce((acc, value) => acc + value, 0);
          this.month.spend = res.map(c => c.getTotalSpend()).reduce((acc, value) => acc + value, 0);
          this.month.overspend = res.map(c => c.getTotalOverspend()).reduce((acc, value) => acc + value, 0);

          this.month.remaining = res.map(c => c.getTotalRemaining()).reduce((acc, value) => acc + value, 0);

          if (this.month.budget === 0) {
            var newDate = dateUTC(CurrentDateComponent.currentDate);
            newDate.setMonth(CurrentDateComponent.currentDate.getMonth() - 1, 1);

            this.categoryService.get(this.projectId, newDate)
              .pipe(map(categories => mapper.mapArray(categories, Category, CategoryDto)))
              .subscribe({
                next: res => {
                  let previousBudget = res.map(c => c.getTotalBudget()).reduce((acc, value) => acc + value, 0);
                  this.showCopyPreviousButton = previousBudget !== 0;
                }
              });
          } else {
            this.showCopyPreviousButton = false;
          }
        }
      });

    this.incomeService.get(this.projectId, date)
      .pipe(map(incomes => mapper.mapArray(incomes, Income, IncomeDto)))
      .subscribe({
        next: res => {
          this.month.earned = res.map(c => c.amount).reduce((acc, value) => acc + value, 0);
        }
      });

    this.projectService.getLatest(this.projectId, 5)
      .pipe(map(transactions => mapper.mapArray(transactions, Transaction, TransactionDto)))
      .subscribe(
        {
          next: res => { this.transactions.next(res); }
      });
  }

  updateDate(newDate: Date) {
    this.fillData(newDate);
  }

  selectCategories(): void {
    this.router.navigate(['/projects', this.projectId, 'categories']);
  }

  selectIncomes(): void {
    this.router.navigate(['/projects', this.projectId, 'incomes']);
  }

  getCurrentDate(): Date {
    return CurrentDateComponent.currentDate;
  }

  getPercentageSpend(spend: number, budget: number): number {
    return budget === 0 ? 0 : spend * 100 / budget;
  }

  getClassToProgressBar(percentage: number): string {
    if (percentage <= 75) {
      return 'bg-info';
    } else if (percentage <= 100) {
      return 'bg-warning';
    }

    return 'bg-danger';
  }

  getTextBasedOnPercentage(percentage: number): string {
    if (percentage <= 75) {
      return 'Expenses';
    } else if (percentage <= 100) {
      return 'Risk of overspend';
    }

    return 'Overspend /';
  }

  getClassBasedOnPercentage(percentage: number): string {
    if (percentage <= 75) {
      return '';
    } else if (percentage <= 100) {
      return 'warning';
    }

    return 'danger';
  }

  copyPreviousBudget() {
    this.projectService.copyBudgetPreviousMonth(this.projectId, CurrentDateComponent.currentDate)
      .subscribe({
        next: res => {
          this.fillData(CurrentDateComponent.currentDate);
        }
      });
  }
}
