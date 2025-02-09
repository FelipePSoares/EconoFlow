import { Component, OnInit } from '@angular/core';
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { UserService } from '../../../core/services/user.service';
import { CommonModule } from '@angular/common';
import { take } from 'rxjs';
import { CurrencyService } from '../../../core/services/currency.service';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatOptionModule } from '@angular/material/core';
import { ApiErrorResponse } from '../../../core/models/error';
import { ErrorMessageService } from '../../../core/services/error-message.service';
import { MatSelectModule } from '@angular/material/select';

@Component({
    selector: 'app-first-sign-in',
    imports: [
        CommonModule,
        FormsModule,
        ReactiveFormsModule,
        MatFormFieldModule,
        MatInputModule,
        MatButtonModule,
        MatSelectModule,
        MatOptionModule,
    ],
    templateUrl: './first-sign-in.component.html',
    styleUrls: ['./first-sign-in.component.css']
})
export class FirstSignInComponent implements OnInit {

  userForm!: FormGroup;
  httpErrors = false;
  errors!: { [key: string]: string };

  constructor(private userService: UserService, private currencyService: CurrencyService, private router: Router, private errorMessageService: ErrorMessageService) { }

  ngOnInit(): void {
    this.buildUserForm();
  }

  buildUserForm() {
    this.userForm = new FormGroup({
      firstName: new FormControl('', [Validators.required]),
      lastName: new FormControl('', [Validators.required]),
      preferredCurrency: new FormControl('', [Validators.required]),
    });
  }

  getCurrencies(): string[] {
    return this.currencyService.getAvailableCurrencies();
  }

  get firstName() {
    return this.userForm.get('firstName');
  }

  get lastName() {
    return this.userForm.get('lastName');
  }

  get preferredCurrency() {
    return this.userForm.get('preferredCurrency');
  }
  
  onSubmit(): void {
    if (this.userForm.valid) {
      const firstName = this.firstName?.value;
      const lastName = this.lastName?.value;
      const preferredCurrency = this.preferredCurrency?.value;

      this.userService.setUserInfo(firstName, lastName, preferredCurrency).pipe(take(1)).subscribe({
        next: response => {
          this.router.navigate(['/']);
        },
        error: (response: ApiErrorResponse) => {
          this.httpErrors = true;
          this.errors = response.errors;

          this.errorMessageService.setFormErrors(this.userForm, this.errors);
        }
      });
    }
  }

  getFormFieldErrors(fieldName: string): string[] {
    const control = this.userForm.get(fieldName);
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
}
