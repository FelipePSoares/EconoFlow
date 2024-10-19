import { Component, Input, OnInit } from '@angular/core';
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { IncomeService } from '../../../core/services/income.service';
import { ActivatedRoute, Router } from '@angular/router';
import { IncomeDto } from '../models/income-dto';
import { ReturnButtonComponent } from '../../../core/components/return-button/return-button.component';
import { ApiErrorResponse } from '../../../core/models/error';
import { ErrorMessageService } from '../../../core/services/error-message.service';

@Component({
  selector: 'app-add-income',
  standalone: true,
  imports: [FormsModule, ReactiveFormsModule, ReturnButtonComponent],
  templateUrl: './add-income.component.html',
  styleUrl: './add-income.component.css'
})
export class AddIncomeComponent implements OnInit {
  private currentDate!: Date;
  incomeForm!: FormGroup;
  httpErrors = false;
  errors: any;

  @Input({ required: true })
    projectId!: string;

  constructor(private incomeService: IncomeService, private router: Router, private route: ActivatedRoute, private errorMessageService: ErrorMessageService) { }

  ngOnInit(): void {
    this.currentDate = new Date(this.route.snapshot.paramMap.get('currentDate')!);

    this.incomeForm = new FormGroup({
      name: new FormControl('', [Validators.required]),
      date: new FormControl(this.currentDate.getFullYear() + '-' + String(this.currentDate.getMonth() + 1).padStart(2, '0') + '-' + String(this.currentDate.getDate()).padStart(2, '0'), [Validators.required, Validators.pattern('^\\d{4}\\-(0[1-9]|1[012])\\-(0[1-9]|[12][0-9]|3[01])$')]),
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
