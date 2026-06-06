import { AsyncPipe, CommonModule } from '@angular/common';
import { Component, DestroyRef, Input, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DateAdapter } from '@angular/material/core';
import { MatDialog } from '@angular/material/dialog';
import { MatCardModule } from '@angular/material/card';
import { MatSnackBar } from '@angular/material/snack-bar';
import { NavigationEnd, Router, UrlSegment } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { BehaviorSubject } from 'rxjs/internal/BehaviorSubject';
import { Observable } from 'rxjs/internal/Observable';
import { map } from 'rxjs/internal/operators/map';
import { filter } from 'rxjs';
import { CurrentDateComponent } from '../../../core/components/current-date/current-date.component';
import { ReturnButtonComponent } from '../../../core/components/return-button/return-button.component';
import { SwipeDeleteRowComponent } from '../../../core/components/swipe-delete-row/swipe-delete-row.component';
import { CategoryService } from '../../../core/services/category.service';
import { CurrentDateService } from '../../../core/services/current-date.service';
import { ExpenseService } from '../../../core/services/expense.service';
import { GlobalService } from '../../../core/services/global.service';
import { ProjectService } from '../../../core/services/project.service';
import { Role } from '../../../core/enums/Role';
import { BudgetBarComponent } from '../../../core/components/budget-bar/budget-bar.component';
import { CurrencyFormatPipe } from '../../../core/utils/pipes/currency-format.pipe';
import { CategoryDto } from '../../category/models/category-dto';
import { UserProjectDto } from '../../project/models/user-project-dto';
import { AddExpenseComponent } from '../add-expense/add-expense.component';
import { AddExpenseItemComponent } from '../add-expense-item/add-expense-item.component';
import { ExpenseDto } from '../models/expense-dto';
import { ExpenseItemDto } from '../models/expense-item-dto';

@Component({
  selector: 'app-list-expenses',
  imports: [
    CommonModule,
    AsyncPipe,
    CurrentDateComponent,
    ReturnButtonComponent,
    BudgetBarComponent,
    CurrencyFormatPipe,
    AddExpenseComponent,
    AddExpenseItemComponent,
    SwipeDeleteRowComponent,
    MatCardModule,
    TranslateModule
  ],
  templateUrl: './list-expenses.component.html',
  styleUrl: './list-expenses.component.css'
})
export class ListExpensesComponent implements OnInit {
  private hadModalOutlet = false;
  private expenseService = inject(ExpenseService);
  private categoryService = inject(CategoryService);
  private router = inject(Router);
  private globalService = inject(GlobalService);
  private dialog = inject(MatDialog);
  private snackBar = inject(MatSnackBar);
  private projectService = inject(ProjectService);
  private translateService = inject(TranslateService);
  private currentDateService = inject(CurrentDateService);
  private dateAdapter = inject(DateAdapter<Date>);
  private destroyRef = inject(DestroyRef);

  private expandedExpenses: Set<string> = new Set<string>();

  private expenses: BehaviorSubject<ExpenseDto[]> = new BehaviorSubject<ExpenseDto[]>([]);
  expenses$: Observable<ExpenseDto[]> = this.expenses.asObservable();

  private category: BehaviorSubject<CategoryDto> = new BehaviorSubject<CategoryDto>(new CategoryDto());
  categoryName$: Observable<string> = this.category.asObservable().pipe(map(c => c.isArchived ? c.name + ' (' + this.translateService.instant('Archived') + ')' : c.name));
  categoryIsArchived$: Observable<boolean> = this.category.asObservable().pipe(map(c => c.isArchived));

  userProject!: UserProjectDto;
  isArchived = false;
  currentLanguage = this.globalService.currentLanguage;

  isCreatingExpense = false;
  editingExpenseId: string | null = null;
  movingExpenseId: string | null = null;
  creatingSubExpenseParentId: string | null = null;
  editingSubExpense: { parentId: string, subExpenseId: string } | null = null;
  movingSubExpense: { parentId: string, subExpenseId: string } | null = null;

  @Input({ required: true })
  projectId!: string;

  @Input({ required: true })
  categoryId!: string;

  ngOnInit(): void {
    this.hadModalOutlet = this.hasModalOutlet(this.router.url);

    this.dateAdapter.setLocale(this.globalService.currentLanguage);
    this.translateService.onLangChange
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(event => {
        this.currentLanguage = event.lang;
        this.dateAdapter.setLocale(event.lang);
      });

    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(event => {
        const hasModalOutlet = this.hasModalOutlet(event.urlAfterRedirects);

        if (this.hadModalOutlet && !hasModalOutlet && this.isCurrentExpensesRoute(event.urlAfterRedirects)) {
          this.fillData(this.currentDateService.currentDate);
        }

        this.hadModalOutlet = hasModalOutlet;
      });

    this.projectService.selectedUserProject$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(userProject => {
        if (userProject) {
          this.userProject = userProject;
          return;
        }

        this.projectService.getUserProject(this.projectId)
          .subscribe(res => {
            this.projectService.selectUserProject(res);
            this.userProject = res;
          });
      });

    this.categoryService.getById(this.projectId, this.categoryId)
      .pipe(
        map(category => CategoryDto.fromCategory(category)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(res => {
        this.isArchived = res.isArchived;
        this.category.next(res);
      });

    this.fillData(this.currentDateService.currentDate);
  }

  fillData(date: Date) {
    this.expenseService.get(this.projectId, this.categoryId, date)
      .pipe(map(expenses => ExpenseDto.fromExpenses(expenses)))
      .subscribe({
        next: res => {
          this.expenses.next(res);
        }
      });
  }

  previous() {
    this.router.navigate(['/projects', this.projectId, 'expense-overview']);
  }

  updateDate(newDate: Date) {
    this.resetEditionState();
    this.fillData(newDate);
  }

  swipeDeleteExpense(expense: ExpenseDto): void {
    const removed = expense;
    this.expenses.next(this.expenses.getValue().filter(e => e.id !== removed.id));

    this.expenseService.remove(this.projectId, this.categoryId, removed.id).subscribe();

    const undoLabel = this.translateService.instant('ButtonUndo');
    const message = this.translateService.instant('UndoDelete');
    const ref = this.snackBar.open(message, undoLabel, { duration: 5000 });

    ref.onAction().subscribe(() => {
      this.expenseService.restore(this.projectId, this.categoryId, removed.id).subscribe({
        next: () => this.fillData(this.currentDateService.currentDate)
      });
    });
  }

  swipeDeleteSubExpense(expense: ExpenseDto, subExpense: ExpenseItemDto): void {
    const currentExpenses = this.expenses.getValue().map(e => {
      if (e.id !== expense.id) return e;
      return { ...e, items: e.items.filter(i => i.id !== subExpense.id) } as ExpenseDto;
    });
    this.expenses.next(currentExpenses);

    this.expenseService.removeItem(this.projectId, this.categoryId, expense.id, subExpense.id).subscribe();

    const undoLabel = this.translateService.instant('ButtonUndo');
    const message = this.translateService.instant('UndoDelete');
    const ref = this.snackBar.open(message, undoLabel, { duration: 5000 });

    ref.onAction().subscribe(() => {
      this.expenseService.restoreItem(this.projectId, this.categoryId, expense.id, subExpense.id).subscribe({
        next: () => this.fillData(this.currentDateService.currentDate)
      });
    });
  }

  canAddOrEdit(): boolean {
    return !!this.userProject && (this.userProject.role === Role.Admin || this.userProject.role === Role.Manager);
  }

  canCreateExpense(): boolean {
    return this.canAddOrEdit() && !this.isArchived;
  }

  canAddExpenseItem(): boolean {
    return this.canCreateExpense();
  }

  toggleExpand(expenseId: string) {
    if (this.expandedExpenses.has(expenseId)) {
      this.expandedExpenses.delete(expenseId);
    } else {
      this.expandedExpenses.add(expenseId);
    }
  }

  isExpanded(expenseId: string): boolean {
    return this.expandedExpenses.has(expenseId);
  }

  startCreateExpense(): void {
    if (!this.canCreateExpense()) {
      return;
    }

    this.cancelSubExpenseForm();
    this.movingExpenseId = null;
    this.editingExpenseId = null;
    this.isCreatingExpense = true;
  }

  startEditExpense(expense: ExpenseDto): void {
    if (!this.canCreateExpense()) {
      return;
    }

    this.cancelSubExpenseForm();
    this.movingExpenseId = null;
    this.isCreatingExpense = false;
    this.editingExpenseId = expense.id;
  }

  startMoveExpense(expense: ExpenseDto): void {
    if (!this.canCreateExpense()) {
      return;
    }

    this.cancelSubExpenseForm();
    this.isCreatingExpense = false;
    this.editingExpenseId = null;
    this.movingExpenseId = expense.id;
  }

  cancelExpenseForm(): void {
    this.isCreatingExpense = false;
    this.editingExpenseId = null;
    this.movingExpenseId = null;
  }

  onExpenseSaved(): void {
    this.cancelExpenseForm();
    this.fillData(this.currentDateService.currentDate);
  }

  isEditingExpense(expense: ExpenseDto): boolean {
    return this.editingExpenseId === expense.id;
  }

  isMovingExpense(expense: ExpenseDto): boolean {
    return this.movingExpenseId === expense.id;
  }

  startCreateSubExpense(parentExpense: ExpenseDto): void {
    if (!this.canAddExpenseItem()) {
      return;
    }

    this.movingSubExpense = null;
    this.cancelExpenseForm();
    this.creatingSubExpenseParentId = parentExpense.id;
    this.editingSubExpense = null;
    this.expandedExpenses.add(parentExpense.id);
  }

  startEditSubExpense(parentExpense: ExpenseDto, subExpense: ExpenseItemDto): void {
    if (!this.canAddExpenseItem()) {
      return;
    }

    this.movingSubExpense = null;
    this.cancelExpenseForm();
    this.creatingSubExpenseParentId = null;
    this.editingSubExpense = { parentId: parentExpense.id, subExpenseId: subExpense.id };
    this.expandedExpenses.add(parentExpense.id);
  }

  startMoveSubExpense(parentExpense: ExpenseDto, subExpense: ExpenseItemDto): void {
    if (!this.canAddExpenseItem()) {
      return;
    }

    this.cancelExpenseForm();
    this.creatingSubExpenseParentId = null;
    this.editingSubExpense = null;
    this.movingSubExpense = { parentId: parentExpense.id, subExpenseId: subExpense.id };
    this.expandedExpenses.add(parentExpense.id);
  }

  cancelSubExpenseForm(): void {
    this.creatingSubExpenseParentId = null;
    this.editingSubExpense = null;
    this.movingSubExpense = null;
  }

  onSubExpenseSaved(): void {
    this.cancelSubExpenseForm();
    this.fillData(this.currentDateService.currentDate);
  }

  isCreatingSubExpense(expense: ExpenseDto): boolean {
    return this.creatingSubExpenseParentId === expense.id;
  }

  isEditingSubExpense(expense: ExpenseDto, subExpense: ExpenseItemDto): boolean {
    return this.editingSubExpense?.parentId === expense.id && this.editingSubExpense?.subExpenseId === subExpense.id;
  }

  isMovingSubExpense(expense: ExpenseDto, subExpense: ExpenseItemDto): boolean {
    return this.movingSubExpense?.parentId === expense.id && this.movingSubExpense?.subExpenseId === subExpense.id;
  }

  hasDeductibleProof(expense: ExpenseDto): boolean {
    return !!expense.getDeductibleProofAttachment();
  }

  hasDeductibleProofItem(expenseItem: ExpenseItemDto): boolean {
    return !!expenseItem.getDeductibleProofAttachment();
  }

  getDeductibleProofDownloadUrl(expense: ExpenseDto): string | null {
    const attachment = expense.getDeductibleProofAttachment();
    if (!attachment?.id) {
      return null;
    }

    return this.expenseService.getAttachmentDownloadUrl(
      this.projectId,
      this.categoryId,
      expense.id,
      attachment.id
    );
  }

  getDeductibleProofItemDownloadUrl(expense: ExpenseDto, expenseItem: ExpenseItemDto): string | null {
    const attachment = expenseItem.getDeductibleProofAttachment();
    if (!attachment?.id) {
      return null;
    }

    return this.expenseService.getExpenseItemAttachmentDownloadUrl(
      this.projectId,
      this.categoryId,
      expense.id,
      expenseItem.id,
      attachment.id
    );
  }

  private resetEditionState(): void {
    this.cancelExpenseForm();
    this.cancelSubExpenseForm();
  }

  private hasModalOutlet(url: string): boolean {
    return !!this.router.parseUrl(url).root.children['modal'];
  }

  private isCurrentExpensesRoute(url: string): boolean {
    const primarySegments = this.router.parseUrl(url).root.children['primary']?.segments ?? [];
    const projectIdSegment = this.getSegmentPath(primarySegments, 1);
    const categoryIdSegment = this.getSegmentPath(primarySegments, 3);

    return this.getSegmentPath(primarySegments, 0) === 'projects'
      && projectIdSegment === this.projectId
      && this.getSegmentPath(primarySegments, 2) === 'categories'
      && categoryIdSegment === this.categoryId
      && this.getSegmentPath(primarySegments, 4) === 'expenses'
      && primarySegments.length === 5;
  }

  private getSegmentPath(segments: UrlSegment[], index: number): string {
    return segments.at(index)?.path ?? '';
  }
}
