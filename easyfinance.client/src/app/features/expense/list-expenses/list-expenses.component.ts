import { Component, Input, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { map } from 'rxjs/internal/operators/map';
import { BehaviorSubject } from 'rxjs/internal/BehaviorSubject';
import { Observable } from 'rxjs/internal/Observable';
import { AsyncPipe, CommonModule } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { compare } from 'fast-json-patch';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faPenToSquare, faTrash, faPlus, faChevronDown, faChevronRight } from '@fortawesome/free-solid-svg-icons';
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
import { Expense } from '../../../core/models/expense';
import { mapper } from '../../../core/utils/mappings/mapper';
import { ExpenseService } from '../../../core/services/expense.service';
import { AddButtonComponent } from '../../../core/components/add-button/add-button.component';
import { ReturnButtonComponent } from '../../../core/components/return-button/return-button.component';
import { CurrentDateComponent } from '../../../core/components/current-date/current-date.component';
import { ConfirmDialogComponent } from '../../../core/components/confirm-dialog/confirm-dialog.component';
import { dateUTC } from '../../../core/utils/date';
import { ErrorMessageService } from 'src/app/core/services/error-message.service';
import { GlobalService } from '../../../core/services/global.service';
import { CurrencyFormatPipe } from '../../../core/utils/pipes/currency-format.pipe';
import { PageModalComponent } from '../../../core/components/page-modal/page-modal.component';
import { UserProjectDto } from '../../project/models/user-project-dto';
import { ProjectService } from '../../../core/services/project.service';
import { Role } from '../../../core/enums/Role';
import { CategoryDto } from '../../category/models/category-dto';
import { CategoryService } from '../../../core/services/category.service';
import { Category } from '../../../core/models/category';
import { BudgetBarComponent } from '../../../core/components/budget-bar/budget-bar.component';
import { ExpenseItemDto } from '../models/expense-item-dto';
import { ExpenseItemComponent } from '../expense-item/expense-item.component';

@Component({
    selector: 'app-list-expenses',
  imports: [
      ExpenseItemComponent,
      CommonModule,
      AsyncPipe,
      ReactiveFormsModule,
      CurrentDateComponent,
      AddButtonComponent,
      ReturnButtonComponent,
      ConfirmDialogComponent,
      BudgetBarComponent,
      FontAwesomeModule,
      MatFormField,
      MatFormFieldModule,
      MatCardModule,
      MatInput,
      MatButton,
      MatDatepickerModule,
      CurrencyFormatPipe,
      CurrencyMaskModule,
      TranslateModule
    ],
    templateUrl: './list-expenses.component.html',
    styleUrl: './list-expenses.component.css'
})
export class ListExpensesComponent implements OnInit {
  private expandedExpenses: Set<string> = new Set<string>();

  faPenToSquare = faPenToSquare;
  faTrash = faTrash;
  faPlus = faPlus;
  faChevronDown = faChevronDown;
  faChevronRight = faChevronRight;


  private expenses: BehaviorSubject<ExpenseDto[]> = new BehaviorSubject<ExpenseDto[]>([new ExpenseDto()]);
  expenses$: Observable<ExpenseDto[]> = this.expenses.asObservable();

  private category: BehaviorSubject<CategoryDto> = new BehaviorSubject<CategoryDto>(new CategoryDto());
  categoryName$: Observable<string> = this.category.asObservable().pipe(map(c => c.name));

  expenseForm!: FormGroup;
  editingExpense: ExpenseDto = new ExpenseDto();
  httpErrors = false;
  errors!: Record<string, string[]>;
  thousandSeparator!: string; 
  decimalSeparator!: string;
  currencySymbol!: string;
  userProject!: UserProjectDto;

  @Input({ required: true })
  projectId!: string;

  @Input({ required: true })
  categoryId!: string;

  constructor(
    private expenseService: ExpenseService,
    private categoryService: CategoryService,
    private router: Router,
    private errorMessageService: ErrorMessageService,
    private globalService: GlobalService,
    private dialog: MatDialog,
    private projectService: ProjectService,
    private translateService: TranslateService
  ) {
    this.thousandSeparator = this.globalService.groupSeparator;
    this.decimalSeparator = this.globalService.decimalSeparator;
    this.currencySymbol = this.globalService.currencySymbol;
  }

  ngOnInit(): void {
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
      .pipe(map(category => mapper.map(category, Category, CategoryDto)))
      .subscribe(res => {
        this.category.next(res);
      }
    )

    this.fillData(CurrentDateComponent.currentDate);
    this.edit(new ExpenseDto());
  }

  fillData(date: Date) {
    this.expenseService.get(this.projectId, this.categoryId, date)
      .pipe(map(expenses => mapper.mapArray(expenses, Expense, ExpenseDto)))
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
    this.router.navigate(['/projects', this.projectId, 'categories', this.categoryId, 'expenses', id, { currentDate: CurrentDateComponent.currentDate.toISOString().substring(0, 10) }]);
  }

  save(): void {
    if (this.expenseForm.valid) {
      let id = this.id?.value;
      let name = this.name?.value;
      let date = this.date?.value.toISOString().split("T")[0];
      let amount = this.amount?.value;
      let budget = this.budget?.value;

      var newExpense = <ExpenseDto>({
        id: id,
        name: name,
        date: date,
        amount: amount === "" || amount === null ? 0 : amount,
        budget: budget === "" || budget === null ? 0 : budget,
        items: this.editingExpense.items
      })

      var patch = compare(this.editingExpense, newExpense);

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
    let newDate = dateUTC(expense.date);
    this.expenseForm = new FormGroup({
      id: new FormControl(expense.id),
      name: new FormControl(expense.name, [Validators.required]),
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
    this.editingExpense = new ExpenseDto();
  }

  remove(id: string): void {
    this.expenseService.remove(this.projectId, this.categoryId, id).subscribe({
      next: response => {
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
    this.router.navigate([{ outlets: { modal: ['projects', this.projectId, 'categories', this.categoryId, 'add-expense'] } }]);

    this.dialog.open(PageModalComponent, {
      autoFocus: 'input',
      data: {
        title: this.translateService.instant('CreateExpense')
      }
    }).afterClosed().subscribe((result) => {
      if (result) {
        this.fillData(CurrentDateComponent.currentDate);
      }
      this.router.navigate([{ outlets: { modal: null } }]);
    });
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
    return this.userProject.role === Role.Admin || this.userProject.role === Role.Manager;
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

  addSubExpense(parentExpense: Expense) {
    this.router.navigate([{ outlets: { modal: ['projects', this.projectId, 'categories', this.categoryId, 'expenses', parentExpense.id, 'add-expense-item'] } }]);

    this.dialog.open(PageModalComponent, {
      autoFocus: 'input'
    }).afterClosed().subscribe((result) => {
      if (result) {
        this.fillData(CurrentDateComponent.currentDate);
      }
      this.router.navigate([{ outlets: { modal: null } }]);
    });
  }

  updateExpense(): void {
    this.fillData(CurrentDateComponent.currentDate);
  }
}
