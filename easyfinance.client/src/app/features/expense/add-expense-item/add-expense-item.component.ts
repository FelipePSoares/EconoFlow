import { Component, Input, OnInit } from '@angular/core';
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { ExpenseService } from '../../../core/services/expense.service';
import { ExpenseItemDto } from '../models/expense-item-dto';
import { map } from 'rxjs';
import { Expense } from '../../../core/models/expense';
import { mapper } from '../../../core/utils/mappings/mapper';
import { ExpenseDto } from '../models/expense-dto';
import { compare } from 'fast-json-patch';
import { ReturnButtonComponent } from '../../../core/components/return-button/return-button.component';
import { ErrorMessageService } from '../../../core/services/error-message.service';
import { ApiErrorResponse } from '../../../core/models/error';
import { CommonModule, getCurrencySymbol } from '@angular/common';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { SnackbarComponent } from '../../../core/components/snackbar/snackbar.component';
import { MatNativeDateModule } from '@angular/material/core';
import { todayUTC } from '../../../core/utils/date';
import { CurrentDateComponent } from '../../../core/components/current-date/current-date.component';
import { GlobalService } from '../../../core/services/global.service';
import { UserService } from '../../../core/services/user.service';
import { CurrencyMaskModule } from 'ng2-currency-mask';

@Component({
  selector: 'app-add-expense-item',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    ReturnButtonComponent,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatDatepickerModule,
    MatNativeDateModule,
    CurrencyMaskModule
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
  errors!: { [key: string]: string };
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
    private userService: UserService
  ) {
    this.thousandSeparator = this.globalService.groupSeparator;
    this.decimalSeparator = this.globalService.decimalSeparator
    this.userService.loggedUser$.subscribe(value => this.currencySymbol = getCurrencySymbol(value.preferredCurrency, "narrow"));
   }

  ngOnInit(): void {
    this.currentDate = todayUTC();
    if (CurrentDateComponent.currentDate.getFullYear() !== this.currentDate.getFullYear() || CurrentDateComponent.currentDate.getMonth() !== this.currentDate.getMonth()) {
      this.currentDate = CurrentDateComponent.currentDate;
    }

    this.expenseItemForm = new FormGroup({
      name: new FormControl('', [Validators.required]),
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
      let name = this.name?.value;
      let date = this.date?.value;
      let amount = this.amount?.value;
      if (isNaN(amount)) {
        amount = this.amount?.value.replace('.', '')?.replace(',', '.');
      }

      var newExpenseItem = <ExpenseItemDto>({
        name: name,
        date: date,
        amount: amount === "" ? 0 : amount,
      });

      let newExpense = structuredClone(this.expense)
      newExpense.items.push(newExpenseItem);

      var patch = compare(this.expense, newExpense);

      this.expenseService.update(this.projectId, this.categoryId, this.expenseId, patch).subscribe({
        next: response => {
          this.snackBar.openSuccessSnackbar('Created successfully!');
          this.previous();
        },
        error: (response: ApiErrorResponse) => {
          this.httpErrors = true;
          this.errors = response.errors;

          this.errorMessageService.setFormErrors(this.expenseItemForm, this.errors);
        }
      });
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

  previous() {
    this.router.navigate(['/projects', this.projectId, 'categories', this.categoryId, 'expenses', this.expenseId]);
  }
}
