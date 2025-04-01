import { CommonModule } from '@angular/common';
import { Component, Input, OnInit } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSliderModule } from '@angular/material/slider';
import { TranslateModule } from '@ngx-translate/core';
import { CurrencyMaskModule } from 'ng2-currency-mask';
import { BehaviorSubject, Observable } from 'rxjs';
import { MatIcon } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { faPlus } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { Router } from '@angular/router';
import { MatDialogRef } from '@angular/material/dialog';
import { GlobalService } from '../../../core/services/global.service';
import { CategoryService } from '../../../core/services/category.service';
import { DefaultCategory } from '../../../core/models/default-category';
import { CurrencyFormatPipe } from '../../../core/utils/pipes/currency-format.pipe';
import { PageModalComponent } from '../../../core/components/page-modal/page-modal.component';
import { ProjectService } from 'src/app/core/services/project.service';
import { ApiErrorResponse } from '../../../core/models/error';
import { CurrentDateComponent } from '../../../core/components/current-date/current-date.component';

@Component({
  selector: 'app-smart-setup',
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    FontAwesomeModule,
    MatInputModule,
    MatFormFieldModule,
    MatSliderModule,
    MatCardModule,
    TranslateModule,
    CurrencyMaskModule,
    CurrencyFormatPipe,
    MatIcon,
    MatButtonModule
  ],
  templateUrl: './smart-setup.component.html',
  styleUrl: './smart-setup.component.css'
})
export class SmartSetupComponent implements OnInit {
  faPlus = faPlus;
  httpErrors = false;
  errors!: Record<string, string[]>;

  annualIncome = 0;
  totalPercentage = 0;
  currencySymbol!: string;
  thousandSeparator!: string;
  decimalSeparator!: string;

  private defaultCategories!: DefaultCategory[];

  private categories: BehaviorSubject<DefaultCategory[]> = new BehaviorSubject<DefaultCategory[]>([new DefaultCategory()]);
  categories$: Observable<DefaultCategory[]> = this.categories.asObservable();

  @Input({ required: true })
  projectId!: string;

  constructor(
    private dialogRef: MatDialogRef<PageModalComponent>,
    private categoryService: CategoryService,
    private projectService: ProjectService,
    private router: Router,
    private globalService: GlobalService
  ) { }

  ngOnInit() {
    this.thousandSeparator = this.globalService.groupSeparator;
    this.decimalSeparator = this.globalService.decimalSeparator
    this.currencySymbol = this.globalService.currencySymbol;
    
    this.categoryService.getDefaultCategories(this.projectId).subscribe({
      next: (categories) => {
        this.categories.next(categories);
        this.defaultCategories = categories;

        this.calcularValores();
      },
      error: (error) => {
        console.error('Error fetching categories:', error);
      }
    });
  }

  remove(category: DefaultCategory): void {
    const newCategories = this.categories.value;
    newCategories.forEach((c, index) => {
      if (c.name === category.name) {
        newCategories.splice(index, 1);
      }
    });
    this.categories.next(newCategories);
    this.calcularValores();
  }

  save(): void {
    this.projectService.smartSetup(this.projectId, this.annualIncome, CurrentDateComponent.currentDate, this.categories.value)
    .subscribe(
      {
        next: () => {
          this.close();
        },
        error: (response: ApiErrorResponse) => {
          this.httpErrors = true;
          this.errors = response.errors;
        }
      });
  }

  close(): void {
    this.dialogRef.close();
    this.router.navigate(['/projects', this.projectId]);
  }

  calcularValores() {
    this.totalPercentage = this.categories.value.reduce((total, slider) => total + slider.percentage, 0);
  }

  formatLabel(value: number): string {
    return `${value}%`;
  }
}
