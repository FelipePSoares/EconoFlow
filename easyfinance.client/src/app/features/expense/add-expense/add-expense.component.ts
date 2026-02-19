import { AfterViewInit, Component, Input, OnInit, ViewChild } from '@angular/core';
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { map } from 'rxjs';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

import { MatDatepickerModule } from '@angular/material/datepicker';
import { DateAdapter, MatNativeDateModule } from '@angular/material/core';
import { TranslateModule } from '@ngx-translate/core';
import { ExpenseService } from '../../../core/services/expense.service';
import { ExpenseDto } from '../models/expense-dto';
import { ErrorMessageService } from '../../../core/services/error-message.service';
import { ApiErrorResponse } from '../../../core/models/error';
import { formatDate } from '../../../core/utils/date';
import { CurrencyMaskModule } from 'ng2-currency-mask';
import { GlobalService } from '../../../core/services/global.service';
import { CurrentDateService } from '../../../core/services/current-date.service';
import { CategoryService } from '../../../core/services/category.service';
import { CategoryDto } from '../../category/models/category-dto';
import { MatSelect, MatSelectModule } from '@angular/material/select';

@Component({
    selector: 'app-add-expense',
    imports: [
    FormsModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatDatepickerModule,
    MatNativeDateModule,
    CurrencyMaskModule,
    MatSelectModule,
    TranslateModule
],
    templateUrl: './add-expense.component.html',
    styleUrl: './add-expense.component.css'
})
export class AddExpenseComponent implements OnInit, AfterViewInit {
  private currentDate!: Date;
  expenseForm!: FormGroup;
  categories: CategoryDto[] = [];
  httpErrors = false;
  errors!: Record<string, string[]>;
  currencySymbol!: string;
  thousandSeparator!: string; 
  decimalSeparator!: string; 

  @Input({ required: true })
  projectId!: string;

  @Input()
  categoryId?: string;
  @ViewChild('categorySelect') categorySelect?: MatSelect;

  constructor(
    private expenseService: ExpenseService,
    private categoryService: CategoryService,
    private router: Router,
    private errorMessageService: ErrorMessageService,
    private globalService: GlobalService,
    private currentDateService: CurrentDateService,
    private dateAdapter: DateAdapter<Date>
  ) {
    this.thousandSeparator = this.globalService.groupSeparator;
    this.decimalSeparator = this.globalService.decimalSeparator
    this.currencySymbol = this.globalService.currencySymbol;
  }

  ngOnInit(): void {
    this.dateAdapter.setLocale(this.globalService.currentFormattingLocale);

    this.currentDate = new Date();
    if (this.currentDateService.currentDate.getFullYear() !== this.currentDate.getFullYear() || this.currentDateService.currentDate.getMonth() !== this.currentDate.getMonth()) {
      this.currentDate = this.currentDateService.currentDate;
    }

    this.expenseForm = new FormGroup({
      categoryId: new FormControl(this.categoryId ?? '', [Validators.required]),
      name: new FormControl('', [Validators.required, Validators.maxLength(100)]),
      date: new FormControl(this.currentDate, [Validators.required]),
      amount: new FormControl(0, [Validators.min(0)]),
      budget: new FormControl('', [Validators.pattern('[0-9]*')]),
    });

    this.categoryService.get(this.projectId)
      .pipe(map(categories => CategoryDto.fromCategories(categories)))
      .subscribe(res => {
        this.categories = res.filter(category => !category.isArchived);

        if (this.categoryId && this.categories.some(c => c.id === this.categoryId)) {
          this.categoryIdControl?.setValue(this.categoryId);
        }
      });
  }

  ngAfterViewInit(): void {
    setTimeout(() => this.categorySelect?.focus());
  }

  get categoryIdControl() {
    return this.expenseForm.get('categoryId');
  }
  get name() {
    return this.expenseForm.get('name');
  }
  get date() {
    return this.expenseForm.get('date');
  }
  get amount() {
    return this.expenseForm.get('amount');
  }
  get budget() {
    return this.expenseForm.get('budget');
  }

  save() {
    if (this.expenseForm.valid) {
      const selectedCategoryId = this.categoryIdControl?.value;
      if (!selectedCategoryId) {
        return;
      }

      const name = this.name?.value;
      const date: any = formatDate(this.date?.value);
      const amount = this.amount?.value;
      const budget = this.budget?.value;

      const newExpense = {
        name: name,
        date: date,
        amount: amount === "" || amount === null ? 0 : amount,
        budget: budget === "" || budget === null ? 0 : budget
      } as ExpenseDto;

      this.expenseService.add(this.projectId, selectedCategoryId, newExpense).subscribe({
        next: () => {
          this.router.navigate([{ outlets: { modal: null } }]);
        },
        error: (response: ApiErrorResponse) => {
          this.httpErrors = true;
          this.errors = response.errors;

          this.errorMessageService.setFormErrors(this.expenseForm, this.errors);
        }
      });
    }
  }

  getFormFieldErrors(fieldName: string): string[] {
    return this.errorMessageService.getFormFieldErrors(this.expenseForm, fieldName);
  }
}
