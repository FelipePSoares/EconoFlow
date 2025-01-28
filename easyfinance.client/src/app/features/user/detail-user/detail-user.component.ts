import { Component, OnInit, ViewChild, TemplateRef  } from '@angular/core';
import { AbstractControl, FormControl, FormGroup, FormsModule, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faCheck, faCircleCheck, faCircleXmark, faFloppyDisk, faPenToSquare, faEnvelopeOpenText } from '@fortawesome/free-solid-svg-icons';
import { UserService } from '../../../core/services/user.service';
import { Observable, pairwise, startWith } from 'rxjs';
import { DeleteUser, User } from '../../../core/models/user';
import { AsyncPipe, CommonModule } from '@angular/common';
import { ApiErrorResponse } from '../../../core/models/error';
import { ErrorMessageService } from '../../../core/services/error-message.service';
import { passwordMatchValidator } from '../../../core/utils/custom-validators/password-match-validator';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatSelectModule } from '@angular/material/select';
import { MatOptionModule } from '@angular/material/core';
import { CurrencyService } from '../../../core/services/currency.service';
import { MatIcon } from "@angular/material/icon";
import { Router } from '@angular/router'; 
import { ConfirmDialogComponent } from '../../../core/components/confirm-dialog/confirm-dialog.component';

@Component({
    selector: 'app-detail-user',
    imports: [
        CommonModule,
        FormsModule,
        AsyncPipe,
        ReactiveFormsModule,
        FontAwesomeModule,
        MatFormFieldModule,
        MatInputModule,
        MatButtonModule,
        MatSelectModule,
        MatOptionModule,
        MatIcon,
        ConfirmDialogComponent,
    ],
    templateUrl: './detail-user.component.html',
    styleUrl: './detail-user.component.css'
})
export class DetailUserComponent implements OnInit {
  // Private Properties
  private deleteToken!: string;
  private lastDialogCalled!: string;
  private oldValue!: string;

  // ViewChild
  @ViewChild(ConfirmDialogComponent) ConfirmDialog!: ConfirmDialogComponent;

  // Observables & Forms
  user$: Observable<User>;
  userForm!: FormGroup;
  passwordForm!: FormGroup;

  // User & Validation State
  editingUser!: User;
  isEmailUpdated = false;
  isPasswordUpdated = false;
  isModalOpen = false;
  hide = true;

  // Password Validation Flags
  hasLowerCase = false;
  hasUpperCase = false;
  hasOneNumber = false;
  hasOneSpecial = false;
  hasMinCharacteres = false;

  // Error Handling
  httpErrors = false;
  errors!: { [key: string]: string };

  // Icons
  faCheck = faCheck;
  faCircleCheck = faCircleCheck;
  faCircleXmark = faCircleXmark;
  faFloppyDisk = faFloppyDisk;
  faPenToSquare = faPenToSquare;
  faEnvelopeOpenText = faEnvelopeOpenText;

  constructor(
    private userService: UserService,
    private router: Router,
    private currencyService: CurrencyService,
    private errorMessageService: ErrorMessageService
  ) {
    this.user$ = this.userService.loggedUser$;
  }

  ngOnInit(): void {
    this.reset();
    this.resetPasswordForm();
  }

  /** User Form Initialization **/
  reset() {
    this.user$.subscribe(user => {
      this.userForm = new FormGroup({
        firstName: new FormControl(user.firstName, [Validators.required]),
        lastName: new FormControl(user.lastName, [Validators.required]),
        preferredCurrency: new FormControl(user.preferredCurrency, [Validators.required]),
        email: new FormControl(user.email, [Validators.required, Validators.email]),
      });

      this.preferredCurrency!.valueChanges
        .pipe(
          startWith(user.preferredCurrency),
          pairwise()
        )
        .subscribe(([oldValue, newValue]) => this.openChangeCurrencyDialog(oldValue, newValue));
      this.editingUser = user;
    });
  }

  resetPasswordForm() {
    this.passwordForm = new FormGroup({
      oldPassword: new FormControl('', []),
      password: new FormControl('', [
        (control: AbstractControl): ValidationErrors | null => 
          control.value ? Validators.pattern(/^(?=.*[0-9])(?=.*[a-z])(?=.*[A-Z])(?=.*[\W_])(?!.* ).{8,}$/)(control) : null
      ]),
      confirmPassword: new FormControl('', [])
    }, { validators: passwordMatchValidator });

    this.passwordForm.valueChanges.subscribe(value => {
      this.hasLowerCase = /[a-z]/.test(value.password);
      this.hasUpperCase = /[A-Z]/.test(value.password);
      this.hasOneNumber = /[0-9]/.test(value.password);
      this.hasOneSpecial = /[\W_]/.test(value.password);
      this.hasMinCharacteres = /^.{8,}$/.test(value.password);
    });
  }

  confirmCurrencyChange(result: boolean) {
    if (!result) {
      this.preferredCurrency?.setValue(this.oldValue, { emitEvent: false });
    }
  }

  /** Deletion Handling **/
  openDeleteDialog(): void {
    this.lastDialogCalled = 'deletion';
    this.userService.deleteUser().subscribe({
      next: (response: DeleteUser) => {
        if (response?.confirmationToken) {
          this.ConfirmDialog.openModal('Confirm Deletion', response.confirmationMessage, 'Delete');
          this.deleteToken = response.confirmationToken; 
        }
      },
    });
  }

  confirmDeletion(result: boolean): void {
    if (result && this.deleteToken) {
      this.userService.deleteUser(this.deleteToken).subscribe({
        next: (response) => {
          this.userService.removeUserInfo();
          this.router.navigate(['/']);
        },
      });
    }
  }

  /** Getters for Form Controls **/
  get firstName() { return this.userForm.get('firstName'); }
  get lastName() { return this.userForm.get('lastName'); }
  get preferredCurrency() { return this.userForm.get('preferredCurrency'); }
  get email() { return this.userForm.get('email'); }
  get oldPassword() { return this.passwordForm.get('oldPassword'); }
  get password() { return this.passwordForm.get('password'); }
  get confirmPassword() { return this.passwordForm.get('confirmPassword'); }

  /** Save User Information **/
  save() {
    if (this.userForm.valid) {
      const { firstName, lastName, email, preferredCurrency } = this.userForm.value;

      if (firstName !== this.editingUser.firstName || lastName !== this.editingUser.lastName || preferredCurrency !== this.editingUser.preferredCurrency) {
        this.userService.setUserInfo(firstName, lastName, preferredCurrency).subscribe({
          error: (response: ApiErrorResponse) => this.handleError(response, this.userForm)
        });
      }

      if (email !== this.editingUser.email) {
        this.userService.manageInfo(email).subscribe({
          next: () => this.isEmailUpdated = true,
          error: (response: ApiErrorResponse) => this.handleError(response, this.userForm)
        });
      }
    }
  }

  savePassword() {
    if (this.passwordForm.valid && this.passwordForm.dirty && (this.passwordForm.value.password !== '' || this.passwordForm.value.confirmPassword !== '' || this.passwordForm.value.oldPassword !== '') && this.passwordForm.value.password === this.passwordForm.value.confirmPassword) {
      const { oldPassword, password } = this.passwordForm.value;
      this.passwordForm.disable();

      this.userService.manageInfo(undefined, password, oldPassword).subscribe({
        next: response => this.isPasswordUpdated = true,
        error: (response: ApiErrorResponse) => this.handleError(response, this.passwordForm)
      });

    }
  }

  /** Error Handling **/
  private handleError(response: ApiErrorResponse, form: FormGroup): void {
    form.enable();
    this.httpErrors = true;
    this.errors = response.errors;
    this.errorMessageService.setFormErrors(form, this.errors);
  }

  getFormFieldErrors(form: FormGroup<any>, fieldName: string): string[] {
    const control = form.get(fieldName);
    if (!control?.errors) return [];

    return Object.keys(control.errors).map(key => {
      switch (key) {
        case 'required': return 'This field is required.';
        case 'email': return 'Invalid email format.';
        case 'pattern': return '';
        default: return control.errors ? control.errors[key] : 'an error occurred';
      }
    });
  }

  /** UI Actions **/
  getCurrencies(): string[] {
    return this.currencyService.getAvailableCurrencies();
  }

  openChangeCurrencyDialog(oldValue: string, newValue: string) {
    this.lastDialogCalled = 'currency';
    this.oldValue = oldValue;
    this.ConfirmDialog.openModal('Confirm', 'The values ​​will not be changed, only the currency symbol displayed on the screens will be changed.', 'Confirm');
  }

  confirm(result: boolean): void {
    if (this.lastDialogCalled == 'currency') {
      this.confirmCurrencyChange(result);
    } else if (this.lastDialogCalled == 'deletion') {
      this.confirmDeletion(result);
    }
  }
}
