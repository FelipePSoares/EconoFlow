import { FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIcon } from "@angular/material/icon";
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faCheck } from '@fortawesome/free-solid-svg-icons';
import { UserService } from '../../../core/services/user.service';
import { passwordMatchValidator } from '../../../core/utils/custom-validators/password-match-validator';
import { ApiErrorResponse } from '../../../core/models/error';
import { ErrorMessageService } from '../../../core/services/error-message.service';

@Component({
  selector: 'app-password-authentication',
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    TranslateModule,
    MatFormFieldModule,
    MatInputModule,
    MatIcon,
    FontAwesomeModule,
  ],
  templateUrl: './password-authentication.component.html',
})
export class PasswordAuthenticationComponent implements OnInit {
  // User & Validation State
  isPasswordUpdated = false;
  hide = true;

  // Observables & Forms
  passwordForm!: FormGroup;

  // Error Handling
  httpErrors = false;
  errors!: Record<string, string[]>;

  // Password Validation Flags
  hasLowerCase = false;
  hasUpperCase = false;
  hasOneNumber = false;
  hasOneSpecial = false;
  hasMinCharacteres = false;

  // Icons
  faCheck = faCheck;

  constructor(
    private userService: UserService,
    private errorMessageService: ErrorMessageService) { }

  ngOnInit(): void {
    this.reset();
  }

  reset() {
    this.passwordForm = new FormGroup({
      oldPassword: new FormControl('', [Validators.required]),
      password: new FormControl('', [Validators.required, Validators.pattern(/^(?=.*[0-9])(?=.*[a-z])(?=.*[A-Z])(?=.*[\W_])(?!.* ).{8,}$/)]),
      confirmPassword: new FormControl('', [Validators.required])
    }, { validators: passwordMatchValidator });

    this.passwordForm.valueChanges.subscribe(value => {
      this.hasLowerCase = /[a-z]/.test(value.password);
      this.hasUpperCase = /[A-Z]/.test(value.password);
      this.hasOneNumber = /[0-9]/.test(value.password);
      this.hasOneSpecial = /[\W_]/.test(value.password);
      this.hasMinCharacteres = /^.{8,}$/.test(value.password);
    });
  }

  save() {
    if (this.passwordForm.valid && this.passwordForm.dirty && (this.passwordForm.value.password !== '' || this.passwordForm.value.confirmPassword !== '' || this.passwordForm.value.oldPassword !== '') && this.passwordForm.value.password === this.passwordForm.value.confirmPassword) {
      const { oldPassword, password } = this.passwordForm.value;
      this.passwordForm.disable();

      this.userService.manageInfo(undefined, password, oldPassword).subscribe({
        next: response => this.isPasswordUpdated = true,
        error: (response: ApiErrorResponse) => {
          this.httpErrors = true;
          this.errors = response.errors;
          this.errorMessageService.setFormErrors(this.passwordForm, this.errors);
        }
      });
    }
  }

  /** Getters for Form Controls **/
  get oldPassword() { return this.passwordForm.get('oldPassword'); }
  get password() { return this.passwordForm.get('password'); }
  get confirmPassword() { return this.passwordForm.get('confirmPassword'); }

  /** Error Handling **/
  getFormFieldErrors(form: FormGroup<any>, fieldName: string): string[] {
    return this.errorMessageService.getFormFieldErrors(form, fieldName);
  }
}
