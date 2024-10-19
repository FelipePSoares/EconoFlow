import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { AbstractControl, FormControl, FormGroup, FormsModule, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faEnvelopeOpenText } from '@fortawesome/free-solid-svg-icons';
import { AuthService } from '../../../core/services/auth.service';
import { ApiErrorResponse } from '../../../core/models/error';
import { passwordMatchValidator } from '../../../core/utils/custom-validators/password-match-validator';

@Component({
  selector: 'app-recovery',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterLink, FontAwesomeModule],
  templateUrl: './recovery.component.html',
  styleUrl: './recovery.component.css'
})
export class RecoveryComponent implements OnInit {
  faEnvelopeOpenText = faEnvelopeOpenText;
  recoveryForm!: FormGroup;
  resetPasswordForm!: FormGroup;
  sent: boolean = false;
  token!: string;
  serverEmail!: string;
  httpErrors = false;
  errors!: { [key: string]: string };

  constructor(private authService: AuthService, private route: ActivatedRoute, private router: Router) { }

  ngOnInit(): void {
    const queryParams = this.route.snapshot.queryParams;
    this.token = queryParams['token'];
    this.serverEmail = queryParams['email'];

    this.buildResetPasswordForm();
    this.buildRecoveryForm();
  }

  buildRecoveryForm() {
    this.recoveryForm = new FormGroup({
      email: new FormControl('', [Validators.email, Validators.required])
    });
  }

  buildResetPasswordForm() {
    this.resetPasswordForm = new FormGroup({
      password: new FormControl('', [Validators.required, Validators.pattern(/^(?=.*[0-9])(?=.*[a-z])(?=.*[A-Z])(?=.*\W)(?!.* ).{8,}$/)]),
      confirmPassword: new FormControl('', [Validators.required])
    }, { validators: passwordMatchValidator });
  }

  onSubmit() {
    if (this.recoveryForm.valid) {
      const email = this.email?.value;

      this.authService.forgotPassword(email).subscribe({
        next: response => {
          this.sent = true;
        },
        error: (response: ApiErrorResponse) => {
          this.httpErrors = true;
          this.errors = response.errors;

          this.setFormErrors(this.recoveryForm, this.errors);
        }
      });
    }
  }

  resetPassword() {
    if (this.resetPasswordForm.valid) {
      const newPassword = this.password?.value;

      this.authService.resetPassword(this.serverEmail, this.token, newPassword).subscribe({
        next: response => {
          this.router.navigate(['login']);
        },
        error: (response: ApiErrorResponse) => {
          this.httpErrors = true;
          this.errors = response.errors;

          this.setFormErrors(this.resetPasswordForm, this.errors);
        }
      });
    }
  }

  setFormErrors(form: FormGroup<any>, errors: { [key: string]: string }) {
    for (let key in errors) {
      if (key.indexOf("Password") > -1) {
        const formControl = form.get('password');
        this.setErrorFormControl(formControl, { [key]: errors[key] });
      }
      if (key.indexOf("Email") > -1) {
        const formControl = form.get('email');
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

  reset() {
    var emailField = this.recoveryForm.get('email');
    emailField?.setValue('');

    this.sent = false;
  }

  get email() {
    return this.recoveryForm.get('email');
  }

  get password() {
    return this.resetPasswordForm.get('password');
  }

  get confirmPassword() {
    return this.resetPasswordForm.get('confirmPassword');
  }

  getFormFieldErrors(fieldName: string): string[] {
    let control = this.recoveryForm.get(fieldName);
    if (!control) {
      control = this.resetPasswordForm.get(fieldName);
    }
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
              errors.push('Password must have:<ul><li>One lowercase character</li><li>One uppercase character</li><li>One number</li><li>One special character</li><li>8 characters minimum</li></ul>');
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
