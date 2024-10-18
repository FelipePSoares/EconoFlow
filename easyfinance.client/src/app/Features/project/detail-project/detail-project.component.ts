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

@Component({
  selector: 'app-detail-project',
  standalone: true,
  imports: [
    CommonModule,
    CurrentDateComponent,
    AddButtonComponent,
    ReturnButtonComponent,
    FontAwesomeModule
  ],
  templateUrl: './detail-project.component.html',
  styleUrl: './detail-project.component.css'
})

export class DetailProjectComponent implements OnInit {
  faArrowUp = faArrowUp;
  faArrowDown = faArrowDown;
  btnIncome = 'Income';
  btnCategory = 'Category';
  private _currentDate!: Date;
  @Input({ required: true })
  projectId!: string;
  month: { budget: number, waste: number, remaining: number, earned: number; } = { budget: 0, waste: 0, remaining: 0, earned: 0 };
  year: { budget: number, waste: number, remaining: number, earned: number; } = { budget: 0, waste: 0, remaining: 0, earned: 0 };
  buttons: string[] = [this.btnIncome, this.btnCategory];

  get currentDate(): Date {
    return this._currentDate;
  }
  @Input()
  set currentDate(currentDate: Date) {
    if (!currentDate) {
      var date = this.route.snapshot.paramMap.get('currentDate');
      this._currentDate = date == null ? new Date() : new Date(date);
    } else {
      this._currentDate = new Date(currentDate);
    }

    this.projectService.getYearlyInfo(this.projectId, this._currentDate.getFullYear())
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

    this.categoryService.get(this.projectId, this._currentDate)
      .pipe(map(categories => mapper.mapArray(categories, Category, CategoryDto)))
      .subscribe({
        next: res => {
          this.month.budget = res.map(c => c.getTotalBudget()).reduce((acc, value) => acc + value, 0);
          this.month.waste = res.map(c => c.getTotalWaste()).reduce((acc, value) => acc + value, 0);
          this.month.remaining = res.map(c => c.getTotalRemaining()).reduce((acc, value) => acc + value, 0);
        }
      });

    this.incomeService.get(this.projectId, this.currentDate)
      .pipe(map(incomes => mapper.mapArray(incomes, Income, IncomeDto)))
      .subscribe({
        next: res => {
          this.month.earned = res.map(c => c.amount).reduce((acc, value) => acc + value, 0);
        }
      });
  }

  constructor(private router: Router, private route: ActivatedRoute, private projectService: ProjectService, private categoryService: CategoryService, private incomeService: IncomeService) {
  }

  ngOnInit(): void {
  }

  updateDate(newDate: Date) {
    this.currentDate = newDate;
  }

  previous() {
    this.router.navigate(['projects']);
  }

  selectCategories(): void {
    this.router.navigate(['/projects', this.projectId, 'categories', { currentDate: this.currentDate.toISOString().substring(0, 10) }]);
  }

  selectIncomes(): void {
    this.router.navigate(['/projects', this.projectId, 'incomes', { currentDate: this.currentDate.toISOString().substring(0, 10) }]);
  }

  getPercentageWaste(waste: number, budget: number): number {
    return budget === 0 ? 0 : waste * 100 / budget;
  }

  getClassToProgressBar(percentage: number): string {
    if (percentage <= 50) {
      return 'bg-info';
    } else if (percentage <= 100) {
      return 'bg-warning';
    }

    return 'bg-danger';
  }

  getTextBasedOnPercentage(percentage: number): string {
    if (percentage <= 50) {
      return 'Expenses';
    } else if (percentage <= 100) {
      return 'Risk of overspend';
    }

    return 'Overspend';
  }

  getClassBasedOnPercentage(percentage: number): string {
    if (percentage <= 50) {
      return '';
    } else if (percentage <= 100) {
      return 'warning';
    }

    return 'danger';
  }
}
