import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AfterViewInit, Component, DestroyRef, ElementRef, EventEmitter, Input, OnInit, Output, ViewChild, inject } from '@angular/core';
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { firstValueFrom, map } from 'rxjs';
import { compare } from 'fast-json-patch';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { DateAdapter } from '@angular/material/core';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Moment } from 'moment';
import { ExpenseService } from '../../../core/services/expense.service';
import { ExpenseDto } from '../models/expense-dto';
import { ExpensePatchModel } from '../models/expense-patch-model';
import { ExpenseAttachmentDto } from '../models/expense-attachment-dto';
import { ErrorMessageService } from '../../../core/services/error-message.service';
import { ApiErrorResponse } from '../../../core/models/error';
import { formatDate, toUtcMomentDate } from '../../../core/utils/date';
import { CurrencyMaskModule } from 'ng2-currency-mask';
import { GlobalService } from '../../../core/services/global.service';
import { CurrentDateService } from '../../../core/services/current-date.service';
import { CategoryService } from '../../../core/services/category.service';
import { CategoryDto } from '../../category/models/category-dto';
import { MatSelect, MatSelectModule } from '@angular/material/select';
import { AttachmentType } from '../../../core/enums/attachment-type';
import { SnackbarComponent } from '../../../core/components/snackbar/snackbar.component';
import { Expense } from '../../../core/models/expense';

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
    MatSlideToggleModule,
    CurrencyMaskModule,
    MatSelectModule,
    TranslateModule
],
    templateUrl: './add-expense.component.html',
    styleUrl: './add-expense.component.css'
})
export class AddExpenseComponent implements OnInit, AfterViewInit {
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
  private globalService = inject(GlobalService);
  private currentDateService = inject(CurrentDateService);
  private dateAdapter = inject(DateAdapter<Date>);
  private translateService = inject(TranslateService);
  private snackBar = inject(SnackbarComponent);
  private destroyRef = inject(DestroyRef);

  private currentDate!: Moment;
  private editingExpense: ExpenseDto | null = null;
  deductibleProofAttachment: ExpenseAttachmentDto | null = null;
  pendingDeductibleProofFile: File | null = null;
  pendingDeductibleProofFileName: string | null = null;
  expenseForm!: FormGroup;
  categories: CategoryDto[] = [];
  isSaving = false;
  isProofOperationInProgress = false;
  proofUploadProgress = 0;
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
  @ViewChild('deductibleProofInput') deductibleProofInput?: ElementRef<HTMLInputElement>;

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

    this.currentDate = toUtcMomentDate(this.currentDateService.currentDate);
    this.editingExpense = this.expense && !this.isNewEntity(this.expense.id)
      ? structuredClone(this.expense)
      : null;
    this.deductibleProofAttachment = this.getDeductibleProofAttachment(this.editingExpense);

    const initialDate = this.editingExpense?.date
      ? toUtcMomentDate(this.editingExpense.date)
      : this.currentDate;

    this.expenseForm = new FormGroup({
      categoryId: new FormControl(this.categoryId ?? '', [Validators.required]),
      name: new FormControl(this.editingExpense?.name ?? '', [Validators.required, Validators.maxLength(100)]),
      date: new FormControl(initialDate, [Validators.required]),
      amount: new FormControl(this.editingExpense?.amount ?? 0, [Validators.min(0)]),
      budget: new FormControl(this.editingExpense?.budget ?? 0, [Validators.pattern('[0-9]*')]),
      isDeductible: new FormControl(this.editingExpense?.isDeductible ?? false),
    });

    if (this.categoryId) {
      this.categoryIdControl?.setValue(this.categoryId);
    }

    if ((this.editingExpense?.items?.length ?? 0) > 0) {
      this.expenseForm.controls['date'].disable();
      this.expenseForm.controls['amount'].disable();
    }

    this.isDeductibleControl?.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(isDeductible => {
        if (!isDeductible) {
          this.clearPendingDeductibleProof();
        }
      });

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
  get isDeductibleControl() {
    return this.expenseForm.get('isDeductible');
  }

  get isEditing(): boolean {
    return !!this.editingExpense;
  }

  get showCategorySelector(): boolean {
    return !this.categoryId;
  }

  async save(): Promise<void> {
    if (!this.expenseForm.valid || this.isSaving || this.isProofOperationInProgress) {
      return;
    }

    this.httpErrors = false;
    this.errors = {};

    const selectedCategoryId = this.categoryId ?? this.categoryIdControl?.value;
    if (!selectedCategoryId) {
      return;
    }

    const id = ''; // Id is generated by the server, so we don't have it at this point
    const name = this.name?.value;
    const date:any = formatDate(this.date?.value);
    const amount = this.amount?.value;
    const budget = this.budget?.value;
    const isDeductible = !!this.isDeductibleControl?.value;
    const parsedAmount = amount === "" || amount === null ? 0 : amount;
    const parsedBudget = budget === "" || budget === null ? 0 : budget;

    this.isSaving = true;
    let savedExpense: ExpenseDto | null = null;

    try {
      if (this.editingExpense) {
        const currentPatchModel = ExpensePatchModel.fromExpense(this.editingExpense);
        const updatedPatchModel = structuredClone(currentPatchModel);
        updatedPatchModel.name = name;
        updatedPatchModel.date = date;
        updatedPatchModel.amount = parsedAmount;
        updatedPatchModel.budget = parsedBudget;
        updatedPatchModel.isDeductible = isDeductible;
        updatedPatchModel.temporaryAttachmentIds = [];

        const patch = compare(currentPatchModel, updatedPatchModel);

        if (patch.length > 0) {
          const updateResponse = await firstValueFrom(this.expenseService.update(this.projectId, selectedCategoryId, this.editingExpense.id, patch));
          savedExpense = ExpenseDto.fromExpense(updateResponse);
        } else {
          savedExpense = structuredClone(this.editingExpense);
          savedExpense.name = name;
          savedExpense.amount = parsedAmount;
          savedExpense.budget = parsedBudget;
          savedExpense.isDeductible = isDeductible;
        }

        if (!isDeductible && this.deductibleProofAttachment) {
          await this.deleteDeductibleProofAsync(selectedCategoryId, savedExpense.id, this.deductibleProofAttachment.id);
          savedExpense.attachments = (savedExpense.attachments ?? [])
            .filter(attachment => attachment.id !== this.deductibleProofAttachment?.id);
          this.deductibleProofAttachment = null;
        }

        if (isDeductible && this.pendingDeductibleProofFile) {
          const uploadedProof = await this.uploadDeductibleProofAsync(selectedCategoryId, savedExpense.id, this.pendingDeductibleProofFile);
          savedExpense.attachments = (savedExpense.attachments ?? [])
            .filter(attachment => attachment.attachmentType !== AttachmentType.DeductibleProof);
          savedExpense.attachments.push(uploadedProof);
          this.deductibleProofAttachment = uploadedProof;
          this.clearPendingDeductibleProof();
        }

        this.editingExpense = structuredClone(savedExpense);
        this.handleSaved(savedExpense);
        return;
      }

      const newExpense: Expense = {
        id,
        name,
        date,
        amount: parsedAmount,
        budget: parsedBudget,
        isDeductible,
        attachments: [],
        items: [],
        temporaryAttachmentIds: []
      };

      if (isDeductible && this.pendingDeductibleProofFile) {
        const temporaryProof = await this.uploadTemporaryDeductibleProofAsync(selectedCategoryId, this.pendingDeductibleProofFile);
        newExpense.temporaryAttachmentIds = [temporaryProof.id];
      }

      const createResponse = await firstValueFrom(this.expenseService.add(this.projectId, selectedCategoryId, newExpense));
      savedExpense = ExpenseDto.fromExpense(createResponse);
      this.clearPendingDeductibleProof();
      this.handleSaved(savedExpense);
    } catch (error) {
      let apiError: ApiErrorResponse | null = null;

      if (typeof error === 'object' && error !== null && 'errors' in error) {
        const typedError = error as { errors?: Record<string, string[]> };
        if (typedError.errors)
          apiError = { errors: typedError.errors };
      }

      this.handleSaveError(apiError);

      if (savedExpense) {
        this.editingExpense = structuredClone(savedExpense);
        this.deductibleProofAttachment = this.getDeductibleProofAttachment(savedExpense);
      }
    } finally {
      this.isSaving = false;
      this.isProofOperationInProgress = false;
      this.proofUploadProgress = 0;
    }
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

    this.pendingDeductibleProofFile = file;
    this.pendingDeductibleProofFileName = file.name;
  }

  async removeDeductibleProof(): Promise<void> {
    if (this.isSaving || this.isProofOperationInProgress)
      return;

    if (this.pendingDeductibleProofFile) {
      this.clearPendingDeductibleProof();
      return;
    }

    if (!this.editingExpense || !this.deductibleProofAttachment)
      return;

    const selectedCategoryId = this.categoryId ?? this.categoryIdControl?.value;
    if (!selectedCategoryId)
      return;

    try {
      await this.deleteDeductibleProofAsync(selectedCategoryId, this.editingExpense.id, this.deductibleProofAttachment.id);
      this.editingExpense.attachments = (this.editingExpense.attachments ?? [])
        .filter(attachment => attachment.id !== this.deductibleProofAttachment?.id);
      this.deductibleProofAttachment = null;
    } catch {
      this.snackBar.openErrorSnackbar(this.translateService.instant('DeductibleProofDeleteFailed'));
    } finally {
      this.isProofOperationInProgress = false;
      this.proofUploadProgress = 0;
    }
  }

  getDeductibleProofDownloadUrl(): string | null {
    if (!this.editingExpense?.id || !this.deductibleProofAttachment?.id)
      return null;

    const selectedCategoryId = this.categoryId ?? this.categoryIdControl?.value;
    if (!selectedCategoryId)
      return null;

    return this.expenseService.getAttachmentDownloadUrl(
      this.projectId,
      selectedCategoryId,
      this.editingExpense.id,
      this.deductibleProofAttachment.id);
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

  private getDeductibleProofAttachment(expense: ExpenseDto | null): ExpenseAttachmentDto | null {
    return (expense?.attachments ?? [])
      .find(attachment => attachment.attachmentType === AttachmentType.DeductibleProof) ?? null;
  }
  private clearPendingDeductibleProof(): void {
    this.pendingDeductibleProofFile = null;
    this.pendingDeductibleProofFileName = null;

    if (this.deductibleProofInput?.nativeElement)
      this.deductibleProofInput.nativeElement.value = '';
  }

  private async uploadTemporaryDeductibleProofAsync(categoryId: string, file: File): Promise<ExpenseAttachmentDto> {
    this.isProofOperationInProgress = true;
    this.proofUploadProgress = 0;

    try {
      this.proofUploadProgress = 30;
      const uploadResponse = await firstValueFrom(
        this.expenseService.uploadTemporaryAttachment(this.projectId, categoryId, file, AttachmentType.DeductibleProof)
      );
      this.proofUploadProgress = 100;
      return ExpenseAttachmentDto.fromExpenseAttachment(uploadResponse);
    } catch {
      this.snackBar.openErrorSnackbar(this.translateService.instant('DeductibleProofUploadFailed'));
      throw new Error('Temporary deductible proof upload failed.');
    } finally {
      this.isProofOperationInProgress = false;
    }
  }

  private async uploadDeductibleProofAsync(categoryId: string, expenseId: string, file: File): Promise<ExpenseAttachmentDto> {
    this.isProofOperationInProgress = true;
    this.proofUploadProgress = 0;

    try {
      this.proofUploadProgress = 30;
      const uploadResponse = await firstValueFrom(
        this.expenseService.uploadAttachment(this.projectId, categoryId, expenseId, file, AttachmentType.DeductibleProof)
      );
      this.proofUploadProgress = 100;
      return ExpenseAttachmentDto.fromExpenseAttachment(uploadResponse);
    } catch {
      this.snackBar.openErrorSnackbar(this.translateService.instant('DeductibleProofUploadFailed'));
      throw new Error('Deductible proof upload failed.');
    } finally {
      this.isProofOperationInProgress = false;
    }
  }

  private async deleteDeductibleProofAsync(categoryId: string, expenseId: string, attachmentId: string): Promise<void> {
    this.isProofOperationInProgress = true;
    this.proofUploadProgress = 0;

    const result = await firstValueFrom(
      this.expenseService.removeAttachment(this.projectId, categoryId, expenseId, attachmentId)
    );

    if (!result)
      throw new Error('Deductible proof delete failed.');
  }


  private handleSaveError(error: ApiErrorResponse | null): void {
    this.httpErrors = true;

    if (error?.errors) {
      this.errors = error.errors;
      this.errorMessageService.setFormErrors(this.expenseForm, this.errors);
      return;
    }

    this.errors = { general: ['GenericError'] };
  }
}







