import { Component, Input, OnInit } from '@angular/core';
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { map } from 'rxjs';
import { compare } from 'fast-json-patch';
import { CommonModule } from '@angular/common';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { CurrencyMaskModule } from 'ng2-currency-mask';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ExpenseService } from '../../../core/services/expense.service';
import { ExpenseItemDto } from '../models/expense-item-dto';
import { Expense } from '../../../core/models/expense';
import { mapper } from '../../../core/utils/mappings/mapper';
import { ExpenseDto } from '../models/expense-dto';
import { ErrorMessageService } from '../../../core/services/error-message.service';
import { ApiErrorResponse } from '../../../core/models/error';
import { SnackbarComponent } from '../../../core/components/snackbar/snackbar.component';
import { MatNativeDateModule } from '@angular/material/core';
import { formatDate } from '../../../core/utils/date';
import { CurrentDateComponent } from '../../../core/components/current-date/current-date.component';
import { GlobalService } from '../../../core/services/global.service';

@Component({
    selector: 'app-add-expense-item',
    imports: [
        CommonModule,
        FormsModule,
        ReactiveFormsModule,
        MatFormFieldModule,
        MatInputModule,
        MatButtonModule,
        MatIconModule,
        MatDatepickerModule,
        MatNativeDateModule,
        CurrencyMaskModule,
        TranslateModule
    ],
    templateUrl: './add-expense-item.component.html',
    styleUrl: './add-expense-item.component.css'
})
export class AddExpenseItemComponent implements OnInit {
  private expense!: ExpenseDto;
  private currentDate!: Date;
  expenseItemForm!: FormGroup;
  thousandSeparator!: string; 
  decimalSeparator!: string; 
  httpErrors = false;
  errors!: Record<string, string[]>;
  currencySymbol!: string;

  @Input({ required: true })
  projectId!: string;

  @Input({ required: true })
  categoryId!: string;

  @Input({ required: true })
  expenseId!: string;

  constructor(
    private expenseService: ExpenseService,
    private router: Router,
    private errorMessageService: ErrorMessageService,
    private snackBar: SnackbarComponent,
    private globalService: GlobalService,
    private translateService: TranslateService
  ) {
    this.thousandSeparator = this.globalService.groupSeparator;
    this.decimalSeparator = this.globalService.decimalSeparator;
    this.currencySymbol = this.globalService.currencySymbol;
   }

  ngOnInit(): void {
    this.currentDate = new Date();
    if (CurrentDateComponent.currentDate.getFullYear() !== this.currentDate.getFullYear() || CurrentDateComponent.currentDate.getMonth() !== this.currentDate.getMonth()) {
      this.currentDate = CurrentDateComponent.currentDate;
    }

    this.expenseItemForm = new FormGroup({
      name: new FormControl(''),
      date: new FormControl(this.currentDate, [Validators.required]),
      amount: new FormControl(0, [Validators.min(0)])
    });

    this.expenseService.getById(this.projectId, this.categoryId, this.expenseId)
      .pipe(map(expense => mapper.map(expense, Expense, ExpenseDto)))
      .subscribe(
        {
          next: res => this.expense = res
        });
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

  save() {
    if (this.expenseItemForm.valid) {
      const name = this.name?.value;
      const date: any = formatDate(this.date?.value);
      const amount = this.amount?.value;

      const newExpenseItem = ({
        name: name,
        date: date,
        amount: amount === "" || amount === null ? 0 : amount,
      }) as ExpenseItemDto;

      const newExpense = structuredClone(this.expense)
      newExpense.items.push(newExpenseItem);

      const patch = compare(this.expense, newExpense);

      this.expenseService.update(this.projectId, this.categoryId, this.expenseId, patch).subscribe({
        next: response => {
          this.snackBar.openSuccessSnackbar(this.translateService.instant('CreatedSuccess'));
          this.router.navigate([{ outlets: { modal: null } }]);
        },
        error: (response: ApiErrorResponse) => {
          this.httpErrors = true;
          this.errors = {};

          Object.entries(response.errors).forEach(([key, value]) => {
            const newKey = key.startsWith('Items.') ? key.replace(/^Items\./, '') : key;
            this.errors[newKey] = value;
          });

          this.errorMessageService.setFormErrors(this.expenseItemForm, this.errors);
        }
      });
    }
  }

  getFormFieldErrors(fieldName: string): string[] {
    return this.errorMessageService.getFormFieldErrors(this.expenseItemForm, fieldName);
  }
}
