import { Component, Input, ViewChild } from '@angular/core';
import { BehaviorSubject, Observable, map } from 'rxjs';
import { ExpenseItemDto } from '../models/expense-item-dto';
import { AsyncPipe, CommonModule, getCurrencySymbol } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ExpenseService } from '../../../core/services/expense.service';
import { mapper } from '../../../core/utils/mappings/mapper';
import { Expense } from '../../../core/models/expense';
import { ExpenseDto } from '../models/expense-dto';
import { Router } from '@angular/router';
import { compare } from 'fast-json-patch';
import { AddButtonComponent } from '../../../core/components/add-button/add-button.component';
import { ReturnButtonComponent } from '../../../core/components/return-button/return-button.component';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faPenToSquare, faTrash, faFloppyDisk } from '@fortawesome/free-solid-svg-icons';
import { ConfirmDialogComponent } from '../../../core/components/confirm-dialog/confirm-dialog.component';
import {
  MatError,
  MatFormField,
  MatInput,
  MatLabel,
  MatPrefix,
  MatSuffix
} from '@angular/material/input';
import { MatButton } from '@angular/material/button';
import { MatDatepicker, MatDatepickerInput, MatDatepickerToggle } from "@angular/material/datepicker";
import { CurrentDateComponent } from "../../../core/components/current-date/current-date.component";
import { ApiErrorResponse } from "../../../core/models/error";
import { ErrorMessageService } from "../../../core/services/error-message.service";
import { CurrencyFormatPipe } from '../../../core/utils/pipes/currency-format.pipe';
import { dateUTC } from '../../../core/utils/date';
import { GlobalService } from '../../../core/services/global.service';
import { UserService } from '../../../core/services/user.service';
import { CurrencyMaskModule } from 'ng2-currency-mask';

@Component({
  selector: 'app-list-expense-items',
  standalone: true,
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
    MatPrefix,
    MatButton,
    CurrentDateComponent,
    CurrencyMaskModule
  ],
  templateUrl: './list-expense-items.component.html',
  styleUrl: './list-expense-items.component.css'
})
export class ListExpenseItemsComponent {
  @ViewChild(ConfirmDialogComponent) ConfirmDialog!: ConfirmDialogComponent;
  faPenToSquare = faPenToSquare;
  faFloppyDisk = faFloppyDisk;
  faTrash = faTrash;
  private _expenseId!: string;
  private expense: BehaviorSubject<ExpenseDto> = new BehaviorSubject<ExpenseDto>(new ExpenseDto());
  expense$: Observable<ExpenseDto> = this.expense.asObservable();
  expenseItemForm!: FormGroup;
  editingExpenseItem: ExpenseItemDto = new ExpenseItemDto();
  itemToDelete!: string;
  thousandSeparator!: string; 
  currencySymbol!: string;
  decimalSeparator!: string; 
  httpErrors = false;
  errors: any;

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
    this.expenseService.getById(this.projectId, this.categoryId, this._expenseId)
      .pipe(map(expense => mapper.map(expense, Expense, ExpenseDto)))
      .subscribe(
        {
          next: res => {
            this.expense.next(res);
          }
        });
  }

  @Input({ required: true })
  currentDate!: Date;

  constructor(
    private expenseService: ExpenseService,
    private router: Router,
    private errorMessageService: ErrorMessageService,
    private globalService: GlobalService,
    private userService: UserService
  ) {
    this.thousandSeparator = this.globalService.groupSeparator;
    this.decimalSeparator = this.globalService.decimalSeparator
    this.userService.loggedUser$.subscribe(value => this.currencySymbol = getCurrencySymbol(value.preferredCurrency, "narrow"));
    this.edit(new ExpenseItemDto());
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
      let date = this.date?.value;
      let amount = this.amount?.value;

      let expense = this.expense.getValue();
      let expenseItemsNewArray: ExpenseItemDto[] = JSON.parse(JSON.stringify(expense.items));

      expenseItemsNewArray.forEach(expenseItem => {
        if (expenseItem.id == id) {
          expenseItem.name = name;
          expenseItem.date = dateUTC(date);
          expenseItem.amount = amount;
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
    this.router.navigate(['projects', this.projectId, 'categories', this.categoryId, 'expenses', this.expenseId, 'add-expense-item', { currentDate: this.currentDate.toJSON() }]);
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

  triggerDelete(itemId: string): void {
    this.itemToDelete = itemId;
    this.ConfirmDialog.openModal('Delete Item', 'Are you sure you want to delete this item?', 'Delete');
  }

  handleConfirmation(result: boolean): void {
    if (result) {
      this.remove(this.itemToDelete);
    }
  }

  getFormFieldErrors(fieldName: string): string[] {
    const control = this.expenseItemForm.get(fieldName);
    const errors: string[] = [];

    if (control && control.errors) {
      for (const key in control.errors) {
        if (control.errors.hasOwnProperty(key)) {
          switch (key) {
            case 'required':
              errors.push('This field is required.');
              break;
            case 'min':
              errors.push(`The value should be greater than ${control.errors[key].min}.`);
              break;
            default:
              errors.push(control.errors[key]);
          }
        }
      }
    }

    return errors;
  }
}
