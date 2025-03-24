import { Component, Input, OnInit, ViewChild } from '@angular/core';
import { BehaviorSubject, Observable, map } from 'rxjs';
import { AsyncPipe, CommonModule } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { compare } from 'fast-json-patch';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faPenToSquare, faTrash, faPlus } from '@fortawesome/free-solid-svg-icons';
import { MatError, MatFormField, MatInput, MatLabel, MatSuffix } from '@angular/material/input';
import { MatButton } from '@angular/material/button';
import { MatDatepicker, MatDatepickerInput, MatDatepickerToggle } from "@angular/material/datepicker";
import { CurrencyMaskModule } from 'ng2-currency-mask';
import { MatDialog } from '@angular/material/dialog';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ExpenseItemDto } from '../models/expense-item-dto';
import { ExpenseService } from '../../../core/services/expense.service';
import { mapper } from '../../../core/utils/mappings/mapper';
import { Expense } from '../../../core/models/expense';
import { ExpenseDto } from '../models/expense-dto';
import { AddButtonComponent } from '../../../core/components/add-button/add-button.component';
import { ReturnButtonComponent } from '../../../core/components/return-button/return-button.component';
import { ConfirmDialogComponent } from '../../../core/components/confirm-dialog/confirm-dialog.component';
import { CurrentDateComponent } from "../../../core/components/current-date/current-date.component";
import { ApiErrorResponse } from "../../../core/models/error";
import { ErrorMessageService } from "../../../core/services/error-message.service";
import { CurrencyFormatPipe } from '../../../core/utils/pipes/currency-format.pipe';
import { dateUTC } from '../../../core/utils/date';
import { GlobalService } from '../../../core/services/global.service';
import { PageModalComponent } from '../../../core/components/page-modal/page-modal.component';
import { UserProjectDto } from '../../project/models/user-project-dto';
import { ProjectService } from '../../../core/services/project.service';
import { Role } from '../../../core/enums/Role';

@Component({
    selector: 'app-list-expense-items',
    imports: [
        CommonModule,
        AsyncPipe,
        ReactiveFormsModule,
        AddButtonComponent,
        ReturnButtonComponent,
        FontAwesomeModule,
        ConfirmDialogComponent,
        CurrencyFormatPipe,
        MatFormField,
        MatLabel,
        MatError,
        MatInput,
        MatDatepicker,
        MatDatepickerInput,
        MatDatepickerToggle,
        MatSuffix,
        MatButton,
        CurrentDateComponent,
        CurrencyMaskModule,
        TranslateModule
    ],
    templateUrl: './list-expense-items.component.html',
    styleUrl: './list-expense-items.component.css'
})
export class ListExpenseItemsComponent implements OnInit {
  @ViewChild(ConfirmDialogComponent) ConfirmDialog!: ConfirmDialogComponent;

  faPenToSquare = faPenToSquare;
  faTrash = faTrash;
  faPlus = faPlus;

  private _expenseId!: string;

  private expense: BehaviorSubject<ExpenseDto> = new BehaviorSubject<ExpenseDto>(new ExpenseDto());
  expense$: Observable<ExpenseDto> = this.expense.asObservable();
  expenseName$: Observable<string> = this.expense.asObservable().pipe(map(e => e.name));

  expenseItemForm!: FormGroup;
  editingExpenseItem: ExpenseItemDto = new ExpenseItemDto();
  itemToDelete!: string;
  thousandSeparator!: string; 
  currencySymbol!: string;
  decimalSeparator!: string; 
  httpErrors = false;
  errors: any;
  userProject!: UserProjectDto;

  @Input({ required: true })
  categoryId!: string;

  @Input({ required: true })
  projectId!: string;

  get expenseId(): string {
    return this._expenseId;
  }

  @Input({ required: true })
  set expenseId(expenseId: string) {
    this._expenseId = expenseId;
    this.fillData();
  }

  @Input({ required: true })
  currentDate!: Date;

  constructor(
    private expenseService: ExpenseService,
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

    this.edit(new ExpenseItemDto());
  }

  fillData() {
    this.expenseService.getById(this.projectId, this.categoryId, this._expenseId)
      .pipe(map(expense => mapper.map(expense, Expense, ExpenseDto)))
      .subscribe(
        {
          next: res => {
            this.expense.next(res);
          }
        });
  }

  get id() {
    return this.expenseItemForm.get('id');
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

  save(): void {
    if (this.expenseItemForm.valid) {
      let id = this.id?.value;
      let name = this.name?.value;
      let date = this.date?.value.toISOString().split("T")[0];
      let amount = this.amount?.value;

      let expense = this.expense.getValue();
      let expenseItemsNewArray: ExpenseItemDto[] = JSON.parse(JSON.stringify(expense.items));

      expenseItemsNewArray.forEach(expenseItem => {
        if (expenseItem.id == id) {
          expenseItem.name = name;
          expenseItem.date = date;
          expenseItem.amount = amount === "" || amount === null ? 0 : amount;
        }
      })

      const newExpense = <ExpenseDto>({
        id: expense.id,
        name: expense.name,
        date: expense.date,
        amount: expense.amount,
        budget: expense.budget,
        items: expenseItemsNewArray
      });

      const patch = compare(expense, newExpense);

      this.expenseService.update(this.projectId, this.categoryId, this.expenseId, patch).subscribe({
        next: response => {
          this.expense.next(mapper.map(response, Expense, ExpenseDto));
          this.editingExpenseItem = new ExpenseItemDto();
        },
        error: (response: ApiErrorResponse) => {
          this.httpErrors = true;
          this.errors = response.errors;

          this.errorMessageService.setFormErrors(this.expenseItemForm, this.errors);
        }
      });
    }
  }

  edit(expenseItem: ExpenseItemDto): void {
    this.editingExpenseItem = expenseItem;
    let newDate = dateUTC(expenseItem.date);
    this.expenseItemForm = new FormGroup({
      id: new FormControl(expenseItem.id),
      name: new FormControl(expenseItem.name, [Validators.required]),
      date: new FormControl(newDate, [Validators.required]),
      amount: new FormControl(expenseItem.amount, [Validators.min(0)]),
    });
  }

  cancelEdit(): void {
    this.editingExpenseItem = new ExpenseItemDto();
  }

  add(): void {
    this.router.navigate([{ outlets: { modal: ['projects', this.projectId, 'categories', this.categoryId, 'expenses', this.expenseId, 'add-expense-item'] } }]);

    this.dialog.open(PageModalComponent, {
      autoFocus: 'input'
    }).afterClosed().subscribe((result) => {
      if (result) {
        this.fillData();
      }
      this.router.navigate([{ outlets: { modal: null } }]);
    });
  }

  remove(id: string): void {
    this.expenseService.removeItem(this.projectId, this.categoryId, this.expenseId, id).subscribe({
      next: response => {
        let expenseUpdated: ExpenseDto = this.expense.getValue();

        expenseUpdated.items.forEach((item, index) => {
          if (item.id === id) {
            expenseUpdated.items.splice(index, 1);
          }
        });

        this.expense.next(expenseUpdated);
      }
    });
  }


  previous() {
    this.router.navigate(['/projects', this.projectId, 'categories', this.categoryId, 'expenses', { currentDate: this.currentDate.toISOString().substring(0, 10) }]);
  }

  triggerDelete(expense: ExpenseItemDto): void {
    this.itemToDelete = expense.id;
    var message = this.translateService.instant('AreYouSureYouWantDeleteExpense', { value: expense.name });

    this.dialog.open(ConfirmDialogComponent, {
      data: { title: 'DeleteExpense', message: message, action: 'ButtonDelete' },
    }).afterClosed().subscribe((result) => {
      if (result) {
        this.remove(this.itemToDelete);
      }
    });
  }

  getFormFieldErrors(fieldName: string): string[] {
    return this.errorMessageService.getFormFieldErrors(this.expenseItemForm, fieldName);
  }

  canAddOrEdit(): boolean {
    return this.userProject.role === Role.Admin || this.userProject.role === Role.Manager;
  }
}
