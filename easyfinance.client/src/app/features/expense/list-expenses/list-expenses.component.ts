import { AsyncPipe, CommonModule } from '@angular/common';
import { Component, DestroyRef, Input, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DateAdapter } from '@angular/material/core';
import { MatDialog } from '@angular/material/dialog';
import { MatCardModule } from '@angular/material/card';
import { Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { BehaviorSubject } from 'rxjs/internal/BehaviorSubject';
import { Observable } from 'rxjs/internal/Observable';
import { map } from 'rxjs/internal/operators/map';
import { ConfirmDialogComponent } from '../../../core/components/confirm-dialog/confirm-dialog.component';
import { CurrentDateComponent } from '../../../core/components/current-date/current-date.component';
import { ReturnButtonComponent } from '../../../core/components/return-button/return-button.component';
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
    MatCardModule,
    TranslateModule
  ],
  templateUrl: './list-expenses.component.html',
  styleUrl: './list-expenses.component.css'
})
export class ListExpensesComponent implements OnInit {
  private expenseService = inject(ExpenseService);
  private categoryService = inject(CategoryService);
  private router = inject(Router);
  private globalService = inject(GlobalService);
  private dialog = inject(MatDialog);
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
  creatingSubExpenseParentId: string | null = null;
  editingSubExpense: { parentId: string, subExpenseId: string } | null = null;

  @Input({ required: true })
  projectId!: string;

  @Input({ required: true })
  categoryId!: string;

  ngOnInit(): void {
    this.dateAdapter.setLocale(this.globalService.currentLanguage);
    this.translateService.onLangChange
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(event => {
        this.currentLanguage = event.lang;
        this.dateAdapter.setLocale(event.lang);
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
    this.router.navigate(['/projects', this.projectId]);
  }

  updateDate(newDate: Date) {
    this.resetEditionState();
    this.fillData(newDate);
  }

  remove(id: string): void {
    this.expenseService.remove(this.projectId, this.categoryId, id).subscribe({
      next: () => {
        const expensesNewArray = this.expenses
          .getValue()
          .filter(item => item.id !== id);

        this.expenses.next(expensesNewArray);
      }
    });
  }

  triggerDelete(expense: ExpenseDto): void {
    const message = this.translateService.instant('AreYouSureYouWantDeleteExpense', { value: expense.name });

    this.dialog.open(ConfirmDialogComponent, {
      data: { title: 'DeleteExpense', message: message, action: 'ButtonDelete' },
    }).afterClosed().subscribe((result) => {
      if (result) {
        this.remove(expense.id);
      }
    });
  }

  removeSubExpense(expense: ExpenseDto, subExpense: ExpenseItemDto): void {
    this.expenseService.removeItem(this.projectId, this.categoryId, expense.id, subExpense.id).subscribe({
      next: () => {
        this.fillData(this.currentDateService.currentDate);
      }
    });
  }

  triggerDeleteSubExpense(expense: ExpenseDto, subExpense: ExpenseItemDto): void {
    const message = this.translateService.instant('AreYouSureYouWantDeleteExpense', { value: subExpense.name });

    this.dialog.open(ConfirmDialogComponent, {
      data: { title: 'DeleteExpense', message: message, action: 'ButtonDelete' },
    }).afterClosed().subscribe((result) => {
      if (result) {
        this.removeSubExpense(expense, subExpense);
      }
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
    this.editingExpenseId = null;
    this.isCreatingExpense = true;
  }

  startEditExpense(expense: ExpenseDto): void {
    if (!this.canCreateExpense()) {
      return;
    }

    this.cancelSubExpenseForm();
    this.isCreatingExpense = false;
    this.editingExpenseId = expense.id;
  }

  cancelExpenseForm(): void {
    this.isCreatingExpense = false;
    this.editingExpenseId = null;
  }

  onExpenseSaved(): void {
    this.cancelExpenseForm();
    this.fillData(this.currentDateService.currentDate);
  }

  isEditingExpense(expense: ExpenseDto): boolean {
    return this.editingExpenseId === expense.id;
  }

  startCreateSubExpense(parentExpense: ExpenseDto): void {
    if (!this.canAddExpenseItem()) {
      return;
    }

    this.cancelExpenseForm();
    this.creatingSubExpenseParentId = parentExpense.id;
    this.editingSubExpense = null;
    this.expandedExpenses.add(parentExpense.id);
  }

  startEditSubExpense(parentExpense: ExpenseDto, subExpense: ExpenseItemDto): void {
    if (!this.canAddExpenseItem()) {
      return;
    }

    this.cancelExpenseForm();
    this.creatingSubExpenseParentId = null;
    this.editingSubExpense = { parentId: parentExpense.id, subExpenseId: subExpense.id };
    this.expandedExpenses.add(parentExpense.id);
  }

  cancelSubExpenseForm(): void {
    this.creatingSubExpenseParentId = null;
    this.editingSubExpense = null;
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

  private resetEditionState(): void {
    this.cancelExpenseForm();
    this.cancelSubExpenseForm();
  }
}
