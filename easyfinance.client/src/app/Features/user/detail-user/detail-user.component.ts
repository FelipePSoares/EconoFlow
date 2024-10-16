import { Component, OnInit } from '@angular/core';
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faCheck, faCircleCheck, faCircleXmark, faFloppyDisk, faPenToSquare, faEnvelopeOpenText } from '@fortawesome/free-solid-svg-icons';
import { UserService } from '../../../core/services/user.service';
import { Observable } from 'rxjs';
import { User } from '../../../core/models/User';
import { AsyncPipe, CommonModule } from '@angular/common';
import { ApiErrorResponse } from '../../../core/models/error';
import { ErrorMessageService } from '../../../core/services/error-message.service';
import { passwordMatchValidator } from '../../../core/utils/custom-validators/password-match-validator';

@Component({
  selector: 'app-detail-user',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    AsyncPipe,
    ReactiveFormsModule,
    FontAwesomeModule],
  templateUrl: './detail-user.component.html',
  styleUrls: ['./detail-user.component.css', '../../styles/shared.scss']
})
export class DetailUserComponent implements OnInit {
  user$: Observable<User>;
  editingUser!: User;
  isEmailUpdated: boolean = false;
  isPasswordUpdated: boolean = false;
  passwordFormActive: boolean = false;

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

  constructor(private userService: UserService, private errorMessageService: ErrorMessageService) {
    this.user$ = this.userService.loggedUser$;
  }

  ngOnInit(): void {
    this.reset();
  }

  reset() {
    this.user$.subscribe(user => {
      this.userForm = new FormGroup({
        firstName: new FormControl(user.firstName, [Validators.required]),
        lastName: new FormControl(user.lastName, [Validators.required]),
        email: new FormControl(user.email, [Validators.required, Validators.email]),
      });

      this.editingUser = user;

      this.userForm.disable();
    });
  }

  resetPasswordForm() {
    this.passwordForm = new FormGroup({
      oldPassword: new FormControl('', [Validators.required]),
      password: new FormControl('', [Validators.required, Validators.pattern(/^(?=.*[0-9])(?=.*[a-z])(?=.*[A-Z])(?=.*\W)(?!.* ).{8,}$/)]),
      confirmPassword: new FormControl('', [Validators.required])
    }, { validators: passwordMatchValidator });
  }

  changeStatus() {
    if (this.userForm.disabled) {
      this.userForm.enable();
    }
  }

  get firstName() {
    return this.userForm.get('firstName');
  }
  get lastName() {
    return this.userForm.get('lastName');
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

      this.userForm.disable();

      if (firstName !== this.editingUser.firstName || lastName !== this.editingUser.lastName) {
        this.userService.setUserInfo(firstName, lastName).subscribe({
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

  showPasswordForm(): void {
    this.resetPasswordForm();
    this.passwordFormActive = true;
  }
}
