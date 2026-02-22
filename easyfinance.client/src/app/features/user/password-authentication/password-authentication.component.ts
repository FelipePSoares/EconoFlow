import { FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Component, inject, OnDestroy, OnInit } from '@angular/core';

import { TranslateModule } from '@ngx-translate/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIcon } from "@angular/material/icon";
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { Subscription, take } from 'rxjs';
import QRCode from 'qrcode';
import { UserService } from '../../../core/services/user.service';
import { passwordMatchValidator } from '../../../core/utils/custom-validators/password-match-validator';
import { ApiErrorResponse } from '../../../core/models/error';
import { ErrorMessageService } from '../../../core/services/error-message.service';
import { TwoFactorSecureActionRequest } from '../../../core/models/two-factor';

type TwoFactorSecureActionType = 'disable' | 'regenerate';

@Component({
  selector: 'app-password-authentication',
  imports: [
    FormsModule,
    ReactiveFormsModule,
    TranslateModule,
    MatFormFieldModule,
    MatInputModule,
    MatIcon
  ],
  templateUrl: './password-authentication.component.html',
  styleUrl: './password-authentication.component.css'
})
export class PasswordAuthenticationComponent implements OnInit, OnDestroy {
  private userService = inject(UserService);
  private errorMessageService = inject(ErrorMessageService);
  private domSanitizer = inject(DomSanitizer);

  // User & Validation State
  isPasswordUpdated = false;
  hide = true;
  hideSecureActionPassword = true;

  // Observables & Forms
  passwordForm!: FormGroup;
  twoFactorSetupForm!: FormGroup;
  secureTwoFactorForm!: FormGroup;
  private passwordFormSubscription: Subscription | null = null;

  // Error Handling
  httpErrors = false;
  errors: Record<string, string[]> = {};
  twoFactorHttpErrors = false;
  twoFactorErrors: Record<string, string[]> = {};

  // Password Validation Flags
  hasLowerCase = false;
  hasUpperCase = false;
  hasOneNumber = false;
  hasOneSpecial = false;
  hasMinCharacteres = false;

  // Two-factor state
  isTwoFactorEnabled = false;
  isLoadingTwoFactorSetup = false;
  isTwoFactorActionRunning = false;
  isTwoFactorSetupVisible = false;
  secureAction: TwoFactorSecureActionType | null = null;
  useRecoveryCodeForSecureAction = false;
  sharedKey = '';
  otpAuthUri = '';
  twoFactorQrCodeSvg: SafeHtml | null = null;
  recoveryCodes: string[] = [];
  showRecoveryCodes = false;

  ngOnInit(): void {
    this.reset();
    this.initializeTwoFactorForms();
    this.loadTwoFactorStatus();
  }

  ngOnDestroy(): void {
    this.passwordFormSubscription?.unsubscribe();
  }

  reset() {
    this.isPasswordUpdated = false;
    this.httpErrors = false;
    this.errors = {};

    this.passwordForm = new FormGroup({
      oldPassword: new FormControl('', [Validators.required]),
      password: new FormControl('', [Validators.required, Validators.pattern(/^(?=.*[0-9])(?=.*[a-z])(?=.*[A-Z])(?=.*[\W_])(?!.* ).{8,}$/)]),
      confirmPassword: new FormControl('', [Validators.required])
    }, { validators: passwordMatchValidator });

    this.passwordFormSubscription?.unsubscribe();
    this.passwordFormSubscription = this.passwordForm.valueChanges.subscribe(value => {
      const password = value.password ?? '';
      this.hasLowerCase = /[a-z]/.test(password);
      this.hasUpperCase = /[A-Z]/.test(password);
      this.hasOneNumber = /[0-9]/.test(password);
      this.hasOneSpecial = /[\W_]/.test(password);
      this.hasMinCharacteres = /^.{8,}$/.test(password);
    });
  }

  save() {
    if (this.passwordForm.valid && this.passwordForm.dirty && (this.passwordForm.value.password !== '' || this.passwordForm.value.confirmPassword !== '' || this.passwordForm.value.oldPassword !== '') && this.passwordForm.value.password === this.passwordForm.value.confirmPassword) {
      const { oldPassword, password } = this.passwordForm.value;
      this.passwordForm.disable();

      this.userService.manageInfo(undefined, password, oldPassword).subscribe({
        next: () => this.isPasswordUpdated = true,
        error: (response: ApiErrorResponse) => {
          this.httpErrors = true;
          this.errors = response.errors ?? {};
          this.errorMessageService.setFormErrors(this.passwordForm, this.errors);
          this.passwordForm.enable();
        }
      });
    }
  }

  startTwoFactorSetup(): void {
    this.twoFactorHttpErrors = false;
    this.twoFactorErrors = {};
    this.isLoadingTwoFactorSetup = true;
    this.isTwoFactorActionRunning = false;
    this.secureAction = null;

    this.userService.getTwoFactorSetup().subscribe({
      next: response => {
        this.isLoadingTwoFactorSetup = false;
        this.isTwoFactorEnabled = response.isTwoFactorEnabled;
        this.sharedKey = response.sharedKey;
        this.otpAuthUri = response.otpAuthUri;
        this.isTwoFactorSetupVisible = true;
        this.twoFactorSetupForm.reset({ code: '' });
        this.renderTwoFactorQrCode(response.otpAuthUri);
      },
      error: (response: ApiErrorResponse) => {
        this.isLoadingTwoFactorSetup = false;
        this.handleTwoFactorError(response);
      }
    });
  }

  enableTwoFactor(): void {
    this.twoFactorHttpErrors = false;
    this.twoFactorErrors = {};

    if (!this.twoFactorSetupForm.valid || !this.otpAuthUri) {
      this.twoFactorSetupForm.markAllAsTouched();
      return;
    }

    const code = this.normalizeTwoFactorCode(this.twoFactorSetupForm.get('code')?.value ?? '');
    this.isTwoFactorActionRunning = true;

    this.userService.enableTwoFactor(code).subscribe({
      next: response => {
        this.isTwoFactorActionRunning = false;
        this.isTwoFactorEnabled = response.twoFactorEnabled;
        this.isTwoFactorSetupVisible = false;
        this.twoFactorQrCodeSvg = null;
        this.sharedKey = '';
        this.otpAuthUri = '';
        this.twoFactorSetupForm.reset({ code: '' });
        this.showRecoveryCodes = true;
        this.recoveryCodes = response.recoveryCodes;
      },
      error: (response: ApiErrorResponse) => {
        this.isTwoFactorActionRunning = false;
        this.handleTwoFactorError(response, this.twoFactorSetupForm);
      }
    });
  }

  openSecureAction(action: TwoFactorSecureActionType): void {
    this.secureAction = action;
    this.twoFactorHttpErrors = false;
    this.twoFactorErrors = {};
    this.setSecureActionRecoveryMode(false);
    this.secureTwoFactorForm.reset({
      password: '',
      twoFactorCode: '',
      twoFactorRecoveryCode: ''
    });
  }

  cancelSecureAction(): void {
    this.secureAction = null;
    this.twoFactorHttpErrors = false;
    this.twoFactorErrors = {};
    this.isTwoFactorActionRunning = false;
  }

  setSecureActionRecoveryMode(useRecoveryCode: boolean): void {
    this.useRecoveryCodeForSecureAction = useRecoveryCode;

    if (useRecoveryCode) {
      this.secureTwoFactorCode?.clearValidators();
      this.secureTwoFactorRecoveryCode?.setValidators([Validators.required]);
    } else {
      this.secureTwoFactorCode?.setValidators([Validators.required, Validators.pattern(/^\d{6}$/)]);
      this.secureTwoFactorRecoveryCode?.clearValidators();
    }

    this.secureTwoFactorCode?.updateValueAndValidity({ emitEvent: false });
    this.secureTwoFactorRecoveryCode?.updateValueAndValidity({ emitEvent: false });
  }

  submitSecureAction(): void {
    this.twoFactorHttpErrors = false;
    this.twoFactorErrors = {};

    if (!this.secureAction) {
      return;
    }

    if (!this.secureTwoFactorForm.valid) {
      this.secureTwoFactorForm.markAllAsTouched();
      return;
    }

    const request: TwoFactorSecureActionRequest = {
      password: this.secureTwoFactorForm.get('password')?.value ?? '',
      twoFactorCode: this.useRecoveryCodeForSecureAction
        ? undefined
        : this.normalizeTwoFactorCode(this.secureTwoFactorForm.get('twoFactorCode')?.value ?? ''),
      twoFactorRecoveryCode: this.useRecoveryCodeForSecureAction
        ? this.normalizeRecoveryCode(this.secureTwoFactorForm.get('twoFactorRecoveryCode')?.value ?? '')
        : undefined
    };

    this.isTwoFactorActionRunning = true;

    if (this.secureAction === 'disable') {
      this.userService.disableTwoFactor(request).subscribe({
        next: response => {
          this.isTwoFactorActionRunning = false;
          this.isTwoFactorEnabled = response.twoFactorEnabled;
          this.secureAction = null;
          this.showRecoveryCodes = false;
          this.recoveryCodes = [];
          this.isTwoFactorSetupVisible = false;
          this.sharedKey = '';
          this.otpAuthUri = '';
          this.twoFactorQrCodeSvg = null;
        },
        error: (response: ApiErrorResponse) => {
          this.isTwoFactorActionRunning = false;
          this.handleTwoFactorError(response, this.secureTwoFactorForm);
        }
      });
      return;
    }

    this.userService.regenerateTwoFactorRecoveryCodes(request).subscribe({
      next: response => {
        this.isTwoFactorActionRunning = false;
        this.secureAction = null;
        this.recoveryCodes = response.recoveryCodes;
        this.showRecoveryCodes = true;
      },
      error: (response: ApiErrorResponse) => {
        this.isTwoFactorActionRunning = false;
        this.handleTwoFactorError(response, this.secureTwoFactorForm);
      }
    });
  }

  dismissRecoveryCodes(): void {
    this.showRecoveryCodes = false;
  }

  /** Getters for Form Controls **/
  get oldPassword() { return this.passwordForm.get('oldPassword'); }
  get password() { return this.passwordForm.get('password'); }
  get confirmPassword() { return this.passwordForm.get('confirmPassword'); }
  get twoFactorSetupCode() { return this.twoFactorSetupForm.get('code'); }
  get securePassword() { return this.secureTwoFactorForm.get('password'); }
  get secureTwoFactorCode() { return this.secureTwoFactorForm.get('twoFactorCode'); }
  get secureTwoFactorRecoveryCode() { return this.secureTwoFactorForm.get('twoFactorRecoveryCode'); }

  /** Error Handling **/
  getFormFieldErrors(form: FormGroup, fieldName: string): string[] {
    return this.errorMessageService.getFormFieldErrors(form, fieldName);
  }

  private initializeTwoFactorForms(): void {
    this.twoFactorSetupForm = new FormGroup({
      code: new FormControl('', [Validators.required, Validators.pattern(/^\d{6}$/)])
    });

    this.secureTwoFactorForm = new FormGroup({
      password: new FormControl('', [Validators.required]),
      twoFactorCode: new FormControl('', [Validators.required, Validators.pattern(/^\d{6}$/)]),
      twoFactorRecoveryCode: new FormControl('')
    });

    this.setSecureActionRecoveryMode(false);
  }

  private loadTwoFactorStatus(): void {
    this.userService.loggedUser$.pipe(take(1)).subscribe(user => {
      this.isTwoFactorEnabled = !!user?.twoFactorEnabled;
    });
  }

  private handleTwoFactorError(response: ApiErrorResponse, form?: FormGroup): void {
    this.twoFactorHttpErrors = true;
    this.twoFactorErrors = response.errors ?? {};

    if (form) {
      this.errorMessageService.setFormErrors(form, this.twoFactorErrors);
    }
  }

  private renderTwoFactorQrCode(otpAuthUri: string): void {
    this.twoFactorQrCodeSvg = null;

    QRCode.toString(otpAuthUri, {
      type: 'svg',
      width: 220,
      margin: 1
    }).then(svg => {
      this.twoFactorQrCodeSvg = this.domSanitizer.bypassSecurityTrustHtml(svg);
    }).catch(() => {
      this.twoFactorHttpErrors = true;
      this.twoFactorErrors = { general: ['TwoFactorQrCodeGenerationFailed'] };
    });
  }

  private normalizeTwoFactorCode(code: string): string {
    return (code ?? '').replace(/[\s-]/g, '');
  }

  private normalizeRecoveryCode(code: string): string {
    return (code ?? '').replace(/\s/g, '');
  }
}
