import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AfterViewInit, ChangeDetectorRef, Component, DestroyRef, ElementRef, EventEmitter, Input, OnInit, Output, ViewChild, inject } from '@angular/core';
import { NgClass } from '@angular/common';
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { Subscription, firstValueFrom, map } from 'rxjs';
import { compare } from 'fast-json-patch';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { DateAdapter } from '@angular/material/core';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
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
import { ProjectService } from '../../../core/services/project.service';
import { ProjectTaxYearSettings } from '../../../core/models/project-tax-year-settings';
import { computeTaxYearPeriod, hasTaxYearRuleConfigured } from '../../../core/utils/tax-year';
import { ConfigureTaxYearRuleDialogComponent } from '../../../core/components/configure-tax-year-rule-dialog/configure-tax-year-rule-dialog.component';
import { PageModalComponent, PageModalDialogData } from '../../../core/components/page-modal/page-modal.component';

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
    NgClass,
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
  private cdr = inject(ChangeDetectorRef);
  private dialog = inject(MatDialog);
  private projectService = inject(ProjectService);
  private proofUploadSubscription?: Subscription;

  private currentDate!: Moment;
  private editingExpense: ExpenseDto | null = null;
  private initialCategoryId: string | null = null;
  deductibleProofAttachment: ExpenseAttachmentDto | null = null;
  pendingDeductibleProofAttachment: ExpenseAttachmentDto | null = null;
  pendingDeductibleProofFileName: string | null = null;
  expenseForm!: FormGroup;
  categories: CategoryDto[] = [];
  projectTaxYearSettings: ProjectTaxYearSettings | null = null;
  currentExpenseTaxYearId: string | null = null;
  currentExpenseTaxYearLabel: string | null = null;
  isSaving = false;
  isProofOperationInProgress = false;
  proofUploadProgress = 0;
  isTaxYearDialogInProgress = false;
  isProgrammaticDeductibleToggle = false;
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
  expenseId?: string;

  @Input()
  selectedTaxYearId?: string;

  @Input()
  expense?: ExpenseDto | null;

  @Input()
  inlineMode = false;

  @Input()
  moveMode = false;

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

  async ngOnInit(): Promise<void> {
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
    this.initialCategoryId = this.editingExpense
      ? (this.categoryIdControl?.value ?? this.categoryId ?? null)
      : null;

    this.updateDateAndAmountControlState();

    await this.loadProjectTaxYearSettings();
    await this.loadExpenseFromRouteIfNeeded();

    this.isDeductibleControl?.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(isDeductible => {
        if (this.isProgrammaticDeductibleToggle) {
          return;
        }

        if (!isDeductible) {
          this.clearPendingDeductibleProof();
          this.clearDeductibleGroupContext();
          return;
        }

        void this.ensureTaxYearRuleConfiguredForDeductible();
      });

    this.date?.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        if (this.isDeductibleControl?.value) {
          void this.refreshDeductibleGroupContext();
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

    if (this.isDeductibleControl?.value) {
      await this.refreshDeductibleGroupContext();
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
    return !this.categoryId || (this.moveMode && this.isEditing);
  }

  get canUploadDeductibleProof(): boolean {
    return !!this.getSelectedCategoryId();
  }

  get proofProgressWidthClass(): string {
    const progress = Math.max(0, Math.min(100, Math.round(this.proofUploadProgress)));
    return `progress-width-${progress}`;
  }

  get hasTaxYearContextMismatch(): boolean {
    return !!this.selectedTaxYearId
      && !!this.currentExpenseTaxYearId
      && this.selectedTaxYearId !== this.currentExpenseTaxYearId;
  }

  async save(): Promise<void> {
    if (!this.expenseForm.valid || this.isSaving || this.isProofOperationInProgress) {
      return;
    }

    this.httpErrors = false;
    this.errors = {};

    const selectedCategoryId = this.getSelectedCategoryId();
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
        const sourceCategoryId = this.initialCategoryId ?? selectedCategoryId;
        if (!sourceCategoryId) {
          return;
        }

        const currentPatchModel = ExpensePatchModel.fromExpense(this.editingExpense);
        const updatedPatchModel = structuredClone(currentPatchModel);
        updatedPatchModel.name = name;
        updatedPatchModel.date = date;
        updatedPatchModel.amount = parsedAmount;
        updatedPatchModel.budget = parsedBudget;
        updatedPatchModel.isDeductible = isDeductible;
        updatedPatchModel.temporaryAttachmentIds = isDeductible && this.pendingDeductibleProofAttachment
          ? [this.pendingDeductibleProofAttachment.id]
          : [];

        const patch = compare(currentPatchModel, updatedPatchModel);

        if (patch.length > 0) {
          const updateResponse = await firstValueFrom(this.expenseService.update(this.projectId, sourceCategoryId, this.editingExpense.id, patch));
          savedExpense = ExpenseDto.fromExpense(updateResponse);
        } else {
          savedExpense = structuredClone(this.editingExpense);
          savedExpense.name = name;
          savedExpense.amount = parsedAmount;
          savedExpense.budget = parsedBudget;
          savedExpense.isDeductible = isDeductible;
        }

        if (!isDeductible && this.deductibleProofAttachment) {
          await this.deleteDeductibleProofAsync(sourceCategoryId, savedExpense.id, this.deductibleProofAttachment.id);
          savedExpense.attachments = (savedExpense.attachments ?? [])
            .filter(attachment => attachment.id !== this.deductibleProofAttachment?.id);
          this.deductibleProofAttachment = null;
        }

        if (sourceCategoryId !== selectedCategoryId) {
          const moved = await firstValueFrom(this.expenseService.moveExpense(
            this.projectId,
            sourceCategoryId,
            savedExpense.id,
            selectedCategoryId
          ));

          if (!moved) {
            throw new Error('Expense move failed.');
          }

          this.snackBar.openSuccessSnackbar(this.translateService.instant('MovedSuccess'));
        }

        if (this.pendingDeductibleProofAttachment) {
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

      if (isDeductible && this.pendingDeductibleProofAttachment) {
        newExpense.temporaryAttachmentIds = [this.pendingDeductibleProofAttachment.id];
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
      this.cdr.detectChanges();
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

    const selectedCategoryId = this.getSelectedCategoryId();
    if (!selectedCategoryId) {
      this.categoryIdControl?.markAsTouched();
      inputElement.value = '';
      return;
    }

    this.pendingDeductibleProofFileName = file.name;
    this.pendingDeductibleProofAttachment = null;
    this.uploadTemporaryDeductibleProof(selectedCategoryId, file);
  }

  async removeDeductibleProof(): Promise<void> {
    if (this.isSaving || this.isProofOperationInProgress)
      return;

    if (this.pendingDeductibleProofAttachment) {
      this.clearPendingDeductibleProof();
      return;
    }

    if (!this.editingExpense || !this.deductibleProofAttachment)
      return;

    const selectedCategoryId = this.getSelectedCategoryId();
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
      this.cdr.detectChanges();
    }
  }

  getDeductibleProofDownloadUrl(): string | null {
    if (!this.editingExpense?.id || !this.deductibleProofAttachment?.id)
      return null;

    const selectedCategoryId = this.getSelectedCategoryId();
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

  private async loadExpenseFromRouteIfNeeded(): Promise<void> {
    if (this.editingExpense || !this.categoryId || !this.expenseId) {
      return;
    }

    try {
      const loadedExpense = await firstValueFrom(
        this.expenseService.getById(this.projectId, this.categoryId, this.expenseId)
          .pipe(map(expense => ExpenseDto.fromExpense(expense)))
      );

      this.editingExpense = loadedExpense;
      this.deductibleProofAttachment = this.getDeductibleProofAttachment(this.editingExpense);
      this.initialCategoryId = this.categoryId ?? this.categoryIdControl?.value ?? null;

      this.expenseForm.patchValue({
        categoryId: this.categoryId,
        name: loadedExpense.name ?? '',
        date: toUtcMomentDate(loadedExpense.date),
        amount: loadedExpense.amount ?? 0,
        budget: loadedExpense.budget ?? 0,
        isDeductible: loadedExpense.isDeductible ?? false
      });

      this.updateDateAndAmountControlState();
      this.cdr.detectChanges();
    } catch {
      this.httpErrors = true;
      this.errors = { general: ['GenericError'] };
    }
  }

  private async loadProjectTaxYearSettings(): Promise<void> {
    try {
      this.projectTaxYearSettings = await firstValueFrom(this.projectService.getTaxYearSettings(this.projectId));
    } catch {
      this.projectTaxYearSettings = null;
    }
  }

  private async ensureTaxYearRuleConfiguredForDeductible(): Promise<void> {
    if (this.isTaxYearDialogInProgress) {
      return;
    }

    this.isTaxYearDialogInProgress = true;

    try {
      await this.loadProjectTaxYearSettings();
      if (hasTaxYearRuleConfigured(this.projectTaxYearSettings)) {
        await this.refreshDeductibleGroupContext();
        return;
      }

      let dialogRef: MatDialogRef<PageModalComponent, ProjectTaxYearSettings | null>;
      const componentInputs = {
        projectId: this.projectId,
        initialSettings: this.projectTaxYearSettings,
        closeDialog: (result: ProjectTaxYearSettings | null) => dialogRef.close(result)
      };

      dialogRef = this.dialog.open<
        PageModalComponent,
        PageModalDialogData,
        ProjectTaxYearSettings | null
      >(PageModalComponent, {
        autoFocus: false,
        width: '560px',
        maxWidth: '95vw',
        disableClose: true,
        data: {
          title: 'ConfigureTaxYearRuleModalTitle',
          hasCloseButton: false,
          component: ConfigureTaxYearRuleDialogComponent,
          componentInputs
        }
      });

      const configuredSettings = await firstValueFrom(dialogRef.afterClosed());
      if (!configuredSettings) {
        this.setDeductibleToggle(false);
        this.clearDeductibleGroupContext();
        this.snackBar.openErrorSnackbar(this.translateService.instant('TaxYearRuleConfigurationCanceled'));
        return;
      }

      this.projectTaxYearSettings = configuredSettings;
      await this.refreshDeductibleGroupContext();
    } catch {
      this.setDeductibleToggle(false);
      this.clearDeductibleGroupContext();
      this.snackBar.openErrorSnackbar(this.translateService.instant('TaxYearRuleRequiredBeforeDeductible'));
    } finally {
      this.isTaxYearDialogInProgress = false;
    }
  }

  private setDeductibleToggle(value: boolean): void {
    this.isProgrammaticDeductibleToggle = true;
    this.isDeductibleControl?.setValue(value);
    this.isProgrammaticDeductibleToggle = false;
  }

  private clearDeductibleGroupContext(): void {
    this.currentExpenseTaxYearId = null;
    this.currentExpenseTaxYearLabel = null;
  }

  private async refreshDeductibleGroupContext(): Promise<void> {
    if (!this.isDeductibleControl?.value) {
      this.clearDeductibleGroupContext();
      return;
    }

    if (!hasTaxYearRuleConfigured(this.projectTaxYearSettings)) {
      this.clearDeductibleGroupContext();
      return;
    }

    const dateValue = this.date?.value;
    if (!dateValue) {
      this.clearDeductibleGroupContext();
      return;
    }

    const period = computeTaxYearPeriod(this.projectTaxYearSettings, dateValue);
    if (!period) {
      this.clearDeductibleGroupContext();
      return;
    }

    this.currentExpenseTaxYearId = period.taxYearId;
    this.currentExpenseTaxYearLabel = period.label;
  }

  private updateDateAndAmountControlState(): void {
    const hasItems = (this.editingExpense?.items?.length ?? 0) > 0;
    const dateControl = this.expenseForm.controls['date'];
    const amountControl = this.expenseForm.controls['amount'];

    if (hasItems) {
      dateControl.disable({ emitEvent: false });
      amountControl.disable({ emitEvent: false });
      return;
    }

    dateControl.enable({ emitEvent: false });
    amountControl.enable({ emitEvent: false });
  }

  private getDeductibleProofAttachment(expense: ExpenseDto | null): ExpenseAttachmentDto | null {
    return (expense?.attachments ?? [])
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

  private uploadTemporaryDeductibleProof(categoryId: string, file: File): void {
    this.proofUploadSubscription?.unsubscribe();
    this.isProofOperationInProgress = true;
    this.proofUploadProgress = 0;
    this.cdr.detectChanges();

    this.proofUploadSubscription = this.expenseService
      .uploadTemporaryAttachmentWithProgress(this.projectId, categoryId, file, AttachmentType.DeductibleProof)
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

  private async deleteDeductibleProofAsync(categoryId: string, expenseId: string, attachmentId: string): Promise<void> {
    this.isProofOperationInProgress = true;
    this.proofUploadProgress = 0;
    this.cdr.detectChanges();

    const result = await firstValueFrom(
      this.expenseService.removeAttachment(this.projectId, categoryId, expenseId, attachmentId)
    );

    if (!result)
      throw new Error('Deductible proof delete failed.');
  }


  private handleSaveError(error: ApiErrorResponse | null): void {
    this.httpErrors = true;

    if (error?.errors) {
      this.errors = {};
      const generalErrors: string[] = [];

      Object.entries(error.errors).forEach(([key, value]) => {
        const normalizedKey = key.replace(/^Items\.\d+\./, '').replace(/^Items\./, '');
        const formControlName = this.mapErrorKeyToFormControl(normalizedKey);

        if (formControlName) {
          this.errors[formControlName] = value;
          return;
        }

        generalErrors.push(...value);
      });

      if (generalErrors.length > 0) {
        this.errors['general'] = generalErrors;
      }

      if (Object.keys(this.errors).length === 0) {
        this.errors = { general: ['GenericError'] };
      }

      this.errorMessageService.setFormErrors(this.expenseForm, this.errors);
      return;
    }

    this.errors = { general: ['GenericError'] };
  }

  private mapErrorKeyToFormControl(errorKey: string): string | null {
    const normalizedKey = errorKey.trim().toLowerCase();

    switch (normalizedKey) {
      case 'targetcategoryid':
      case 'sourcecategoryid':
      case 'categoryid':
        return 'categoryId';
      case 'name':
        return 'name';
      case 'date':
        return 'date';
      case 'amount':
        return 'amount';
      case 'budget':
        return 'budget';
      case 'isdeductible':
        return 'isDeductible';
      default:
        return Object.keys(this.expenseForm.controls)
          .find(controlName => controlName.toLowerCase() === normalizedKey) ?? null;
    }
  }

  private getSelectedCategoryId(): string | null {
    return this.categoryIdControl?.value ?? this.categoryId ?? null;
  }
}







