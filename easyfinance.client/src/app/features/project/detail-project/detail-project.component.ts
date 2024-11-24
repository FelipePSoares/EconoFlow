import { Component, Input, OnInit } from '@angular/core';
import { CurrentDateComponent } from '../../../core/components/current-date/current-date.component';
import { ReturnButtonComponent } from '../../../core/components/return-button/return-button.component';
import { AddButtonComponent } from '../../../core/components/add-button/add-button.component';
import { ActivatedRoute, Router } from '@angular/router';
import { CategoryService } from '../../../core/services/category.service';
import { map } from 'rxjs';
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

@Component({
  selector: 'app-detail-project',
  standalone: true,
  imports: [
    CommonModule,
    CurrentDateComponent,
    AddButtonComponent,
    ReturnButtonComponent,
    FontAwesomeModule,
    CurrencyFormatPipe,
  ],
  templateUrl: './detail-project.component.html',
  styleUrl: './detail-project.component.css'
})

export class DetailProjectComponent implements OnInit {
  faArrowUp = faArrowUp;
  faArrowDown = faArrowDown;
  btnIncome = 'Income';
  btnCategory = 'Category';
  @Input({ required: true })
  projectId!: string;
  projectName!: string;
  month: { budget: number, waste: number, remaining: number, earned: number; } = { budget: 0, waste: 0, remaining: 0, earned: 0 };
  year: { budget: number, waste: number, remaining: number, earned: number; } = { budget: 0, waste: 0, remaining: 0, earned: 0 };
  buttons: string[] = [this.btnIncome, this.btnCategory];

  constructor(private router: Router, private route: ActivatedRoute, private projectService: ProjectService, private categoryService: CategoryService, private incomeService: IncomeService) {
  }

  ngOnInit(): void {
    this.projectName = this.route.snapshot.queryParams['name'];
    this.fillData(CurrentDateComponent.currentDate);
  }

  fillData(date: Date) {
    this.projectService.getYearlyInfo(this.projectId, date.getFullYear())
      .subscribe({
        next: res => {
          this.year = {
            budget: res.totalBudget,
            waste: res.totalWaste,
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
          this.month.waste = res.map(c => c.getTotalWaste()).reduce((acc, value) => acc + value, 0);
          this.month.remaining = res.map(c => c.getTotalRemaining()).reduce((acc, value) => acc + value, 0);
        }
      });

    this.incomeService.get(this.projectId, date)
      .pipe(map(incomes => mapper.mapArray(incomes, Income, IncomeDto)))
      .subscribe({
        next: res => {
          this.month.earned = res.map(c => c.amount).reduce((acc, value) => acc + value, 0);
        }
      });
  }

  updateDate(newDate: Date) {
    this.fillData(newDate);
  }

  previous() {
    this.router.navigate(['projects']);
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

  getPercentageWaste(waste: number, budget: number): number {
    return budget === 0 ? 0 : waste * 100 / budget;
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

    return 'Overspend';
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
