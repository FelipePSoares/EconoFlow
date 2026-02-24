import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AfterViewInit, Component, DestroyRef, EventEmitter, Input, OnInit, Output, ViewChild, inject } from '@angular/core';
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { map } from 'rxjs';
import { compare } from 'fast-json-patch';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

import { MatDatepickerModule } from '@angular/material/datepicker';
import { DateAdapter, MatNativeDateModule } from '@angular/material/core';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ExpenseService } from '../../../core/services/expense.service';
import { ExpenseDto } from '../models/expense-dto';
import { ExpensePatchModel } from '../models/expense-patch-model';
import { ErrorMessageService } from '../../../core/services/error-message.service';
import { ApiErrorResponse } from '../../../core/models/error';
import { formatDate, toLocalDate } from '../../../core/utils/date';
import { CurrencyMaskModule } from 'ng2-currency-mask';
import { GlobalService } from '../../../core/services/global.service';
import { CurrentDateService } from '../../../core/services/current-date.service';
import { CategoryService } from '../../../core/services/category.service';
import { CategoryDto } from '../../category/models/category-dto';
import { MatSelect, MatSelectModule } from '@angular/material/select';

@Component({
    selector: 'app-expense',
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
  private expenseService = inject(ExpenseService);
  private categoryService = inject(CategoryService);
  private router = inject(Router);
  private errorMessageService = inject(ErrorMessageService);
  private globalService = inject(GlobalService);
  private currentDateService = inject(CurrentDateService);
  private dateAdapter = inject(DateAdapter<Date>);
  private translateService = inject(TranslateService);
  private destroyRef = inject(DestroyRef);

  private currentDate = new Date();
  private editingExpense: ExpenseDto | null = null;
  expenseForm!: FormGroup;
  categories: CategoryDto[] = [];
  isSaving = false;
  httpErrors = false;
  errors!: Record<string, string[]>;
  currencySymbol!: string;
  thousandSeparator!: string; 
  decimalSeparator!: string; 

  @Input({ required: true })
  projectId!: string;

  @Input()
  categoryId?: string;

  @Input()
  expense?: ExpenseDto | null;

  @Input()
  inlineMode = false;

  @Output()
  saved = new EventEmitter<ExpenseDto>();

  @Output()
  canceled = new EventEmitter<void>();

  @ViewChild('categorySelect') categorySelect?: MatSelect;

  constructor() {
    this.thousandSeparator = this.globalService.groupSeparator;
    this.decimalSeparator = this.globalService.decimalSeparator
    this.currencySymbol = this.globalService.currencySymbol;
  }

  ngOnInit(): void {
    this.dateAdapter.setLocale(this.globalService.currentLanguage);
    this.translateService.onLangChange
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(event => this.dateAdapter.setLocale(event.lang));

    this.currentDate = toLocalDate(this.currentDateService.currentDate);
    this.editingExpense = this.expense && !this.isNewEntity(this.expense.id)
      ? structuredClone(this.expense)
      : null;

    const initialDate = this.editingExpense?.date
      ? toLocalDate(this.editingExpense.date)
      : this.currentDate;

    this.expenseForm = new FormGroup({
      categoryId: new FormControl(this.categoryId ?? '', [Validators.required]),
      name: new FormControl(this.editingExpense?.name ?? '', [Validators.required, Validators.maxLength(100)]),
      date: new FormControl(initialDate, [Validators.required]),
      amount: new FormControl(this.editingExpense?.amount ?? 0, [Validators.min(0)]),
      budget: new FormControl(this.editingExpense?.budget ?? 0, [Validators.pattern('[0-9]*')]),
    });

    if (this.categoryId) {
      this.categoryIdControl?.setValue(this.categoryId);
    }

    if ((this.editingExpense?.items?.length ?? 0) > 0) {
      this.expenseForm.controls['date'].disable();
      this.expenseForm.controls['amount'].disable();
    }

    if (this.showCategorySelector) {
      this.categoryService.get(this.projectId)
        .pipe(map(categories => CategoryDto.fromCategories(categories)))
        .subscribe(res => {
          this.categories = res.filter(category => !category.isArchived);

          if (this.categoryId && this.categories.some(c => c.id === this.categoryId)) {
            this.categoryIdControl?.setValue(this.categoryId);
          }
        });
    }
  }

  ngAfterViewInit(): void {
    if (!this.showCategorySelector) {
      return;
    }

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

  get isEditing(): boolean {
    return !!this.editingExpense;
  }

  get showCategorySelector(): boolean {
    return !this.categoryId;
  }

  save() {
    if (!this.expenseForm.valid || this.isSaving) {
      return;
    }

    this.httpErrors = false;
    this.errors = {};

    const selectedCategoryId = this.categoryId ?? this.categoryIdControl?.value;
    if (!selectedCategoryId) {
      return;
    }

    const name = this.name?.value;
    const date: any = formatDate(this.date?.value);
    const amount = this.amount?.value;
    const budget = this.budget?.value;
    const parsedAmount = amount === "" || amount === null ? 0 : amount;
    const parsedBudget = budget === "" || budget === null ? 0 : budget;

    this.isSaving = true;

    if (this.editingExpense) {
      const updatedExpense = structuredClone(this.editingExpense);
      updatedExpense.name = name;
      updatedExpense.date = date;
      updatedExpense.amount = parsedAmount;
      updatedExpense.budget = parsedBudget;

      const patch = compare(
        ExpensePatchModel.fromExpense(this.editingExpense),
        ExpensePatchModel.fromExpense(updatedExpense)
      );
      if (patch.length === 0) {
        this.isSaving = false;
        this.handleSaved(this.editingExpense);
        return;
      }

      this.expenseService.update(this.projectId, selectedCategoryId, this.editingExpense.id, patch).subscribe({
        next: response => {
          this.isSaving = false;
          this.handleSaved(ExpenseDto.fromExpense(response));
        },
        error: (response: ApiErrorResponse) => {
          this.isSaving = false;
          this.httpErrors = true;
          this.errors = response.errors;

          this.errorMessageService.setFormErrors(this.expenseForm, this.errors);
        }
      });
      return;
    }

    const newExpense = new ExpenseDto();
    newExpense.name = name;
    newExpense.date = date;
    newExpense.amount = parsedAmount;
    newExpense.budget = parsedBudget;

    this.expenseService.add(this.projectId, selectedCategoryId, newExpense).subscribe({
      next: response => {
        this.isSaving = false;
        this.handleSaved(ExpenseDto.fromExpense(response));
      },
      error: (response: ApiErrorResponse) => {
        this.isSaving = false;
        this.httpErrors = true;
        this.errors = response.errors;

        this.errorMessageService.setFormErrors(this.expenseForm, this.errors);
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
    return this.errorMessageService.getFormFieldErrors(this.expenseForm, fieldName);
  }

  private handleSaved(expense: ExpenseDto): void {
    if (this.inlineMode) {
      this.saved.emit(expense);
      return;
    }

    this.saved.emit(expense);
    this.router.navigate([{ outlets: { modal: null } }]);
  }

  private isNewEntity(id: string | undefined): boolean {
    return !!id && id.startsWith('new-');
  }
}



