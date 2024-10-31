import { Component, Input, OnInit } from '@angular/core';
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { IncomeService } from '../../../core/services/income.service';
import { ActivatedRoute, Router } from '@angular/router';
import { IncomeDto } from '../models/income-dto';
import { ReturnButtonComponent } from '../../../core/components/return-button/return-button.component';
import { ApiErrorResponse } from '../../../core/models/error';
import { ErrorMessageService } from '../../../core/services/error-message.service';
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
  selector: 'app-add-income',
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
  templateUrl: './add-income.component.html',
  styleUrl: './add-income.component.css',
  providers: [
    {
      provide: DateAdapter,
      useClass: MomentDateAdapter,
      deps: [MAT_DATE_LOCALE],
    },

    { provide: MAT_DATE_FORMATS, useValue: MY_FORMATS },
  ]
})
export class AddIncomeComponent implements OnInit {
  private currentDate!: Date;
  incomeForm!: FormGroup;
  httpErrors = false;
  errors!: { [key: string]: string };

  @Input({ required: true })
    projectId!: string;

  constructor(private incomeService: IncomeService, private router: Router, private route: ActivatedRoute, private errorMessageService: ErrorMessageService) { }

  ngOnInit(): void {
    var date = this.route.snapshot.paramMap.get('currentDate');
    this.currentDate = date ? new Date(date) : new Date();

    this.incomeForm = new FormGroup({
      name: new FormControl('', [Validators.required]),
      date: new FormControl(this.currentDate, [Validators.required]),
      amount: new FormControl('0', [Validators.required, Validators.pattern('(\\d+)?(\\,\\d{1,2})?')])
    });
  }

  saveIncome() {
    if (this.incomeForm.valid) {
      const name = this.name?.value;
      const date = this.date?.value;
      const amount = this.amount?.value.replace('.', '').replace(',', '.');

      var newIncome = <IncomeDto>({
        name: name,
        date: date,
        amount: amount
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
    this.router.navigate(['/projects', this.projectId, 'incomes', { currentDate: this.currentDate.toISOString().substring(0, 10) }]);
  }
}
