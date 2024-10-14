import { Component, OnInit } from '@angular/core';
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faCircleCheck, faCircleXmark, faFloppyDisk, faPenToSquare, faEnvelopeOpenText } from '@fortawesome/free-solid-svg-icons';
import { UserService } from '../../../core/services/user.service';
import { Observable } from 'rxjs';
import { User } from '../../../core/models/User';
import { AsyncPipe, CommonModule } from '@angular/common';
import { ApiErrorResponse } from '../../../core/models/error';
import { ErrorMessageService } from '../../../core/services/error-message.service';

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

  faCircleCheck = faCircleCheck;
  faCircleXmark = faCircleXmark;
  faFloppyDisk = faFloppyDisk;
  faPenToSquare = faPenToSquare;
  faEnvelopeOpenText = faEnvelopeOpenText;

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
