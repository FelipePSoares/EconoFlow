import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AfterViewInit, ChangeDetectorRef, Component, DestroyRef, ElementRef, EventEmitter, Input, OnInit, Output, ViewChild, inject } from '@angular/core';
import { NgClass } from '@angular/common';
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { Subscription, debounceTime, firstValueFrom, map } from 'rxjs';
import { compare } from 'fast-json-patch';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { CurrencyMaskModule } from 'ng2-currency-mask';
import { Moment } from 'moment';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ExpenseService } from '../../../core/services/expense.service';
import { ExpenseItemDto } from '../models/expense-item-dto';
import { ExpenseDto } from '../models/expense-dto';
import { ExpensePatchModel } from '../models/expense-patch-model';
import { ExpenseAttachmentDto } from '../models/expense-attachment-dto';
import { ErrorMessageService } from '../../../core/services/error-message.service';
import { ApiErrorResponse } from '../../../core/models/error';
import { SnackbarComponent } from '../../../core/components/snackbar/snackbar.component';
import { DateAdapter } from '@angular/material/core';
import { formatDate, toLocalDate, toUtcMomentDate } from '../../../core/utils/date';
import { GlobalService } from '../../../core/services/global.service';
import { CurrentDateService } from '../../../core/services/current-date.service';
import { CategoryService } from '../../../core/services/category.service';
import { CategoryDto } from '../../category/models/category-dto';
import { MatSelect, MatSelectModule } from '@angular/material/select';
import { AttachmentType } from '../../../core/enums/attachment-type';

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
    MatSlideToggleModule,
    CurrencyMaskModule,
    MatSelectModule,
    NgClass,
    TranslateModule
],
    templateUrl: './add-expense-item.component.html',
    styleUrl: './add-expense-item.component.css'
})
export class AddExpenseItemComponent implements OnInit, AfterViewInit {
  private readonly maxAttachmentSizeBytes = 10 * 1024 * 1024;
  private readonly allowedProofMimeTypes = [
    'application/pdf',
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'image/heic',
    'image/heif'
  ];

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
  private cdr = inject(ChangeDetectorRef);
  private proofUploadSubscription?: Subscription;

  private expense?: ExpenseDto;
  private currentDate!: Moment;
  private editingExpenseItem: ExpenseItemDto | null = null;
  private expensesLoadToken = 0;
  deductibleProofAttachment: ExpenseAttachmentDto | null = null;
  pendingDeductibleProofAttachment: ExpenseAttachmentDto | null = null;
  pendingDeductibleProofFileName: string | null = null;
  expenseItemForm!: FormGroup;
  categories: CategoryDto[] = [];
  expenses: ExpenseDto[] = [];
  isLoadingExpenses = false;
  hasLoadedExpenses = false;
  isSaving = false;
  isProofOperationInProgress = false;
  proofUploadProgress = 0;
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
  @ViewChild('deductibleProofInput') deductibleProofInput?: ElementRef<HTMLInputElement>;

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

    this.currentDate = toUtcMomentDate(this.currentDateService.currentDate);
    this.editingExpenseItem = this.expenseItem && !this.isNewEntity(this.expenseItem.id)
      ? structuredClone(this.expenseItem)
      : null;
    this.deductibleProofAttachment = this.getDeductibleProofAttachment(this.editingExpenseItem);
    const initialDate = this.editingExpenseItem?.date
      ? toUtcMomentDate(this.editingExpenseItem.date)
      : this.currentDate;
    const initialExpenseId = this.expenseId ?? this.parentExpense?.id ?? '';

    this.expenseItemForm = new FormGroup({
      categoryId: new FormControl(this.categoryId ?? '', [Validators.required]),
      expenseId: new FormControl(initialExpenseId, [Validators.required]),
      name: new FormControl(this.editingExpenseItem?.name ?? '', [Validators.maxLength(100)]),
      date: new FormControl(initialDate, [Validators.required]),
      amount: new FormControl(this.editingExpenseItem?.amount ?? 0, [Validators.min(0)]),
      isDeductible: new FormControl(this.editingExpenseItem?.isDeductible ?? false)
    });

    if (this.categoryId) {
      this.categoryIdControl?.setValue(this.categoryId);
    }

    this.isDeductibleControl?.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(isDeductible => {
        if (!isDeductible) {
          this.clearPendingDeductibleProof();
        }
      });

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

  get isDeductibleControl() {
    return this.expenseItemForm.get('isDeductible');
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

  get canUploadDeductibleProof(): boolean {
    return !!(this.getSelectedCategoryId() && this.getSelectedExpenseId());
  }

  get proofProgressWidthClass(): string {
    const progress = Math.max(0, Math.min(100, Math.round(this.proofUploadProgress)));
    return `progress-width-${progress}`;
  }

  async save(): Promise<void> {
    if (!this.expenseItemForm.valid || this.isSaving || this.isProofOperationInProgress) {
      return;
    }

    const categoryId = this.getSelectedCategoryId();
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
    const isDeductible = !!this.isDeductibleControl?.value;
    const parsedAmount = amount === "" || amount === null ? 0 : amount;

    const baseExpense = structuredClone(currentExpense);
    const newExpense = structuredClone(baseExpense);
    const editingExpenseItemId = this.editingExpenseItem?.id ?? null;
    let previousDeductibleProofAttachment: ExpenseAttachmentDto | null = null;

    if (editingExpenseItemId) {
      const index = newExpense.items.findIndex(item => item.id === editingExpenseItemId);
      if (index === -1) {
        return;
      }

      previousDeductibleProofAttachment = this.getDeductibleProofAttachment(newExpense.items[index]);
      newExpense.items[index].name = name;
      newExpense.items[index].date = date;
      newExpense.items[index].amount = parsedAmount;
      newExpense.items[index].isDeductible = isDeductible;
      newExpense.items[index].temporaryAttachmentIds = isDeductible && this.pendingDeductibleProofAttachment
        ? [this.pendingDeductibleProofAttachment.id]
        : [];
    } else {
      const newExpenseItem = new ExpenseItemDto();
      newExpenseItem.name = name;
      newExpenseItem.date = date;
      newExpenseItem.amount = parsedAmount;
      newExpenseItem.isDeductible = isDeductible;
      newExpenseItem.attachments = [];
      newExpenseItem.temporaryAttachmentIds = isDeductible && this.pendingDeductibleProofAttachment
        ? [this.pendingDeductibleProofAttachment.id]
        : [];
      newExpenseItem.items = [];

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
    let savedExpense: ExpenseDto | null = null;

    try {
      const response = await firstValueFrom(this.expenseService.update(this.projectId, categoryId, currentExpense.id, patch));
      savedExpense = ExpenseDto.fromExpense(response);
      this.expense = savedExpense;

      if (editingExpenseItemId) {
        const savedItem = savedExpense.items.find(item => item.id === editingExpenseItemId) ?? null;
        const previousProof = previousDeductibleProofAttachment;
        const shouldRemoveExistingProof = !!previousProof
          && (!isDeductible || !!this.pendingDeductibleProofAttachment);

        if (savedItem && shouldRemoveExistingProof) {
          try {
            await this.deleteDeductibleProofAsync(categoryId, savedExpense.id, savedItem.id, previousProof.id);
            savedItem.attachments = (savedItem.attachments ?? [])
              .filter(attachment => attachment.id !== previousProof.id);
          } catch {
            this.snackBar.openErrorSnackbar(this.translateService.instant('DeductibleProofDeleteFailed'));
          }
        }

        if (savedItem) {
          this.editingExpenseItem = structuredClone(savedItem);
          this.deductibleProofAttachment = this.getDeductibleProofAttachment(savedItem);
        } else {
          this.deductibleProofAttachment = null;
        }
      }

      if (this.pendingDeductibleProofAttachment) {
        this.clearPendingDeductibleProof();
      }

      this.handleSaved(savedExpense);
    } catch (error) {
      this.httpErrors = true;
      this.errors = {};

      const typedError = error as ApiErrorResponse;
      if (typedError?.errors) {
        Object.entries(typedError.errors).forEach(([key, value]) => {
          const newKey = key.replace(/^Items\.\d+\./, '').replace(/^Items\./, '');
          this.errors[newKey] = value;
        });

        this.errorMessageService.setFormErrors(this.expenseItemForm, this.errors);
      } else {
        this.errors = { general: ['GenericError'] };
      }

      if (savedExpense && editingExpenseItemId) {
        const savedItem = savedExpense.items.find(item => item.id === editingExpenseItemId) ?? null;
        if (savedItem) {
          this.editingExpenseItem = structuredClone(savedItem);
          this.deductibleProofAttachment = this.getDeductibleProofAttachment(savedItem);
        }
      }
    } finally {
      this.isSaving = false;
      this.isProofOperationInProgress = false;
      this.proofUploadProgress = 0;
      this.cdr.detectChanges();
    }
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

  onDeductibleProofSelected(event: Event): void {
    const inputElement = event.target as HTMLInputElement;
    const file = inputElement.files?.[0];

    if (!file)
      return;

    if (!this.allowedProofMimeTypes.includes(file.type)) {
      this.snackBar.openErrorSnackbar(this.translateService.instant('DeductibleProofInvalidFileType'));
      inputElement.value = '';
      return;
    }

    if (file.size > this.maxAttachmentSizeBytes) {
      this.snackBar.openErrorSnackbar(this.translateService.instant('DeductibleProofFileSizeExceeded'));
      inputElement.value = '';
      return;
    }

    const categoryId = this.getSelectedCategoryId();
    const expenseId = this.getSelectedExpenseId();
    if (!categoryId || !expenseId) {
      inputElement.value = '';
      return;
    }

    this.pendingDeductibleProofFileName = file.name;
    this.pendingDeductibleProofAttachment = null;
    this.uploadTemporaryDeductibleProof(categoryId, expenseId, file);
  }

  async removeDeductibleProof(): Promise<void> {
    if (this.isSaving || this.isProofOperationInProgress) {
      return;
    }

    if (this.pendingDeductibleProofAttachment) {
      this.clearPendingDeductibleProof();
      return;
    }

    const editingExpenseItem = this.editingExpenseItem;
    const categoryId = this.getSelectedCategoryId();
    const expenseId = this.getSelectedExpenseId();
    const expenseItemId = editingExpenseItem?.id;
    if (!categoryId || !expenseId || !expenseItemId || !this.deductibleProofAttachment || !editingExpenseItem) {
      return;
    }

    try {
      await this.deleteDeductibleProofAsync(categoryId, expenseId, expenseItemId, this.deductibleProofAttachment.id);
      editingExpenseItem.attachments = (editingExpenseItem.attachments ?? [])
        .filter(attachment => attachment.id !== this.deductibleProofAttachment?.id);
      this.deductibleProofAttachment = null;
    } catch {
      this.snackBar.openErrorSnackbar(this.translateService.instant('DeductibleProofDeleteFailed'));
    } finally {
      this.isProofOperationInProgress = false;
      this.proofUploadProgress = 0;
      this.cdr.detectChanges();
    }
  }

  getDeductibleProofDownloadUrl(): string | null {
    const categoryId = this.getSelectedCategoryId();
    const expenseId = this.getSelectedExpenseId();
    const expenseItemId = this.editingExpenseItem?.id;
    const attachmentId = this.deductibleProofAttachment?.id;

    if (!categoryId || !expenseId || !expenseItemId || !attachmentId)
      return null;

    return this.expenseService.getExpenseItemAttachmentDownloadUrl(
      this.projectId,
      categoryId,
      expenseId,
      expenseItemId,
      attachmentId);
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
          this.deductibleProofAttachment = null;
          this.clearPendingDeductibleProof();
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

        if (this.editingExpenseItem?.id) {
          const loadedExpenseItem = res.items.find(item => item.id === this.editingExpenseItem?.id) ?? null;
          if (loadedExpenseItem) {
            this.editingExpenseItem = structuredClone(loadedExpenseItem);
            this.deductibleProofAttachment = this.getDeductibleProofAttachment(loadedExpenseItem);
          }
        }
      });
  }

  private getSelectedCategoryId(): string | null {
    return this.categoryId ?? this.categoryIdControl?.value ?? null;
  }

  private getSelectedExpenseId(): string | null {
    return this.parentExpense?.id ?? this.expenseIdControl?.value ?? this.expense?.id ?? null;
  }

  private getDeductibleProofAttachment(expenseItem: ExpenseItemDto | null): ExpenseAttachmentDto | null {
    return (expenseItem?.attachments ?? [])
      .find(attachment => attachment.attachmentType === AttachmentType.DeductibleProof) ?? null;
  }

  private clearPendingDeductibleProof(): void {
    this.proofUploadSubscription?.unsubscribe();
    this.proofUploadSubscription = undefined;
    this.isProofOperationInProgress = false;
    this.proofUploadProgress = 0;
    this.pendingDeductibleProofAttachment = null;
    this.pendingDeductibleProofFileName = null;

    if (this.deductibleProofInput?.nativeElement)
      this.deductibleProofInput.nativeElement.value = '';

    this.cdr.detectChanges();
  }

  private uploadTemporaryDeductibleProof(categoryId: string, expenseId: string, file: File): void {
    this.proofUploadSubscription?.unsubscribe();
    this.isProofOperationInProgress = true;
    this.proofUploadProgress = 0;
    this.cdr.detectChanges();

    this.proofUploadSubscription = this.expenseService
      .uploadTemporaryExpenseItemAttachmentWithProgress(this.projectId, categoryId, expenseId, file, AttachmentType.DeductibleProof)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: state => {
          if (state.kind === 'progress') {
            this.proofUploadProgress = state.percent;
            this.cdr.detectChanges();
            return;
          }

          this.pendingDeductibleProofAttachment = ExpenseAttachmentDto.fromExpenseAttachment(state.body);
          this.proofUploadProgress = 100;
          this.isProofOperationInProgress = false;
          this.proofUploadSubscription = undefined;
          this.cdr.detectChanges();
        },
        error: () => {
          this.snackBar.openErrorSnackbar(this.translateService.instant('DeductibleProofUploadFailed'));
          this.clearPendingDeductibleProof();
        }
      });
  }

  private async deleteDeductibleProofAsync(categoryId: string, expenseId: string, expenseItemId: string, attachmentId: string): Promise<void> {
    this.isProofOperationInProgress = true;
    this.proofUploadProgress = 0;
    this.cdr.detectChanges();

    const result = await firstValueFrom(
      this.expenseService.removeExpenseItemAttachment(this.projectId, categoryId, expenseId, expenseItemId, attachmentId)
    );

    if (!result)
      throw new Error('Expense item deductible proof delete failed.');
  }

  private resetExpenseSelection(): void {
    this.expenses = [];
    this.expense = undefined;
    this.deductibleProofAttachment = null;
    this.clearPendingDeductibleProof();
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
    this.snackBar.openSuccessSnackbar(this.translateService.instant('CreatedSuccess'));

    if (!this.inlineMode) {
      this.router.navigate([{ outlets: { modal: null } }]);
    }

    this.saved.emit(expense);
  }

  private isNewEntity(id: string | undefined): boolean {
    return !!id && id.startsWith('new-');
  }
}

