import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AfterViewInit, Component, DestroyRef, EventEmitter, Input, OnInit, Output, ViewChild, inject } from '@angular/core';
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
import { ExpensePatchModel } from '../models/expense-patch-model';
import { ErrorMessageService } from '../../../core/services/error-message.service';
import { ApiErrorResponse } from '../../../core/models/error';
import { SnackbarComponent } from '../../../core/components/snackbar/snackbar.component';
import { DateAdapter, MatNativeDateModule } from '@angular/material/core';
import { formatDate, toLocalDate } from '../../../core/utils/date';
import { GlobalService } from '../../../core/services/global.service';
import { CurrentDateService } from '../../../core/services/current-date.service';
import { CategoryService } from '../../../core/services/category.service';
import { CategoryDto } from '../../category/models/category-dto';
import { MatSelect, MatSelectModule } from '@angular/material/select';

@Component({
    selector: 'app-expense-item',
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
  private destroyRef = inject(DestroyRef);

  private expense?: ExpenseDto;
  private currentDate = new Date();
  private editingExpenseItem: ExpenseItemDto | null = null;
  private expensesLoadToken = 0;
  expenseItemForm!: FormGroup;
  categories: CategoryDto[] = [];
  expenses: ExpenseDto[] = [];
  isLoadingExpenses = false;
  hasLoadedExpenses = false;
  isSaving = false;
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

  @Input()
  parentExpense?: ExpenseDto | null;

  @Input()
  expenseItem?: ExpenseItemDto | null;

  @Input()
  inlineMode = false;

  @Output()
  saved = new EventEmitter<ExpenseDto>();

  @Output()
  canceled = new EventEmitter<void>();

  @ViewChild('categorySelect') categorySelect?: MatSelect;

  constructor() {
    this.thousandSeparator = this.globalService.groupSeparator;
    this.decimalSeparator = this.globalService.decimalSeparator;
    this.currencySymbol = this.globalService.currencySymbol;
   }

  ngOnInit(): void {
    this.dateAdapter.setLocale(this.globalService.currentLanguage);
    this.translateService.onLangChange
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(event => this.dateAdapter.setLocale(event.lang));

    this.currentDate = toLocalDate(this.currentDateService.currentDate);
    this.editingExpenseItem = this.expenseItem && !this.isNewEntity(this.expenseItem.id)
      ? structuredClone(this.expenseItem)
      : null;
    const initialDate = this.editingExpenseItem?.date
      ? toLocalDate(this.editingExpenseItem.date)
      : this.currentDate;
    const initialExpenseId = this.expenseId ?? this.parentExpense?.id ?? '';

    this.expenseItemForm = new FormGroup({
      categoryId: new FormControl(this.categoryId ?? '', [Validators.required]),
      expenseId: new FormControl(initialExpenseId, [Validators.required]),
      name: new FormControl(this.editingExpenseItem?.name ?? '', [Validators.maxLength(100)]),
      date: new FormControl(initialDate, [Validators.required]),
      amount: new FormControl(this.editingExpenseItem?.amount ?? 0, [Validators.min(0)])
    });

    if (this.categoryId) {
      this.categoryIdControl?.setValue(this.categoryId);
    }

    if (this.parentExpense) {
      this.expense = structuredClone(this.parentExpense);
      this.expenses = [this.expense];
      this.expenseIdControl?.setValue(this.expense.id, { emitEvent: false });
      this.hasLoadedExpenses = true;
      return;
    }

    if (this.showCategorySelector) {
      this.categoryService.get(this.projectId)
        .pipe(map(categories => CategoryDto.fromCategories(categories)))
        .subscribe(res => {
          this.categories = res.filter(category => !category.isArchived);
          const categoryId = this.categoryIdControl?.value;
          if (categoryId) {
            this.resetExpenseSelection();
            this.loadExpenses(categoryId, this.expenseIdControl?.value, this.getSelectedDate());
          }
        });
    }

    if (this.categoryIdControl?.value) {
      this.loadExpenses(this.categoryIdControl.value, this.expenseIdControl?.value, this.getSelectedDate());
    }

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
    if (!this.showCategorySelector) {
      return;
    }

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

  get isEditing(): boolean {
    return !!this.editingExpenseItem;
  }

  get showCategorySelector(): boolean {
    return !this.categoryId && !this.parentExpense;
  }

  get showExpenseSelector(): boolean {
    return !this.parentExpense;
  }

  save() {
    if (!this.expenseItemForm.valid || this.isSaving) {
      return;
    }

    const categoryId = this.categoryId ?? this.categoryIdControl?.value;
    if (!categoryId) {
      return;
    }

    const currentExpense = this.expense;
    if (!currentExpense) {
      return;
    }

    this.httpErrors = false;
    this.errors = {};

    const name = this.name?.value;
    const date: any = formatDate(this.date?.value);
    const amount = this.amount?.value;
    const parsedAmount = amount === "" || amount === null ? 0 : amount;

    const baseExpense = structuredClone(currentExpense);
    const newExpense = structuredClone(baseExpense);

    if (this.editingExpenseItem) {
      const index = newExpense.items.findIndex(item => item.id === this.editingExpenseItem?.id);
      if (index === -1) {
        return;
      }

      newExpense.items[index].name = name;
      newExpense.items[index].date = date;
      newExpense.items[index].amount = parsedAmount;
    } else {
      const newExpenseItem = new ExpenseItemDto();
      newExpenseItem.name = name;
      newExpenseItem.date = date;
      newExpenseItem.amount = parsedAmount;

      newExpense.items.push(newExpenseItem);
    }

    const patch = compare(
      ExpensePatchModel.fromExpense(baseExpense),
      ExpensePatchModel.fromExpense(newExpense)
    );
    if (patch.length === 0) {
      this.handleSaved(currentExpense);
      return;
    }

    this.isSaving = true;

    this.expenseService.update(this.projectId, categoryId, currentExpense.id, patch).subscribe({
      next: response => {
        this.isSaving = false;
        const dto = ExpenseDto.fromExpense(response);
        this.expense = dto;
        this.handleSaved(dto);
      },
      error: (response: ApiErrorResponse) => {
        this.isSaving = false;
        this.httpErrors = true;
        this.errors = {};

        Object.entries(response.errors).forEach(([key, value]) => {
          const newKey = key.replace(/^Items\.\d+\./, '').replace(/^Items\./, '');
          this.errors[newKey] = value;
        });

        this.errorMessageService.setFormErrors(this.expenseItemForm, this.errors);
      }
    });
  }

  cancel(): void {
    if (this.inlineMode) {
      this.canceled.emit();
      return;
    }

    this.router.navigate([{ outlets: { modal: null } }]);
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
    if (!value) {
      return null;
    }

    const parsed = toLocalDate(value);
    return isNaN(parsed.getTime()) ? null : parsed;
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

  private handleSaved(expense: ExpenseDto): void {
    if (!this.inlineMode) {
      this.snackBar.openSuccessSnackbar(this.translateService.instant('CreatedSuccess'));
      this.router.navigate([{ outlets: { modal: null } }]);
    }

    this.saved.emit(expense);
  }

  private isNewEntity(id: string | undefined): boolean {
    return !!id && id.startsWith('new-');
  }
}

