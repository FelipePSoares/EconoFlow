import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faPenToSquare, faTrash, faPlus } from '@fortawesome/free-solid-svg-icons';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { MatError, MatFormFieldModule, MatLabel } from '@angular/material/form-field';
import { MatDialog } from '@angular/material/dialog';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { compare } from 'fast-json-patch';
import { ExpenseDto } from '../models/expense-dto';
import { ExpenseItemDto } from '../models/expense-item-dto';
import { ExpenseService } from '../../../core/services/expense.service';
import { ConfirmDialogComponent } from '../../../core/components/confirm-dialog/confirm-dialog.component';
import { CurrencyFormatPipe } from '../../../core/utils/pipes/currency-format.pipe';
import { ErrorMessageService } from '../../../core/services/error-message.service';
import { ApiErrorResponse } from '../../../core/models/error';
import { Expense } from '../../../core/models/expense';
import { mapper } from '../../../core/utils/mappings/mapper';
import { CurrencyMaskModule } from 'ng2-currency-mask';
import { GlobalService } from '../../../core/services/global.service';
import { dateUTC } from '../../../core/utils/date';
import { MatInput } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'app-expense-item',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FontAwesomeModule,
    CurrencyFormatPipe,
    MatFormFieldModule,
    MatLabel,
    MatError,
    MatInput,
    MatButtonModule,
    MatDatepickerModule,
    TranslateModule,
    CurrencyMaskModule
  ],
  templateUrl: './expense-item.component.html',
  styleUrl: './expense-item.component.css'
})
export class ExpenseItemComponent {
  @Input({ required: true })
  projectId!: string;

  @Input({ required: true })
  categoryId!: string;

  @Input({ required: true })
  expense!: ExpenseDto;

  @Input({ required: true })
  subExpense!: ExpenseItemDto;

  @Input({ required: true })
  canAddOrEdit!: boolean

  @Output()
  expenseUpdateEvent = new EventEmitter();

  faPenToSquare = faPenToSquare;
  faTrash = faTrash;
  faPlus = faPlus;

  expenseItemForm!: FormGroup;
  editingSubExpense: ExpenseItemDto = new ExpenseItemDto();

  thousandSeparator!: string;
  decimalSeparator!: string;
  currencySymbol!: string;
  httpErrors = false;
  errors!: { [key: string]: string };

  constructor(
    private expenseService: ExpenseService,
    private translateService: TranslateService,
    private dialog: MatDialog,
    private errorMessageService: ErrorMessageService,
    private globalService: GlobalService
  ) {
    this.thousandSeparator = this.globalService.groupSeparator;
    this.decimalSeparator = this.globalService.decimalSeparator;
    this.currencySymbol = this.globalService.currencySymbol;
  }

  save(): void {
    if (this.expenseItemForm.valid) {
      const id = this.id?.value;
      const name = this.name?.value;
      const date = this.date?.value.toISOString().split("T")[0];
      const amount = this.amount?.value;

      const expenseItemsNewArray: ExpenseItemDto[] = JSON.parse(JSON.stringify(this.expense.items));

      expenseItemsNewArray.forEach(expenseItem => {
        if (expenseItem.id == id) {
          expenseItem.name = name;
          expenseItem.date = date;
          expenseItem.amount = amount === "" || amount === null ? 0 : amount;
        }
      })

      const newExpense = ({
        id: this.expense.id,
        name: this.expense.name,
        date: this.expense.date,
        amount: this.expense.amount,
        budget: this.expense.budget,
        items: expenseItemsNewArray
      }) as ExpenseDto;

      const patch = compare(this.expense, newExpense);

      this.expenseService.update(this.projectId, this.categoryId, this.expense.id, patch).subscribe({
        next: () => {
          this.expenseUpdateEvent.emit();
          this.editingSubExpense = new ExpenseItemDto();
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
    this.editingSubExpense = expenseItem;
    const newDate = dateUTC(expenseItem.date);
    this.expenseItemForm = new FormGroup({
      id: new FormControl(expenseItem.id),
      name: new FormControl(expenseItem.name, [Validators.required]),
      date: new FormControl(newDate, [Validators.required]),
      amount: new FormControl(expenseItem.amount, [Validators.min(0)]),
    });
  }

  cancelEdit(): void {
    this.editingSubExpense = new ExpenseItemDto();
  }

  deleteSubExpense(expense: ExpenseDto, subExpense: ExpenseItemDto) {
    this.expenseService.removeItem(this.projectId, this.categoryId, expense.id, subExpense.id).subscribe({
      next: () => {
        expense.items.forEach((item, index) => {
          if (item.id === subExpense.id) {
            expense.items.splice(index, 1);
          }
        });
      }
    });
  }

  triggerDeleteSubExpense(expense: ExpenseDto, subExpense: ExpenseItemDto): void {
    const message = this.translateService.instant('AreYouSureYouWantDeleteExpense', { value: subExpense.name });

    this.dialog.open(ConfirmDialogComponent, {
      data: { title: 'DeleteExpense', message: message, action: 'ButtonDelete' },
    }).afterClosed().subscribe((result) => {
      if (result) {
        this.deleteSubExpense(expense, subExpense);
      }
    });
  }

  getFormFieldErrors(fieldName: string): string[] {
    return this.errorMessageService.getFormFieldErrors(this.expenseItemForm, fieldName);
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
}
