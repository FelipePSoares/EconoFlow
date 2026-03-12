import { CommonModule } from '@angular/common';
import { HttpClient, HttpResponse } from '@angular/common/http';
import { Component, DestroyRef, Input, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { CdkDragDrop, DragDropModule } from '@angular/cdk/drag-drop';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import { ConfirmDialogComponent } from '../../../core/components/confirm-dialog/confirm-dialog.component';
import {
  ConfigureTaxYearRuleDialogComponent
} from '../../../core/components/configure-tax-year-rule-dialog/configure-tax-year-rule-dialog.component';
import { PageModalComponent, PageModalDialogData } from '../../../core/components/page-modal/page-modal.component';
import { ReturnButtonComponent } from '../../../core/components/return-button/return-button.component';
import { SnackbarComponent } from '../../../core/components/snackbar/snackbar.component';
import { Role } from '../../../core/enums/Role';
import { ApiErrorResponse } from '../../../core/models/error';
import { DeductibleGroup } from '../../../core/models/deductible-group';
import { ProjectTaxYearSettings } from '../../../core/models/project-tax-year-settings';
import { TaxYearPeriod } from '../../../core/models/tax-year-period';
import { CategoryService } from '../../../core/services/category.service';
import { CurrentDateService } from '../../../core/services/current-date.service';
import { ExpenseService } from '../../../core/services/expense.service';
import { ProjectService } from '../../../core/services/project.service';
import { toLocalDate } from '../../../core/utils/date';
import { CurrencyFormatPipe } from '../../../core/utils/pipes/currency-format.pipe';
import { CategoryDto } from '../../category/models/category-dto';
import { ExpenseDto } from '../../expense/models/expense-dto';
import { ExpenseItemDto } from '../../expense/models/expense-item-dto';

interface DeductibleEntry {
  id: string;
  expenseId: string;
  expenseItemId?: string;
  date: Date;
  description: string;
  categoryId: string;
  categoryName: string;
  amount: number;
  hasProof: boolean;
  proofDownloadUrl: string | null;
  canAssignGroup: boolean;
}

@Component({
  selector: 'app-deductions',
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatSelectModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    DragDropModule,
    TranslateModule,
    ReturnButtonComponent,
    CurrencyFormatPipe
  ],
  providers: [CurrencyFormatPipe],
  templateUrl: './deductions.component.html',
  styleUrl: './deductions.component.css'
})
export class DeductionsComponent implements OnInit {
  private projectService = inject(ProjectService);
  private categoryService = inject(CategoryService);
  private expenseService = inject(ExpenseService);
  private currentDateService = inject(CurrentDateService);
  private router = inject(Router);
  private dialog = inject(MatDialog);
  private translateService = inject(TranslateService);
  private snackBar = inject(SnackbarComponent);
  private http = inject(HttpClient);
  private destroyRef = inject(DestroyRef);

  @Input({ required: true })
  projectId!: string;

  readonly ungroupedDropListId = 'deductions-group-none';

  selectionForm = new FormGroup({
    taxYearId: new FormControl('', [Validators.required])
  });

  taxYears: TaxYearPeriod[] = [];
  groups: DeductibleGroup[] = [];
  deductibleEntries: DeductibleEntry[] = [];
  expenseGroupMap: Record<string, string> = {};
  isUpdatingAssignmentByEntryKey: Record<string, boolean> = {};
  isDownloadingProofByEntryId: Record<string, boolean> = {};
  selectedAssignableEntryIds = new Set<string>();

  newGroupName = '';
  editingGroupId: string | null = null;
  editingGroupName = '';
  canManageGroups = false;
  selectedProjectName = '';

  isLoadingTaxYears = false;
  isLoadingData = false;
  isCreatingGroup = false;
  taxYearNotConfigured = false;

  ngOnInit(): void {
    this.projectService.selectedUserProject$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(userProject => {
        if (userProject?.project?.id === this.projectId) {
          this.canManageGroups = userProject.role === Role.Admin || userProject.role === Role.Manager;
          this.selectedProjectName = userProject.project.name;
        }
      });

    this.projectService.getUserProject(this.projectId).subscribe(userProject => {
      this.canManageGroups = userProject.role === Role.Admin || userProject.role === Role.Manager;
      this.selectedProjectName = userProject.project.name;
    });

    this.loadTaxYears();
  }

  previous(): void {
    this.router.navigate(['/projects', this.projectId, 'overview', 'annual']);
  }

  get selectedTaxYearId(): string {
    return this.selectionForm.controls.taxYearId.value ?? '';
  }

  get totalDeductibleAmount(): number {
    return this.deductibleEntries.reduce((total, item) => total + item.amount, 0);
  }

  get deductibleExpensesCount(): number {
    return this.deductibleEntries.length;
  }

  get missingProofCount(): number {
    return this.deductibleEntries.filter(item => !item.hasProof).length;
  }

  get selectedAssignableCount(): number {
    return this.selectedAssignableEntryIds.size;
  }

  get connectedDropListIds(): string[] {
    return [this.ungroupedDropListId, ...this.groups.map(group => this.getDropListId(group.id))];
  }

  onSelectedTaxYearChanged(): void {
    if (!this.selectedTaxYearId) {
      return;
    }

    this.editingGroupId = null;
    this.clearSelectedAssignableEntries();
    this.isUpdatingAssignmentByEntryKey = {};
    void this.loadSelectedTaxYearData();
  }

  async openTaxYearConfigurationDialog(): Promise<void> {
    if (!this.canManageGroups) {
      return;
    }

    let dialogRef: MatDialogRef<PageModalComponent, ProjectTaxYearSettings | null>;
    const componentInputs = {
      projectId: this.projectId,
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

    const settings = await firstValueFrom(dialogRef.afterClosed());
    if (settings?.taxYearType) {
      this.taxYearNotConfigured = false;
      this.loadTaxYears();
    }
  }

  async createGroup(): Promise<void> {
    const taxYearId = this.selectedTaxYearId;
    const groupName = this.newGroupName.trim();
    if (!this.canManageGroups || !taxYearId || !groupName || this.isCreatingGroup) {
      return;
    }

    this.isCreatingGroup = true;
    try {
      await firstValueFrom(this.projectService.createDeductibleGroup(this.projectId, taxYearId, groupName));
      this.newGroupName = '';
      await this.loadSelectedTaxYearData();
    } catch (error) {
      this.handleError(error as ApiErrorResponse);
    } finally {
      this.isCreatingGroup = false;
    }
  }

  startRename(group: DeductibleGroup): void {
    if (!this.canManageGroups) {
      return;
    }

    this.editingGroupId = group.id;
    this.editingGroupName = group.name;
  }

  cancelRename(): void {
    this.editingGroupId = null;
    this.editingGroupName = '';
  }

  async saveRename(group: DeductibleGroup): Promise<void> {
    const taxYearId = this.selectedTaxYearId;
    const newName = this.editingGroupName.trim();
    if (!taxYearId || !newName || group.id !== this.editingGroupId) {
      return;
    }

    try {
      await firstValueFrom(this.projectService.updateDeductibleGroup(this.projectId, taxYearId, group.id, newName));
      this.cancelRename();
      await this.loadSelectedTaxYearData();
    } catch (error) {
      this.handleError(error as ApiErrorResponse);
    }
  }

  async deleteGroup(group: DeductibleGroup): Promise<void> {
    if (!this.canManageGroups || !this.selectedTaxYearId) {
      return;
    }

    const message = this.translateService.instant('AreYouSureYouWantDeleteDeductibleGroup', { value: group.name });
    const shouldDelete = await firstValueFrom(this.dialog.open(ConfirmDialogComponent, {
      data: { title: 'DeleteDeductibleGroup', message, action: 'ButtonDelete' },
    }).afterClosed());

    if (!shouldDelete) {
      return;
    }

    try {
      await firstValueFrom(this.projectService.deleteDeductibleGroup(this.projectId, this.selectedTaxYearId, group.id));
      await this.loadSelectedTaxYearData();
    } catch (error) {
      this.handleError(error as ApiErrorResponse);
    }
  }

  getAssignableEntriesForGroup(groupId: string | null): DeductibleEntry[] {
    return this.deductibleEntries
      .filter(entry => entry.canAssignGroup && this.getEntryGroupId(entry) === groupId);
  }

  getDropListId(groupId: string): string {
    return `deductions-group-${groupId}`;
  }

  isAssignableSelected(entry: DeductibleEntry): boolean {
    return this.selectedAssignableEntryIds.has(entry.id);
  }

  toggleAssignableSelection(entry: DeductibleEntry, isSelected: boolean): void {
    if (!this.canManageGroups || !entry.canAssignGroup) {
      return;
    }

    if (isSelected) {
      this.selectedAssignableEntryIds.add(entry.id);
      return;
    }

    this.selectedAssignableEntryIds.delete(entry.id);
  }

  clearSelectedAssignableEntries(): void {
    this.selectedAssignableEntryIds.clear();
  }

  isEntryGroupAssignmentUpdating(entry: DeductibleEntry): boolean {
    return !!this.isUpdatingAssignmentByEntryKey[this.getEntryAssignmentKey(entry)];
  }

  async onGroupDrop(event: CdkDragDrop<DeductibleEntry[]>, targetGroupId: string | null): Promise<void> {
    if (!this.canManageGroups || !this.selectedTaxYearId) {
      return;
    }

    const draggedEntry = event.item.data as DeductibleEntry | undefined;
    if (!draggedEntry?.canAssignGroup) {
      return;
    }

    const sourceGroupId = this.getEntryGroupId(draggedEntry);
    if (sourceGroupId === targetGroupId) {
      return;
    }

    let entriesToMove: DeductibleEntry[] = [draggedEntry];
    if (this.isAssignableSelected(draggedEntry)) {
      const selectedEntriesFromSourceGroup = this.getSelectedAssignableEntries()
        .filter(entry => this.getEntryGroupId(entry) === sourceGroupId);

      if (selectedEntriesFromSourceGroup.length) {
        entriesToMove = selectedEntriesFromSourceGroup;
      }
    }

    await this.moveEntriesToGroup(entriesToMove, targetGroupId);
  }

  openDeductibleEntry(entry: DeductibleEntry): void {
    if (!this.canManageGroups) {
      return;
    }

    this.currentDateService.currentDate = new Date(entry.date.getFullYear(), entry.date.getMonth(), 1, 12);

    const isExpenseItem = !!entry.expenseItemId;
    const modalRoute = isExpenseItem
      ? ['projects', this.projectId, 'add-expense-item']
      : ['projects', this.projectId, 'add-expense'];

    this.router.navigate([{ outlets: { modal: modalRoute } }], {
      queryParams: {
        categoryId: entry.categoryId,
        expenseId: entry.expenseId,
        expenseItemId: entry.expenseItemId ?? null,
        selectedTaxYearId: this.selectedTaxYearId
      },
      queryParamsHandling: 'merge'
    });

    this.dialog.open(PageModalComponent, {
      autoFocus: false,
      width: '560px',
      maxWidth: '95vw',
      data: {
        titleSuffix: this.selectedProjectName
      }
    }).afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.router.navigate([{ outlets: { modal: null } }], {
          queryParams: {
            categoryId: null,
            expenseId: null,
            expenseItemId: null,
            selectedTaxYearId: null
          },
          queryParamsHandling: 'merge'
        });

        void this.loadSelectedTaxYearData();
      });
  }

  isProofDownloadInProgress(entry: DeductibleEntry): boolean {
    return !!this.isDownloadingProofByEntryId[entry.id];
  }

  downloadProof(entry: DeductibleEntry): void {
    if (!entry.proofDownloadUrl || this.isProofDownloadInProgress(entry)) {
      return;
    }

    this.isDownloadingProofByEntryId[entry.id] = true;

    this.http.get(entry.proofDownloadUrl, {
      observe: 'response',
      responseType: 'blob'
    }).subscribe({
      next: (response: HttpResponse<Blob>) => {
        if (!response.body) {
          return;
        }

        const downloadUrl = URL.createObjectURL(response.body);
        const anchor = document.createElement('a');
        anchor.href = downloadUrl;
        anchor.download = this.resolveProofFileName(entry, response);
        anchor.style.display = 'none';

        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
        setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
      },
      error: (error: ApiErrorResponse) => {
        this.handleError(error);
      }
    }).add(() => {
      delete this.isDownloadingProofByEntryId[entry.id];
    });
  }

  getSectionTotal(entries: DeductibleEntry[]): number {
    return entries.reduce((total, item) => total + item.amount, 0);
  }

  private getEntryAssignmentKey(entry: DeductibleEntry): string {
    return this.getAssignmentKey(entry.expenseId, entry.expenseItemId ?? null);
  }

  private getAssignmentKey(expenseId?: string | null, expenseItemId?: string | null): string {
    if (expenseItemId) {
      return `expense-item:${expenseItemId}`;
    }

    return `expense:${expenseId ?? ''}`;
  }

  private getEntryGroupId(entry: DeductibleEntry): string | null {
    return this.expenseGroupMap[this.getEntryAssignmentKey(entry)] ?? null;
  }

  private getSelectedAssignableEntries(): DeductibleEntry[] {
    return this.deductibleEntries
      .filter(entry => entry.canAssignGroup && this.selectedAssignableEntryIds.has(entry.id));
  }

  private async moveEntriesToGroup(entries: DeductibleEntry[], targetGroupId: string | null): Promise<void> {
    const uniqueEntries = Array.from(new Map(entries.map(entry => [this.getEntryAssignmentKey(entry), entry])).values());
    const entriesToMove = uniqueEntries
      .filter(entry => this.getEntryGroupId(entry) !== targetGroupId);

    if (!entriesToMove.length) {
      return;
    }

    entriesToMove.forEach(entry => {
      this.isUpdatingAssignmentByEntryKey[this.getEntryAssignmentKey(entry)] = true;
    });

    try {
      for (const entry of entriesToMove) {
        const currentGroupId = this.getEntryGroupId(entry);
        const assignmentExpenseId = entry.expenseItemId ? null : entry.expenseId;
        const assignmentExpenseItemId = entry.expenseItemId ?? null;

        if (currentGroupId) {
          await firstValueFrom(this.projectService.removeExpenseFromDeductibleGroup(
            this.projectId,
            this.selectedTaxYearId,
            currentGroupId,
            assignmentExpenseId,
            assignmentExpenseItemId
          ));
        }

        if (targetGroupId) {
          await firstValueFrom(this.projectService.assignExpenseToDeductibleGroup(
            this.projectId,
            this.selectedTaxYearId,
            targetGroupId,
            assignmentExpenseId,
            assignmentExpenseItemId
          ));
        }

        const assignmentKey = this.getEntryAssignmentKey(entry);
        if (targetGroupId) {
          this.expenseGroupMap[assignmentKey] = targetGroupId;
        } else {
          delete this.expenseGroupMap[assignmentKey];
        }

        this.selectedAssignableEntryIds.delete(entry.id);
      }
    } catch (error) {
      this.handleError(error as ApiErrorResponse);
      await this.loadSelectedTaxYearData();
    } finally {
      entriesToMove.forEach(entry => {
        delete this.isUpdatingAssignmentByEntryKey[this.getEntryAssignmentKey(entry)];
      });
    }
  }

  private loadTaxYears(): void {
    this.isLoadingTaxYears = true;

    this.projectService.getTaxYears(this.projectId)
      .subscribe({
        next: taxYears => {
          this.taxYearNotConfigured = false;
          this.taxYears = [...taxYears].sort((left, right) => left.startDate.localeCompare(right.startDate));
          const selectedTaxYearId = this.selectedTaxYearId;
          const taxYearExists = this.taxYears.some(taxYear => taxYear.taxYearId === selectedTaxYearId);
          const defaultTaxYearId = this.taxYears.at(-1)?.taxYearId ?? '';
          this.selectionForm.controls.taxYearId.setValue(taxYearExists ? selectedTaxYearId : defaultTaxYearId, { emitEvent: false });
          void this.loadSelectedTaxYearData();
        },
        error: (error: ApiErrorResponse) => {
          this.taxYears = [];
          this.groups = [];
          this.deductibleEntries = [];
          this.expenseGroupMap = {};
          this.clearSelectedAssignableEntries();
          this.taxYearNotConfigured = this.hasErrorCode(error, 'TaxYearNotConfigured');
          if (!this.taxYearNotConfigured) {
            this.handleError(error);
          }
        },
        complete: () => {
          this.isLoadingTaxYears = false;
        }
      });
  }

  private async loadSelectedTaxYearData(): Promise<void> {
    const taxYearId = this.selectedTaxYearId;
    if (!taxYearId) {
      this.groups = [];
      this.deductibleEntries = [];
      this.expenseGroupMap = {};
      this.clearSelectedAssignableEntries();
      return;
    }

    const selectedTaxYear = this.taxYears.find(item => item.taxYearId === taxYearId);
    if (!selectedTaxYear) {
      this.groups = [];
      this.deductibleEntries = [];
      this.expenseGroupMap = {};
      this.clearSelectedAssignableEntries();
      return;
    }

    const startDate = toLocalDate(selectedTaxYear.startDate);
    const endDateExclusive = toLocalDate(selectedTaxYear.endDate);
    endDateExclusive.setDate(endDateExclusive.getDate() + 1);

    this.isLoadingData = true;
    try {
      const [groups, categories] = await Promise.all([
        firstValueFrom(this.projectService.getDeductibleGroups(this.projectId, taxYearId)),
        firstValueFrom(this.categoryService.get(this.projectId, startDate, endDateExclusive))
      ]);

      this.groups = groups;
      this.expenseGroupMap = await this.loadExpenseGroupMap(this.groups, taxYearId);
      this.deductibleEntries = this.buildDeductibleEntries(CategoryDto.fromCategories(categories));
      this.clearSelectedAssignableEntries();
    } catch (error) {
      this.groups = [];
      this.deductibleEntries = [];
      this.expenseGroupMap = {};
      this.clearSelectedAssignableEntries();
      this.handleError(error as ApiErrorResponse);
    } finally {
      this.isLoadingData = false;
    }
  }

  private async loadExpenseGroupMap(groups: DeductibleGroup[], taxYearId: string): Promise<Record<string, string>> {
    if (!groups.length) {
      return {};
    }

    const groupExpenseLists = await Promise.all(groups.map(group =>
      firstValueFrom(this.projectService.getDeductibleGroupExpenses(this.projectId, taxYearId, group.id))
    ));

    const expenseGroupMap: Record<string, string> = {};
    groups.forEach((group, index) => {
      groupExpenseLists[index].forEach(expense => {
        if (!expense.expenseId && !expense.expenseItemId) {
          return;
        }

        const assignmentKey = this.getAssignmentKey(expense.expenseId ?? null, expense.expenseItemId ?? null);
        if (!expenseGroupMap[assignmentKey]) {
          expenseGroupMap[assignmentKey] = group.id;
        }
      });
    });

    return expenseGroupMap;
  }

  private buildDeductibleEntries(categories: CategoryDto[]): DeductibleEntry[] {
    const entries: DeductibleEntry[] = [];

    categories.forEach(category => {
      (category.expenses ?? []).forEach(expense => {
        if (expense.isDeductible) {
          entries.push(this.toExpenseEntry(category, expense));
        }

        (expense.items ?? [])
          .filter(expenseItem => expenseItem.isDeductible)
          .forEach(expenseItem => entries.push(this.toExpenseItemEntry(category, expense, expenseItem)));
      });
    });

    return entries.sort((left, right) => right.date.getTime() - left.date.getTime());
  }

  private toExpenseEntry(category: CategoryDto, expense: ExpenseDto): DeductibleEntry {
    const proofAttachment = expense.getDeductibleProofAttachment();

    return {
      id: expense.id,
      expenseId: expense.id,
      expenseItemId: undefined,
      date: expense.date,
      description: expense.name || this.translateService.instant('PlaceholderItemWithoutName'),
      categoryId: category.id,
      categoryName: category.name,
      amount: Number(expense.amount || 0),
      hasProof: !!proofAttachment,
      proofDownloadUrl: proofAttachment?.id
        ? this.expenseService.getAttachmentDownloadUrl(this.projectId, category.id, expense.id, proofAttachment.id)
        : null,
      canAssignGroup: true
    };
  }

  private toExpenseItemEntry(category: CategoryDto, expense: ExpenseDto, expenseItem: ExpenseItemDto): DeductibleEntry {
    const proofAttachment = expenseItem.getDeductibleProofAttachment();
    const itemName = expenseItem.name?.trim() ? expenseItem.name : this.translateService.instant('PlaceholderItemWithoutName');

    return {
      id: `${expense.id}-${expenseItem.id}`,
      expenseId: expense.id,
      expenseItemId: expenseItem.id,
      date: expenseItem.date,
      description: `${itemName} (${expense.name})`,
      categoryId: category.id,
      categoryName: category.name,
      amount: Number(expenseItem.amount || 0),
      hasProof: !!proofAttachment,
      proofDownloadUrl: proofAttachment?.id
        ? this.expenseService.getExpenseItemAttachmentDownloadUrl(this.projectId, category.id, expense.id, expenseItem.id, proofAttachment.id)
        : null,
      canAssignGroup: true
    };
  }

  private hasErrorCode(error: ApiErrorResponse, code: string): boolean {
    return !!error?.errors && Object.prototype.hasOwnProperty.call(error.errors, code);
  }

  private handleError(error: ApiErrorResponse): void {
    const fallbackMessage = this.translateService.instant('GenericError');
    const firstError = error?.errors
      ? Object.values(error.errors).flat().at(0)
      : fallbackMessage;

    this.snackBar.openErrorSnackbar(this.translateService.instant(firstError ?? fallbackMessage));
  }

  private resolveProofFileName(entry: DeductibleEntry, response: HttpResponse<Blob>): string {
    const contentDisposition = response.headers.get('content-disposition');
    const fileNameFromHeader = this.extractFileNameFromContentDisposition(contentDisposition);
    if (fileNameFromHeader) {
      return fileNameFromHeader;
    }

    const description = (entry.description ?? '')
      .trim()
      .replace(/[^a-zA-Z0-9._-]+/g, '-')
      .replace(/^-+|-+$/g, '');
    const datePart = entry.date.toISOString().split('T')[0];
    const extension = this.resolveFileExtension(response.body?.type);

    return `${description || 'deductible-proof'}-${datePart}${extension}`;
  }

  private extractFileNameFromContentDisposition(contentDisposition: string | null): string | null {
    if (!contentDisposition) {
      return null;
    }

    const utf8Match = /filename\*=UTF-8''([^;]+)/i.exec(contentDisposition);
    if (utf8Match?.[1]) {
      try {
        return decodeURIComponent(utf8Match[1]);
      } catch {
        return utf8Match[1];
      }
    }

    const simpleMatch = /filename="?([^\";]+)"?/i.exec(contentDisposition);
    return simpleMatch?.[1] ?? null;
  }

  private resolveFileExtension(contentType?: string | null): string {
    switch ((contentType ?? '').toLowerCase()) {
      case 'application/pdf':
        return '.pdf';
      case 'image/jpeg':
      case 'image/jpg':
        return '.jpg';
      case 'image/png':
        return '.png';
      case 'image/webp':
        return '.webp';
      case 'image/heic':
        return '.heic';
      case 'image/heif':
        return '.heif';
      default:
        return '';
    }
  }
}
