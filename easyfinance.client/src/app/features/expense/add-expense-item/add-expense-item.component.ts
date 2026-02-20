import { AfterViewInit, Component, inject, Input, OnInit, ViewChild } from '@angular/core';
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { debounceTime, map } from 'rxjs';
import { compare } from 'fast-json-patch';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { CurrencyMaskModule } from 'ng2-currency-mask';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ExpenseService } from '../../../core/services/expense.service';
import { ExpenseItemDto } from '../models/expense-item-dto';
import { ExpenseDto } from '../models/expense-dto';
import { ErrorMessageService } from '../../../core/services/error-message.service';
import { ApiErrorResponse } from '../../../core/models/error';
import { SnackbarComponent } from '../../../core/components/snackbar/snackbar.component';
import { DateAdapter, MatNativeDateModule } from '@angular/material/core';
import { formatDate } from '../../../core/utils/date';
import { GlobalService } from '../../../core/services/global.service';
import { CurrentDateService } from '../../../core/services/current-date.service';
import { CategoryService } from '../../../core/services/category.service';
import { CategoryDto } from '../../category/models/category-dto';
import { MatSelect, MatSelectModule } from '@angular/material/select';

@Component({
    selector: 'app-add-expense-item',
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
    templateUrl: './add-expense-item.component.html',
    styleUrl: './add-expense-item.component.css'
})
export class AddExpenseItemComponent implements OnInit, AfterViewInit {
  private expenseService = inject(ExpenseService);
  private categoryService = inject(CategoryService);
  private router = inject(Router);
  private errorMessageService = inject(ErrorMessageService);
  private snackBar = inject(SnackbarComponent);
  private globalService = inject(GlobalService);
  private translateService = inject(TranslateService);
  private currentDateService = inject(CurrentDateService);
  private dateAdapter = inject(DateAdapter<Date>);

  private expense?: ExpenseDto;
  private currentDate!: Date;
  private expensesLoadToken = 0;
  expenseItemForm!: FormGroup;
  categories: CategoryDto[] = [];
  expenses: ExpenseDto[] = [];
  isLoadingExpenses = false;
  hasLoadedExpenses = false;
  thousandSeparator!: string; 
  decimalSeparator!: string; 
  httpErrors = false;
  errors!: Record<string, string[]>;
  currencySymbol!: string;

  @Input({ required: true })
  projectId!: string;

  @Input()
  categoryId?: string;

  @Input()
  expenseId?: string;
  @ViewChild('categorySelect') categorySelect?: MatSelect;

  constructor() {
    this.thousandSeparator = this.globalService.groupSeparator;
    this.decimalSeparator = this.globalService.decimalSeparator;
    this.currencySymbol = this.globalService.currencySymbol;
   }

  ngOnInit(): void {
    this.dateAdapter.setLocale(this.globalService.currentLanguage);

    this.currentDate = new Date();
    if (this.currentDateService.currentDate.getFullYear() !== this.currentDate.getFullYear() || this.currentDateService.currentDate.getMonth() !== this.currentDate.getMonth()) {
      this.currentDate = this.currentDateService.currentDate;
    }

    this.expenseItemForm = new FormGroup({
      categoryId: new FormControl(this.categoryId ?? '', [Validators.required]),
      expenseId: new FormControl({ value: this.expenseId ?? '', disabled: true }, [Validators.required]),
      name: new FormControl('', [Validators.maxLength(100)]),
      date: new FormControl(this.currentDate, [Validators.required]),
      amount: new FormControl(0, [Validators.min(0)])
    });

    this.categoryService.get(this.projectId)
      .pipe(map(categories => CategoryDto.fromCategories(categories)))
      .subscribe(res => {
        this.categories = res.filter(category => !category.isArchived);

        if (this.categoryIdControl?.value) {
          const preferredExpenseId = this.expenseIdControl?.value;
          this.resetExpenseSelection();
          this.loadExpenses(this.categoryIdControl.value, preferredExpenseId, this.getSelectedDate());
        }
      });

    this.categoryIdControl?.valueChanges.subscribe(categoryId => {
      this.invalidateExpenseLoads();
      this.hasLoadedExpenses = false;
      this.resetExpenseSelection();

      if (categoryId) {
        this.loadExpenses(categoryId, undefined, this.getSelectedDate());
      }
    });

    this.date?.valueChanges.pipe(debounceTime(250)).subscribe(() => {
      const categoryId = this.categoryIdControl?.value;
      if (!categoryId) {
        return;
      }

      const selectedDate = this.getSelectedDate();
      const preferredExpenseId = this.expenseIdControl?.value;
      this.invalidateExpenseLoads();
      this.hasLoadedExpenses = false;
      this.resetExpenseSelection();

      if (!selectedDate) {
        return;
      }

      this.loadExpenses(categoryId, preferredExpenseId, selectedDate);
    });

    this.expenseIdControl?.valueChanges.subscribe(expenseId => {
      const categoryId = this.categoryIdControl?.value;
      if (categoryId && expenseId) {
        this.loadExpenseDetails(categoryId, expenseId);
      }
    });
  }

  ngAfterViewInit(): void {
    setTimeout(() => this.categorySelect?.focus());
  }

  get categoryIdControl() {
    return this.expenseItemForm.get('categoryId');
  }

  get expenseIdControl() {
    return this.expenseItemForm.get('expenseId');
  }

  get name() {
    return this.expenseItemForm.get('name');
  }
  get date() {
    return this.expenseItemForm.get('date');
  }
  get amount() {
    return this.expenseItemForm.get('amount');
  }

  save() {
    if (this.expenseItemForm.valid) {
      const categoryId = this.categoryIdControl?.value;
      const expenseId = this.expenseIdControl?.value;

      if (!categoryId || !expenseId || !this.expense) {
        return;
      }

      const name = this.name?.value;
      const date: any = formatDate(this.date?.value);
      const amount = this.amount?.value;

      const newExpenseItem = ({
        name: name,
        date: date,
        amount: amount === "" || amount === null ? 0 : amount,
      }) as ExpenseItemDto;

      const newExpense = structuredClone(this.expense)
      newExpense.items.push(newExpenseItem);

      const patch = compare(this.expense, newExpense);

      this.expenseService.update(this.projectId, categoryId, expenseId, patch).subscribe({
        next: () => {
          this.snackBar.openSuccessSnackbar(this.translateService.instant('CreatedSuccess'));
          this.router.navigate([{ outlets: { modal: null } }]);
        },
        error: (response: ApiErrorResponse) => {
          this.httpErrors = true;
          this.errors = {};

          Object.entries(response.errors).forEach(([key, value]) => {
            const newKey = key.startsWith('Items.') ? key.replace(/^Items\./, '') : key;
            this.errors[newKey] = value;
          });

          this.errorMessageService.setFormErrors(this.expenseItemForm, this.errors);
        }
      });
    }
  }

  getFormFieldErrors(fieldName: string): string[] {
    return this.errorMessageService.getFormFieldErrors(this.expenseItemForm, fieldName);
  }

  private loadExpenses(categoryId: string, preferredExpenseId?: string, selectedDate?: Date | null): void {
    if (!selectedDate) {
      return;
    }

    const currentLoadToken = ++this.expensesLoadToken;
    this.isLoadingExpenses = true;
    this.hasLoadedExpenses = false;

    this.expenseService.get(this.projectId, categoryId, selectedDate)
      .pipe(map(expenses => ExpenseDto.fromExpenses(expenses)))
      .subscribe(expenses => {
        if (currentLoadToken !== this.expensesLoadToken) {
          return;
        }

        this.expenses = expenses;

        const selectedExpenseId = preferredExpenseId && this.expenses.some(expense => expense.id === preferredExpenseId)
          ? preferredExpenseId
          : '';

        this.expenseIdControl?.setValue(selectedExpenseId, { emitEvent: false });
        this.updateExpenseSelectionAvailability();

        if (selectedExpenseId) {
          this.loadExpenseDetails(categoryId, selectedExpenseId);
        } else {
          this.expense = undefined;
        }

        this.isLoadingExpenses = false;
        this.hasLoadedExpenses = true;
      }, () => {
        if (currentLoadToken !== this.expensesLoadToken) {
          return;
        }

        this.resetExpenseSelection();
        this.isLoadingExpenses = false;
        this.hasLoadedExpenses = true;
      });
  }

  private getSelectedDate(): Date | null {
    if (this.date?.invalid) {
      return null;
    }

    const value = this.date?.value;

    if (value instanceof Date && !isNaN(value.getTime())) {
      return value;
    }

    return null;
  }

  private loadExpenseDetails(categoryId: string, expenseId: string): void {
    this.expenseService.getById(this.projectId, categoryId, expenseId)
      .pipe(map(expense => ExpenseDto.fromExpense(expense)))
      .subscribe(res => {
        this.expense = res;
      });
  }

  private resetExpenseSelection(): void {
    this.expenses = [];
    this.expense = undefined;
    this.expenseIdControl?.setValue('', { emitEvent: false });
    this.expenseIdControl?.disable({ emitEvent: false });
  }

  private updateExpenseSelectionAvailability(): void {
    if (this.expenses.length > 0) {
      this.expenseIdControl?.enable({ emitEvent: false });
      return;
    }

    this.expenseIdControl?.disable({ emitEvent: false });
  }

  private invalidateExpenseLoads(): void {
    this.expensesLoadToken++;
    this.isLoadingExpenses = false;
  }
}
