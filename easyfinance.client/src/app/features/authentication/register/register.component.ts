import { Component, OnInit } from '@angular/core';
import { AbstractControl, FormControl, FormGroup, FormsModule, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { passwordMatchValidator } from '../../../core/utils/custom-validators/password-match-validator';
import { CommonModule } from '@angular/common';
import { ApiErrorResponse } from '../../../core/models/error';
import { take } from 'rxjs';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import {MatIcon} from "@angular/material/icon";

@Component({
    selector: 'app-register',
    imports: [
        CommonModule,
        FormsModule,
        ReactiveFormsModule,
        RouterLink,
        MatFormFieldModule,
        MatInputModule,
        MatIcon,
    ],
    templateUrl: './register.component.html',
    styleUrls: ['./register.component.css']
})
export class RegisterComponent implements OnInit{
  registerForm!: FormGroup;
  httpErrors = false;
  errors!: { [key: string]: string };
  hidePassword = true;
  hideConfirmPassword = true;

  hasLowerCase = false;
  hasUpperCase = false;
  hasOneNumber = false;
  hasOneSpecial = false;
  hasMinCharacteres = false;

  constructor(private authService: AuthService, private router: Router) {
    this.authService.isSignedIn$.pipe(take(1)).subscribe(value => {
      if (value) {
        this.router.navigate(['/']);
      }
    });
  }

  ngOnInit(){
    this.buildRegisterForm();
  }

  buildRegisterForm(){
    this.registerForm = new FormGroup({
      email: new FormControl('', [Validators.required, Validators.email]),
      password: new FormControl('', [Validators.required, Validators.pattern(/^(?=.*[0-9])(?=.*[a-z])(?=.*[A-Z])(?=.*[\W_])(?!.* ).{8,}$/)]),
      confirmPassword: new FormControl('',[Validators.required])
    },{validators: passwordMatchValidator});

    this.registerForm.valueChanges.subscribe(value => {
      this.hasLowerCase = /[a-z]/.test(value.password);
      this.hasUpperCase = /[A-Z]/.test(value.password);
      this.hasOneNumber = /[0-9]/.test(value.password);
      this.hasOneSpecial = /[\W_]/.test(value.password);
      this.hasMinCharacteres = /^.{8,}$/.test(value.password);
    });
  }

  get email() {
    return this.registerForm.get('email');
  }
  get password() {
    return this.registerForm.get('password');
  }
  get confirmPassword() {
    return this.registerForm.get('confirmPassword');
  }

  onSubmit() {
    if (this.registerForm.valid) {
      const email = this.registerForm.get('email')?.value;
      const password = this.registerForm.get('password')?.value;

      this.authService.register(email, password).subscribe({
        next: response => {
          this.router.navigate(['login']);
        },
        error: (response: ApiErrorResponse) => {
          this.httpErrors = true;
          this.errors = response.errors;

          this.setFormErrors(this.errors);
        }
      });
    }
  }

  setFormErrors(errors: { [key: string]: string }) {
    for (let key in errors) {
      if (key.indexOf("Password") > -1) {
        const formControl = this.registerForm.get('password');
        this.setErrorFormControl(formControl, { [key]: errors[key] });
      }
      if (key.indexOf("Email") > -1) {
        const formControl = this.registerForm.get('email');
        this.setErrorFormControl(formControl, { [key]: errors[key] });
      }
    }
  }

  setErrorFormControl(formControl: AbstractControl | null, errors: ValidationErrors) {
    if (formControl) {
      const currentErrors = formControl.errors || {};
      const updatedErrors = { ...currentErrors, ...errors };
      formControl.setErrors(updatedErrors);
    }
  }

  getFormFieldErrors(fieldName: string): string[] {
    const control = this.registerForm.get(fieldName);
    const errors: string[] = [];

    if (control && control.errors) {
      for (const key in control.errors) {
        if (control.errors.hasOwnProperty(key)) {
          switch (key) {
            case 'required':
              errors.push('This field is required.');
              break;
            case 'email':
              errors.push('Invalid email format.');
              break;
            case 'pattern':
              errors.push('');
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
