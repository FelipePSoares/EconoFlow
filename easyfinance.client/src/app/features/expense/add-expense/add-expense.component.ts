import { Component, Input, OnInit } from '@angular/core';
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ExpenseService } from '../../../core/services/expense.service';
import { ActivatedRoute, Router } from '@angular/router';
import { ExpenseDto } from '../models/expense-dto';
import { ReturnButtonComponent } from '../../../core/components/return-button/return-button.component';
import { ErrorMessageService } from '../../../core/services/error-message.service';
import { ApiErrorResponse } from '../../../core/models/error';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { CommonModule } from '@angular/common';
import { MomentDateAdapter } from '@angular/material-moment-adapter';
import { MatDatepickerModule } from '@angular/material/datepicker';
import {
  MatNativeDateModule,
  DateAdapter,
  MAT_DATE_FORMATS,
  MAT_DATE_LOCALE,
} from '@angular/material/core';

export const MY_FORMATS = {
  parse: {
    dateInput: 'DD/MM/YYYY',
  },
  display: {
    dateInput: 'DD/MM/YYYY',
    monthYearLabel: 'MMMM YYYY',
    dateA11yLabel: 'DD/MM/YYYY',
    monthYearA11yLabel: 'MMMM YYYY',
  },
};

@Component({
  selector: 'app-add-expense',
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
    MatNativeDateModule
  ],
  templateUrl: './add-expense.component.html',
  styleUrl: './add-expense.component.css',
  providers: [
    {
      provide: DateAdapter,
      useClass: MomentDateAdapter,
      deps: [MAT_DATE_LOCALE],
    },

    { provide: MAT_DATE_FORMATS, useValue: MY_FORMATS },
  ]
})
export class AddExpenseComponent implements OnInit {
  private currentDate!: Date;
  expenseForm!: FormGroup;
  httpErrors = false;
  errors!: { [key: string]: string };

  @Input({ required: true })
  projectId!: string;

  @Input({ required: true })
  categoryId!: string;

  constructor(private expenseService: ExpenseService, private router: Router, private route: ActivatedRoute, private errorMessageService: ErrorMessageService) { }

  ngOnInit(): void {
    this.currentDate = new Date(this.route.snapshot.paramMap.get('currentDate')!);

    this.expenseForm = new FormGroup({
      name: new FormControl('', [Validators.required]),
      date: new FormControl(this.currentDate, [Validators.required]),
      amount: new FormControl('', [Validators.pattern('(\\d+)?(\\,\\d{1,2})?')]),
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
      let date = this.date?.value;
      let amount = this.amount?.value.replace('.', '').replace(',', '.');
      let budget = this.budget?.value;

      var newExpense = <ExpenseDto>({
        name: name,
        date: date,
        amount: amount === "" ? 0 : amount,
        budget: budget === "" ? 0 : budget
      });

      this.expenseService.add(this.projectId, this.categoryId, newExpense).subscribe({
        next: response => {
          this.router.navigate(['/projects', this.projectId, 'categories', this.categoryId, 'expenses', { currentDate: date }]);
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
              if (fieldName === 'amount') {
                errors.push('Invalid amount format. (0000,00)');
              }
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
    this.router.navigate(['/projects', this.projectId, 'categories', this.categoryId, 'expenses', { currentDate: this.currentDate.toISOString().substring(0, 10) }]);
  }
}
