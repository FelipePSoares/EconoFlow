import { Component, OnInit } from '@angular/core';
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faCircleCheck, faCircleXmark } from '@fortawesome/free-solid-svg-icons';
import { UserService } from '../../../core/services/user.service';
import { Observable } from 'rxjs';
import { User } from '../../../core/models/User';
import { AsyncPipe, CommonModule } from '@angular/common';

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
  faCircleCheck = faCircleCheck;
  faCircleXmark = faCircleXmark;
  userForm!: FormGroup;
  httpErrors = false;
  errors!: { [key: string]: string };

  constructor(private userService: UserService) {
    this.user$ = this.userService.loggedUser$;
  }

  ngOnInit(): void {
    this.user$.subscribe(user => {
      this.userForm = new FormGroup({
        firstName: new FormControl(user.firstName, [Validators.required]),
        lastName: new FormControl(user.lastName, [Validators.required]),
        email: new FormControl(user.email, [Validators.required, Validators.email]),
      });

      this.firstName?.disable();
      this.lastName?.disable();
      this.email?.disable();
    });

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
