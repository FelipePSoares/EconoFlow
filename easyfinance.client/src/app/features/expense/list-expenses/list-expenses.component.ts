import { Component, ElementRef, inject, Input, OnInit, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { map } from 'rxjs/internal/operators/map';
import { BehaviorSubject } from 'rxjs/internal/BehaviorSubject';
import { Observable } from 'rxjs/internal/Observable';
import { AsyncPipe, CommonModule } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { compare } from 'fast-json-patch';
import { MatFormField } from '@angular/material/form-field';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { MatButton } from '@angular/material/button';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { ApiErrorResponse } from 'src/app/core/models/error';
import { CurrencyMaskModule } from 'ng2-currency-mask';
import { MatDialog } from '@angular/material/dialog';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { MatCardModule } from '@angular/material/card';
import { ExpenseDto } from '../models/expense-dto';
import { ExpenseService } from '../../../core/services/expense.service';
import { ReturnButtonComponent } from '../../../core/components/return-button/return-button.component';
import { CurrentDateComponent } from '../../../core/components/current-date/current-date.component';
import { ConfirmDialogComponent } from '../../../core/components/confirm-dialog/confirm-dialog.component';
import { formatDate, toLocalNoonDate } from '../../../core/utils/date';
import { ErrorMessageService } from 'src/app/core/services/error-message.service';
import { GlobalService } from '../../../core/services/global.service';
import { UserProjectDto } from '../../project/models/user-project-dto';
import { ProjectService } from '../../../core/services/project.service';
import { Role } from '../../../core/enums/Role';
import { CategoryDto } from '../../category/models/category-dto';
import { CategoryService } from '../../../core/services/category.service';
import { BudgetBarComponent } from '../../../core/components/budget-bar/budget-bar.component';
import { ExpenseItemComponent } from '../expense-item/expense-item.component';
import { ExpenseItemDto } from '../models/expense-item-dto';
import { CurrentDateService } from '../../../core/services/current-date.service';
import { DateAdapter } from '@angular/material/core';

@Component({
    selector: 'app-list-expenses',
  imports: [
      ExpenseItemComponent,
      CommonModule,
      AsyncPipe,
      ReactiveFormsModule,
      CurrentDateComponent,
      ReturnButtonComponent,
      BudgetBarComponent,
      MatFormField,
      MatFormFieldModule,
      MatCardModule,
      MatInput,
      MatButton,
      MatDatepickerModule,
      CurrencyMaskModule,
      TranslateModule
    ],
    templateUrl: './list-expenses.component.html',
    styleUrl: './list-expenses.component.css'
})
export class ListExpensesComponent implements OnInit {
  private expenseService = inject(ExpenseService);
  private categoryService = inject(CategoryService);
  private router = inject(Router);
  private errorMessageService = inject(ErrorMessageService);
  private globalService = inject(GlobalService);
  private dialog = inject(MatDialog);
  private projectService = inject(ProjectService);
  private translateService = inject(TranslateService);
  private currentDateService = inject(CurrentDateService);
  private dateAdapter = inject(DateAdapter<Date>);

  private expandedExpenses: Set<string> = new Set<string>();

  private expenses: BehaviorSubject<ExpenseDto[]> = new BehaviorSubject<ExpenseDto[]>([]);
  expenses$: Observable<ExpenseDto[]> = this.expenses.asObservable();

  private category: BehaviorSubject<CategoryDto> = new BehaviorSubject<CategoryDto>(new CategoryDto());
  categoryName$: Observable<string> = this.category.asObservable().pipe(map(c => c.isArchived ? c.name + ' (' + this.translateService.instant('Archived') + ')' : c.name));
  categoryIsArchived$: Observable<boolean> = this.category.asObservable().pipe(map(c => c.isArchived));

  expenseForm!: FormGroup;
  editingExpense: ExpenseDto = new ExpenseDto();
  httpErrors = false;
  errors!: Record<string, string[]>;
  thousandSeparator!: string; 
  decimalSeparator!: string;
  currencySymbol!: string;
  userProject!: UserProjectDto;
  isArchived!: boolean;

  @Input({ required: true })
  projectId!: string;

  @Input({ required: true })
  categoryId!: string;

  @ViewChild('nameInput')
  nameInput?: ElementRef<HTMLInputElement>;

  constructor() {
    this.thousandSeparator = this.globalService.groupSeparator;
    this.decimalSeparator = this.globalService.decimalSeparator;
    this.currencySymbol = this.globalService.currencySymbol;
  }

  ngOnInit(): void {
    this.dateAdapter.setLocale(this.globalService.currentLanguage);

    this.projectService.selectedUserProject$.subscribe(userProject => {
      if (userProject) {
        this.userProject = userProject;
      } else {
        this.projectService.getUserProject(this.projectId)
          .subscribe(res => {
            this.projectService.selectUserProject(res);
            this.userProject = res;
          });
      }
    });

    this.categoryService.getById(this.projectId, this.categoryId)
      .pipe(map(category => CategoryDto.fromCategory(category)))
      .subscribe(res => {
        this.isArchived = res.isArchived;
        this.category.next(res);
      }
    )

    this.fillData(this.currentDateService.currentDate);
    this.edit(new ExpenseDto());
  }

  fillData(date: Date) {
    this.expenseService.get(this.projectId, this.categoryId, date)
      .pipe(map(expenses => ExpenseDto.fromExpenses(expenses)))
      .subscribe(
        {
          next: res => { this.expenses.next(res); }
      });
  }

  get id() {
    return this.expenseForm.get('id');
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

  select(id: string): void {
    this.router.navigate(['/projects', this.projectId, 'categories', this.categoryId, 'expenses', id, { currentDate: this.currentDateService.currentDate.toISOString().substring(0, 10) }]);
  }

  save(): void {
    if (this.expenseForm.valid) {
      this.httpErrors = false;
      const id = this.id?.value;
      const name = this.name?.value;
      const date: any = formatDate(this.date?.value);
      const amount = this.amount?.value;
      const budget = this.budget?.value;
      const isNewExpense = this.isNewEntity(id);

      const newExpense = ({
        id: isNewExpense ? undefined : id,
        name: name,
        date: date,
        amount: amount === "" || amount === null ? 0 : amount,
        budget: budget === "" || budget === null ? 0 : budget,
        items: this.editingExpense.items
      }) as ExpenseDto;

      if (isNewExpense) {
        this.expenseService.add(this.projectId, this.categoryId, newExpense).subscribe({
          next: response => {
            const expensesNewArray = [...this.expenses.getValue()];
            const index = expensesNewArray.findIndex(item => item.id === id);

            if (index !== -1) {
              expensesNewArray[index] = ExpenseDto.fromExpense(response);
              this.expenses.next(expensesNewArray);
            } else {
              this.fillData(this.currentDateService.currentDate);
            }

            this.editingExpense = new ExpenseDto();
          },
          error: (response: ApiErrorResponse) => {
            this.httpErrors = true;
            this.errors = response.errors;

            this.errorMessageService.setFormErrors(this.expenseForm, this.errors);
          }
        });
        return;
      }

      const patch = compare(this.editingExpense, newExpense);

      this.expenseService.update(this.projectId, this.categoryId, id, patch).subscribe({
        next: response => {
            this.editingExpense.name = response.name;
            this.editingExpense.date = response.date;
            this.editingExpense.budget = response.budget;
            this.editingExpense.amount = response.amount;
            this.editingExpense = new ExpenseDto();
          },
        error: (response: ApiErrorResponse) => {
          this.httpErrors = true;
          this.errors = response.errors;

          this.errorMessageService.setFormErrors(this.expenseForm, this.errors);
        }
        });
    }
  }

  edit(expense: ExpenseDto): void {
    this.editingExpense = expense;
    const newDate = new Date(expense.date);
    this.expenseForm = new FormGroup({
      id: new FormControl(expense.id),
      name: new FormControl(expense.name, [Validators.required, Validators.maxLength(100)]),
      date: new FormControl(newDate, [Validators.required]),
      amount: new FormControl(expense.amount, [Validators.min(0)]),
      budget: new FormControl(expense.budget ?? 0, [Validators.pattern('[0-9]*')]),
    });

    if (this.editingExpense?.items?.length ?? 0 > 0) {
      this.expenseForm.controls['date'].disable();
      this.expenseForm.controls['amount'].disable();
    }
  }

  cancelEdit(): void {
    if (this.isNewEntity(this.editingExpense.id)) {
      const expensesNewArray = this.expenses
        .getValue()
        .filter(item => item.id !== this.editingExpense.id);
      this.expenses.next(expensesNewArray);
    }

    this.editingExpense = new ExpenseDto();
  }

  remove(id: string): void {
    this.expenseService.remove(this.projectId, this.categoryId, id).subscribe({
      next: () => {
        const expensesNewArray: ExpenseDto[] = this.expenses.getValue();

        expensesNewArray.forEach((item, index) => {
          if (item.id === id) { expensesNewArray.splice(index, 1); }
        });

        this.expenses.next(expensesNewArray);
      }
    })
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

  updateDate(newDate: Date) {
    this.fillData(newDate);
  }

  add(): void {
    this.httpErrors = false;
    const expensesNewArray = [...this.expenses.getValue()];

    const newExpense = new ExpenseDto();
    newExpense.id = this.generateTempId('expense');
    newExpense.name = '';
    newExpense.date = toLocalNoonDate(this.currentDateService.currentDate);
    newExpense.amount = 0;
    newExpense.budget = 0;
    newExpense.items = [];

    expensesNewArray.push(newExpense);
    this.expenses.next(expensesNewArray);
    this.edit(newExpense);
    this.focusNameInput();
  }

  previous() {
    this.router.navigate(['/projects', this.projectId]);
  }

  getPercentageWaste(waste: number, budget: number): number {
    return budget === 0 ? waste !== 0 ? 101 : 0 : waste * 100 / budget;
  }

  getClassToProgressBar(percentage: number): string {
    if (percentage <= 75) {
      return 'bg-info';
    } else if (percentage <= 100) {
      return 'bg-warning';
    }

    return 'bg-danger';
  }

  getTextBasedOnPercentage(percentage: number): string {
    if (percentage <= 75) {
      return 'Expenses';
    } else if (percentage <= 100) {
      return 'Risk of overspend';
    }

    return 'Overspend';
  }

  getClassBasedOnPercentage(percentage: number): string {
    if (percentage <= 75) {
      return '';
    } else if (percentage <= 100) {
      return 'warning';
    }

    return 'danger';
  }

  getFormFieldErrors(fieldName: string): string[] {
    return this.errorMessageService.getFormFieldErrors(this.expenseForm, fieldName);
  }

  canAddOrEdit(): boolean {
    return (this.userProject.role === Role.Admin || this.userProject.role === Role.Manager) && !this.isArchived;
  }

  canAddExpenseItem(expense: ExpenseDto): boolean {
    return this.canAddOrEdit() && !this.isNewEntity(expense.id);
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

  addSubExpense(parentExpense: ExpenseDto): void {
    if (this.isNewEntity(parentExpense.id)) {
      return;
    }

    const newSubExpense = new ExpenseItemDto();
    newSubExpense.id = this.generateTempId('expense-item');
    newSubExpense.name = '';
    newSubExpense.date = toLocalNoonDate(this.currentDateService.currentDate);
    newSubExpense.amount = 0;
    newSubExpense.items = [];

    if (!parentExpense.items) {
      parentExpense.items = [];
    }

    parentExpense.items.push(newSubExpense);
    this.expandedExpenses.add(parentExpense.id);
  }

  updateExpense(): void {
    this.fillData(this.currentDateService.currentDate);
  }

  private isNewEntity(id: string | undefined): boolean {
    return !!id && id.startsWith('new-');
  }

  private generateTempId(prefix: string): string {
    return `new-${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
  }

  private focusNameInput(): void {
    setTimeout(() => this.nameInput?.nativeElement?.focus());
  }
}
