import { Component, Input, OnInit } from '@angular/core';
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ExpenseService } from '../../../core/services/expense.service';
import { Router } from '@angular/router';
import { ExpenseDto } from '../models/expense-dto';
import { ReturnButtonComponent } from '../../../core/components/return-button/return-button.component';
import { ErrorMessageService } from '../../../core/services/error-message.service';
import { ApiErrorResponse } from '../../../core/models/error';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { CommonModule, getCurrencySymbol } from '@angular/common';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { CurrentDateComponent } from '../../../core/components/current-date/current-date.component';
import { todayUTC } from '../../../core/utils/date';
import { CurrencyMaskModule } from 'ng2-currency-mask';
import { GlobalService } from '../../../core/services/global.service';
import { UserService } from '../../../core/services/user.service';

@Component({
    selector: 'app-add-expense',
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
    templateUrl: './add-expense.component.html',
    styleUrl: './add-expense.component.css'
})
export class AddExpenseComponent implements OnInit {
  private currentDate!: Date;
  expenseForm!: FormGroup;
  httpErrors = false;
  errors!: { [key: string]: string };
  currencySymbol!: string;
  thousandSeparator!: string; 
  decimalSeparator!: string; 

  @Input({ required: true })
  projectId!: string;

  @Input({ required: true })
  categoryId!: string;

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
  }

  ngOnInit(): void {
    this.currentDate = todayUTC();
    if (CurrentDateComponent.currentDate.getFullYear() !== this.currentDate.getFullYear() || CurrentDateComponent.currentDate.getMonth() !== this.currentDate.getMonth()) {
      this.currentDate = CurrentDateComponent.currentDate;
    }

    this.expenseForm = new FormGroup({
      name: new FormControl('', [Validators.required]),
      date: new FormControl(this.currentDate, [Validators.required]),
      amount: new FormControl(0, [Validators.min(0)]),
      budget: new FormControl('', [Validators.pattern('[0-9]*')]),
    });
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

  save() {
    if (this.expenseForm.valid) {
      let name = this.name?.value;
      let date = this.date?.value.toISOString().split("T")[0];
      let amount = this.amount?.value;
      let budget = this.budget?.value;

      var newExpense = <ExpenseDto>({
        name: name,
        date: date,
        amount: amount === "" ? 0 : amount,
        budget: budget === "" ? 0 : budget
      });

      this.expenseService.add(this.projectId, this.categoryId, newExpense).subscribe({
        next: response => {
          this.previous();
        },
        error: (response: ApiErrorResponse) => {
          this.httpErrors = true;
          this.errors = response.errors;

          this.errorMessageService.setFormErrors(this.expenseForm, this.errors);
        }
      });
    }
  }

  getFormFieldErrors(fieldName: string): string[] {
    const control = this.expenseForm.get(fieldName);
    const errors: string[] = [];

    if (control && control.errors) {
      for (const key in control.errors) {
        if (control.errors.hasOwnProperty(key)) {
          switch (key) {
            case 'required':
              errors.push('This field is required.');
              break;
            case 'pattern':
              if (fieldName === 'budget') {
                errors.push('Only numbers is valid.');
              }
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
    this.router.navigate(['/projects', this.projectId, 'categories', this.categoryId, 'expenses']);
  }
}
