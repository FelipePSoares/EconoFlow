import { Component, inject } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

import { ApiErrorResponse } from '../../../core/models/error';
import { take } from 'rxjs';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIcon } from "@angular/material/icon";
import { TranslateModule } from '@ngx-translate/core';
import { ErrorMessageService } from '../../../core/services/error-message.service';
import { User } from '../../../core/models/user';

type LoginStep = 'credentials' | 'twoFactor';
interface SignInCredentials {
  email: string;
  password: string;
}

@Component({
    selector: 'app-login',
    imports: [
      ReactiveFormsModule,
      RouterLink,
      MatFormFieldModule,
      MatInputModule,
      MatIcon,
      TranslateModule
    ],
    templateUrl: './login.component.html',
    styleUrls: ['./login.component.css']
})
export class LoginComponent {
  private authService = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private errorMessageService = inject(ErrorMessageService);

  credentialsForm = new FormGroup({
    email: new FormControl('', [Validators.email, Validators.required, Validators.maxLength(256)]),
    password: new FormControl('', [Validators.required]),
  });
  twoFactorForm = new FormGroup({
    twoFactorCode: new FormControl('', [Validators.required, Validators.pattern(/^\d{6}$/)]),
    twoFactorRecoveryCode: new FormControl('')
  });

  httpErrors = false;
  errors: Record<string, string[]> = {};
  hide = true;
  loginStep: LoginStep = 'credentials';
  useRecoveryCode = false;
  private pendingCredentials: SignInCredentials | null = null;

  constructor() {
    this.setTwoFactorValidators();

    this.authService.isSignedIn$.pipe(take(1)).subscribe(value => {
      if (value) {
        this.navigateAfterSignIn();
      }
    });
  }

  get email() {
    return this.credentialsForm.get('email');
  }

  get password() {
    return this.credentialsForm.get('password');
  }

  get twoFactorCode() {
    return this.twoFactorForm.get('twoFactorCode');
  }

  get twoFactorRecoveryCode() {
    return this.twoFactorForm.get('twoFactorRecoveryCode');
  }

  onSubmitCredentials(): void {
    this.httpErrors = false;
    this.errors = {};

    if (!this.credentialsForm.valid) {
      this.credentialsForm.markAllAsTouched();
      return;
    }

    const email = this.credentialsForm.get('email')?.value ?? '';
    const password = this.credentialsForm.get('password')?.value ?? '';
    this.pendingCredentials = { email, password };

    this.authService.signIn(email, password).subscribe({
      next: response => this.handleSuccessfulSignIn(response),
      error: (response: ApiErrorResponse) => this.handleSignInError(response, { email, password })
    });
  }

  onSubmitTwoFactor(): void {
    this.httpErrors = false;
    this.errors = {};

    if (!this.twoFactorForm.valid || !this.pendingCredentials) {
      this.twoFactorForm.markAllAsTouched();
      return;
    }

    const twoFactorCode = this.useRecoveryCode
      ? undefined
      : (this.twoFactorForm.get('twoFactorCode')?.value ?? '');
    const twoFactorRecoveryCode = this.useRecoveryCode
      ? (this.twoFactorForm.get('twoFactorRecoveryCode')?.value ?? '')
      : undefined;

    this.authService.signIn(
      this.pendingCredentials.email,
      this.pendingCredentials.password,
      twoFactorCode,
      twoFactorRecoveryCode
    ).subscribe({
      next: response => this.handleSuccessfulSignIn(response),
      error: (response: ApiErrorResponse) => this.handleSignInError(response, this.pendingCredentials!)
    });
  }

  setRecoveryCodeMode(useRecoveryCode: boolean): void {
    this.useRecoveryCode = useRecoveryCode;
    this.twoFactorForm.reset({
      twoFactorCode: '',
      twoFactorRecoveryCode: ''
    });
    this.setTwoFactorValidators();
  }

  backToCredentials(): void {
    this.loginStep = 'credentials';
    this.useRecoveryCode = false;
    this.twoFactorForm.reset({
      twoFactorCode: '',
      twoFactorRecoveryCode: ''
    });
    this.setTwoFactorValidators();
    this.httpErrors = false;
    this.errors = {};
  }

  getFormFieldErrors(form: FormGroup, fieldName: string): string[] {
    return this.errorMessageService.getFormFieldErrors(form, fieldName);
  }

  private handleSuccessfulSignIn(response: User): void {
    this.pendingCredentials = null;
    this.navigateAfterSignIn(response.defaultProjectId);
  }

  private handleSignInError(response: ApiErrorResponse, credentials: SignInCredentials): void {
    this.httpErrors = true;
    this.errors = response.errors ?? {};

    if (this.isTwoFactorError(this.errors)) {
      this.pendingCredentials = credentials;
      this.loginStep = 'twoFactor';
      this.errorMessageService.setFormErrors(this.twoFactorForm, this.errors);
      return;
    }

    this.errorMessageService.setFormErrors(this.credentialsForm, this.errors);
  }

  private isTwoFactorError(errors: Record<string, string[]>): boolean {
    const generalErrors = errors['general'] ?? [];

    return generalErrors.includes('TwoFactorRequired')
      || generalErrors.includes('InvalidTwoFactorCode')
      || generalErrors.includes('InvalidTwoFactorRecoveryCode');
  }

  private setTwoFactorValidators(): void {
    if (this.useRecoveryCode) {
      this.twoFactorCode?.clearValidators();
      this.twoFactorRecoveryCode?.setValidators([Validators.required]);
    } else {
      this.twoFactorCode?.setValidators([Validators.required, Validators.pattern(/^\d{6}$/)]);
      this.twoFactorRecoveryCode?.clearValidators();
    }

    this.twoFactorCode?.updateValueAndValidity({ emitEvent: false });
    this.twoFactorRecoveryCode?.updateValueAndValidity({ emitEvent: false });
  }

  private navigateAfterSignIn(defaultProjectId?: string): void {
    const returnUrl = this.route.snapshot.queryParams['returnUrl'];

    if (returnUrl) {
      this.router.navigateByUrl(returnUrl);
      return;
    }

    if (defaultProjectId) {
      this.router.navigate(['/projects', defaultProjectId]);
      return;
    }

    this.router.navigate(['/projects']);
  }
}
