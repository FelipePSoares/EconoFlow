import { Component, OnInit, ViewChild, TemplateRef  } from '@angular/core';
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faCheck, faCircleCheck, faCircleXmark, faFloppyDisk, faPenToSquare, faEnvelopeOpenText } from '@fortawesome/free-solid-svg-icons';
import { UserService } from '../../../core/services/user.service';
import { Observable } from 'rxjs';
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
  standalone: true,
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
  private deleteToken!: string;

  @ViewChild(ConfirmDialogComponent) ConfirmDialog!: ConfirmDialogComponent;
  user$: Observable<User>;
  editingUser!: User;
  isEmailUpdated: boolean = false;
  isPasswordUpdated: boolean = false;
  passwordFormActive: boolean = false;
  
  isModalOpen: boolean = false; 
  faCheck = faCheck;
  faCircleCheck = faCircleCheck;
  faCircleXmark = faCircleXmark;
  faFloppyDisk = faFloppyDisk;
  faPenToSquare = faPenToSquare;
  faEnvelopeOpenText = faEnvelopeOpenText;
  
  passwordForm!: FormGroup;
  userForm!: FormGroup;
  httpErrors = false;
  errors!: { [key: string]: string };
  hide = true;

  hasLowerCase = false;
  hasUpperCase = false;
  hasOneNumber = false;
  hasOneSpecial = false;
  hasMinCharacteres = false;
 
  constructor(private userService: UserService,  private router:Router, private currencyService: CurrencyService, private errorMessageService: ErrorMessageService) {
    this.user$ = this.userService.loggedUser$;
  }

  ngOnInit(): void {
    this.reset();
    this.resetPasswordForm();
  }

  reset() {
    this.user$.subscribe(user => {
      this.userForm = new FormGroup({
        firstName: new FormControl(user.firstName, [Validators.required]),
        lastName: new FormControl(user.lastName, [Validators.required]),
        preferredCurrency: new FormControl(user.preferredCurrency, [Validators.required]),
        email: new FormControl(user.email, [Validators.required, Validators.email]),
      });

      this.editingUser = user;
    });
  }

  resetPasswordForm() {
    this.passwordFormActive = false;
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
  
  openDeleteDialog(): void {
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

  get firstName() {
    return this.userForm.get('firstName');
  }
  get lastName() {
    return this.userForm.get('lastName');
  }
  get preferredCurrency() {
    return this.userForm.get('preferredCurrency');
  }
  get email() {
    return this.userForm.get('email');
  }

  get oldPassword() {
    return this.passwordForm.get('oldPassword');
  }
  get password() {
    return this.passwordForm.get('password');
  }
  get confirmPassword() {
    return this.passwordForm.get('confirmPassword');
  }

  save() {
    if (this.userForm.valid) {
      const firstName = this.firstName?.value;
      const lastName = this.lastName?.value;
      const email = this.email?.value;
      const preferredCurrency = this.preferredCurrency?.value;

      if (firstName !== this.editingUser.firstName || lastName !== this.editingUser.lastName || preferredCurrency !== this.editingUser.preferredCurrency) {
        this.userService.setUserInfo(firstName, lastName, preferredCurrency).subscribe({
          next: response => { },
          error: (response: ApiErrorResponse) => {
            this.userForm.enable();
            this.httpErrors = true;
            this.errors = response.errors;

            this.errorMessageService.setFormErrors(this.userForm, this.errors);
          }
        });
      }

      if (email !== this.editingUser.email) {
        this.userService.manageInfo(email).subscribe({
          next: response => {
            this.isEmailUpdated = true;
          },
          error: (response: ApiErrorResponse) => {
            this.userForm.enable();
            this.httpErrors = true;
            this.errors = response.errors;

            this.errorMessageService.setFormErrors(this.userForm, this.errors);
          }
        });
      }
    }
  }

  savePassword() {
    if (this.passwordForm.valid) {
      const oldPassword = this.oldPassword?.value;
      const password = this.password?.value;

      this.passwordForm.disable();

      this.userService.manageInfo(undefined, password, oldPassword).subscribe({
        next: response => {
          this.isPasswordUpdated = true;
          this.passwordFormActive = false;
        },
        error: (response: ApiErrorResponse) => {
          this.passwordForm.enable();
          this.httpErrors = true;
          this.errors = response.errors;

          this.errorMessageService.setFormErrors(this.passwordForm, this.errors);
        }
      });

    }
  }

  getFormFieldErrors(form: FormGroup<any>, fieldName: string): string[] {
    const control = form.get(fieldName);
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

  showPasswordForm(): void {
    this.resetPasswordForm();
    this.passwordFormActive = true;
  }

  getCurrencies(): string[] {
    return this.currencyService.getAvailableCurrencies();
  }
}
