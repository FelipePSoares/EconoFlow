import { Component, ElementRef, EventEmitter, inject, Input, OnInit, Output, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
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
import { CurrencyMaskModule } from 'ng2-currency-mask';
import { GlobalService } from '../../../core/services/global.service';
import { formatDate } from '../../../core/utils/date';
import { MatInput } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { SnackbarComponent } from '../../../core/components/snackbar/snackbar.component';

@Component({
  selector: 'app-expense-item',
  imports: [
    CommonModule,
    ReactiveFormsModule,
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
export class ExpenseItemComponent implements OnInit {
  private expenseService = inject(ExpenseService);
  private translateService = inject(TranslateService);
  private dialog = inject(MatDialog);
  private errorMessageService = inject(ErrorMessageService);
  private globalService = inject(GlobalService);
  private snackBar = inject(SnackbarComponent);

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

  @ViewChild('nameInput')
  nameInput?: ElementRef<HTMLInputElement>;

  expenseItemForm!: FormGroup;
  editingSubExpense: ExpenseItemDto = new ExpenseItemDto();

  thousandSeparator!: string;
  decimalSeparator!: string;
  currencySymbol!: string;
  httpErrors = false;
  errors!: Record<string, string[]>;

  constructor() {
    this.thousandSeparator = this.globalService.groupSeparator;
    this.decimalSeparator = this.globalService.decimalSeparator;
    this.currencySymbol = this.globalService.currencySymbol;
  }

  save(): void {
    if (this.expenseItemForm.valid) {
      const id = this.id?.value;
      const name = this.name?.value;
      const date: any = formatDate(this.date?.value);
      const amount = this.amount?.value;
      const parsedAmount = amount === "" || amount === null ? 0 : amount;
      const isNewSubExpense = this.isNewEntity(id);

      if (isNewSubExpense) {
        const newExpenseItem = ({
          name: name,
          date: date,
          amount: parsedAmount,
          items: []
        }) as unknown as ExpenseItemDto;

        const baseExpense = structuredClone(this.expense) as ExpenseDto;
        baseExpense.items = baseExpense.items.filter(item => item.id !== id);

        const newExpense = structuredClone(baseExpense);
        newExpense.items.push(newExpenseItem);

        const patch = compare(baseExpense, newExpense);

        this.expenseService.update(this.projectId, this.categoryId, this.expense.id, patch).subscribe({
          next: () => {
            this.snackBar.openSuccessSnackbar(this.translateService.instant('CreatedSuccess'));
            this.expenseUpdateEvent.emit();
            this.editingSubExpense = new ExpenseItemDto();
          },
          error: (response: ApiErrorResponse) => {
            this.httpErrors = true;
            this.errors = {};

            Object.entries(response.errors).forEach(([key, value]) => {
              const newKey = key.replace(/^Items\.\d+\./, '').replace(/^Items\./, '');
              this.errors[newKey] = value;
            });

            this.errorMessageService.setFormErrors(this.expenseItemForm, this.errors);
          }
        });
        return;
      }

      const expenseItemsNewArray: ExpenseItemDto[] = JSON.parse(JSON.stringify(this.expense.items));

      expenseItemsNewArray.forEach(expenseItem => {
        if (expenseItem.id == id) {
          expenseItem.name = name;
          expenseItem.date = date;
          expenseItem.amount = parsedAmount;
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
    this.httpErrors = false;
    this.editingSubExpense = expenseItem;
    const newDate = new Date(expenseItem.date);
    this.expenseItemForm = new FormGroup({
      id: new FormControl(expenseItem.id),
      name: new FormControl(expenseItem.name, [Validators.maxLength(100)]),
      date: new FormControl(newDate, [Validators.required]),
      amount: new FormControl(expenseItem.amount, [Validators.min(0)]),
    });
  }

  cancelEdit(): void {
    if (this.isNewEntity(this.editingSubExpense.id)) {
      this.expense.items = this.expense.items.filter(item => item.id !== this.editingSubExpense.id);
    }

    this.editingSubExpense = new ExpenseItemDto();
  }

  deleteSubExpense(expense: ExpenseDto, subExpense: ExpenseItemDto) {
    this.expenseService.removeItem(this.projectId, this.categoryId, expense.id, subExpense.id).subscribe({
      next: () => {
        expense.items.forEach((item, index) => {
          if (item.id === subExpense.id) {
            expense.amount -= subExpense.amount;
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

  ngOnInit(): void {
    if (this.isNewEntity(this.subExpense.id)) {
      this.edit(this.subExpense);
      this.focusNameInput();
    }
  }

  private isNewEntity(id: string | undefined): boolean {
    return !!id && id.startsWith('new-');
  }

  private focusNameInput(): void {
    setTimeout(() => this.nameInput?.nativeElement?.focus());
  }
}
