import { Component, Input, OnInit } from '@angular/core';
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { IncomeService } from '../../../core/services/income.service';
import { Router } from '@angular/router';
import { IncomeDto } from '../models/income-dto';
import { ReturnButtonComponent } from '../../../core/components/return-button/return-button.component';
import { ApiErrorResponse } from '../../../core/models/error';
import { ErrorMessageService } from '../../../core/services/error-message.service';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { CommonModule, getCurrencySymbol } from '@angular/common';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { todayUTC } from '../../../core/utils/date';
import { CurrentDateComponent } from '../../../core/components/current-date/current-date.component';
import { GlobalService } from '../../../core/services/global.service';
import { UserService } from '../../../core/services/user.service';
import { CurrencyMaskModule } from 'ng2-currency-mask';

@Component({
    selector: 'app-add-income',
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
    templateUrl: './add-income.component.html',
    styleUrl: './add-income.component.css'
})
export class AddIncomeComponent implements OnInit {
  private currentDate!: Date;
  incomeForm!: FormGroup;
  httpErrors = false;
  errors!: { [key: string]: string };
  currencySymbol!: string;
  thousandSeparator!: string; 
  decimalSeparator !: string; 

  @Input({ required: true })
    projectId!: string;

  constructor(
    private incomeService: IncomeService,
    private router: Router,
    private errorMessageService: ErrorMessageService,
    private globalService: GlobalService,
    private userService: UserService
  ) {
    this.thousandSeparator = this.globalService.groupSeparator;
    this.decimalSeparator  = this.globalService.decimalSeparator
    this.userService.loggedUser$.subscribe(value => this.currencySymbol = getCurrencySymbol(value.preferredCurrency, "narrow"));
  }

  ngOnInit(): void {
    this.currentDate = todayUTC();
    if (CurrentDateComponent.currentDate.getFullYear() !== this.currentDate.getFullYear() || CurrentDateComponent.currentDate.getMonth() !== this.currentDate.getMonth()) {
      this.currentDate = CurrentDateComponent.currentDate;
    }

    this.incomeForm = new FormGroup({
      name: new FormControl('', [Validators.required]),
      date: new FormControl(this.currentDate, [Validators.required]),
      amount: new FormControl(0, [Validators.min(0)])
    });
  }

  saveIncome() {
    if (this.incomeForm.valid) {
      const name = this.name?.value;
      const date = this.date?.value.toISOString().split("T")[0];
      let amount = this.amount?.value;
      if (isNaN(amount)) {
        amount = this.amount?.value.replace('.', '')?.replace(',', '.');
      }

      var newIncome = <IncomeDto>({
        name: name,
        date: date,
        amount: amount === "" ? 0 : amount
      });

      this.incomeService.add(this.projectId, newIncome).subscribe({
        next: response => {
          this.previous();
        },
        error: (response: ApiErrorResponse) => {
          this.httpErrors = true;
          this.errors = response.errors;

          this.errorMessageService.setFormErrors(this.incomeForm, this.errors);
        }
      });
    }
  }

  getFormFieldErrors(fieldName: string): string[] {
    const control = this.incomeForm.get(fieldName);
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

  get name() {
    return this.incomeForm.get('name');
  }
  get date() {
    return this.incomeForm.get('date');
  }
  get amount() {
    return this.incomeForm.get('amount');
  }

  previous() {
    this.router.navigate(['/projects', this.projectId, 'incomes']);
  }
}
