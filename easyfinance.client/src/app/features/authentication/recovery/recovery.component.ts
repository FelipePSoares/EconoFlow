import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faEnvelopeOpenText } from '@fortawesome/free-solid-svg-icons';
import { TranslateModule } from '@ngx-translate/core';
import { AuthService } from '../../../core/services/auth.service';
import { ApiErrorResponse } from '../../../core/models/error';
import { passwordMatchValidator } from '../../../core/utils/custom-validators/password-match-validator';
import { ErrorMessageService } from '../../../core/services/error-message.service';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIcon } from '@angular/material/icon';

@Component({
    selector: 'app-recovery',
    imports: [
      CommonModule,
      FormsModule,
      ReactiveFormsModule,
      FontAwesomeModule,
      TranslateModule,
      MatFormFieldModule,
      MatInputModule,
      MatIcon,
    ],
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
  hidePassword = true;
  hideConfirmPassword = true;

  hasLowerCase = false;
  hasUpperCase = false;
  hasOneNumber = false;
  hasOneSpecial = false;
  hasMinCharacteres = false;

  constructor(private authService: AuthService, private route: ActivatedRoute, private router: Router, private errorMessageService: ErrorMessageService) { }

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
      password: new FormControl('', [Validators.required, Validators.pattern(/^(?=.*[0-9])(?=.*[a-z])(?=.*[A-Z])(?=.*[\W_])(?!.* ).{8,}$/)]),
      confirmPassword: new FormControl('', [Validators.required])
    }, { validators: passwordMatchValidator });

    this.resetPasswordForm.valueChanges.subscribe(value => {
      this.hasLowerCase = /[a-z]/.test(value.password);
      this.hasUpperCase = /[A-Z]/.test(value.password);
      this.hasOneNumber = /[0-9]/.test(value.password);
      this.hasOneSpecial = /[\W_]/.test(value.password);
      this.hasMinCharacteres = /^.{8,}$/.test(value.password);
    });
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

          this.errorMessageService.setFormErrors(this.recoveryForm, this.errors);
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

          this.errorMessageService.setFormErrors(this.resetPasswordForm, this.errors);
        }
      });
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
    if (control) {
      return this.errorMessageService.getFormFieldErrors(this.recoveryForm, fieldName);
    }
    return this.errorMessageService.getFormFieldErrors(this.resetPasswordForm, fieldName);
  }
}
