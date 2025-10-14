import { FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Observable } from 'rxjs';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { UserService } from '../../../core/services/user.service';
import { ApiErrorResponse } from '../../../core/models/error';
import { ErrorMessageService } from '../../../core/services/error-message.service';
import { User } from '../../../core/models/user';
import { SnackbarComponent } from '../../../core/components/snackbar/snackbar.component';

@Component({
  selector: 'app-emails',
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    TranslateModule,
    MatFormFieldModule,
    MatInputModule,
    FontAwesomeModule,
  ],
  templateUrl: './emails.component.html',
})
export class EmailsComponent implements OnInit {
  // User & Validation State
  isEmailUpdated = false;
  editingUser!: User;
  currentEmail!: string;

  // Observables & Forms
  user$: Observable<User>;
  userForm!: FormGroup;

  // Error Handling
  httpErrors = false;
  errors!: Record<string, string[]>;

  constructor(
    private userService: UserService,
    private errorMessageService: ErrorMessageService,
    private snackbar: SnackbarComponent,
    private translateService: TranslateService) {
    this.user$ = this.userService.loggedUser$;
  }

  ngOnInit(): void {
    this.reset();
  }

  /** User Form Initialization **/
  reset() {
    this.user$.subscribe(user => {
      this.userForm = new FormGroup({
        email: new FormControl('', [Validators.required, Validators.email, Validators.maxLength(256)])
      });

      this.currentEmail = user.email;
      this.editingUser = user;
    });
  }

  updateEmail(): void {
    if (this.userForm.valid) {
      const { email } = this.userForm.value;

      this.userService.manageInfo(email).subscribe({
        next: () => this.isEmailUpdated = true,
        error: (response: ApiErrorResponse) => {
          this.httpErrors = true;
          this.errors = response.errors;

          this.errorMessageService.setFormErrors(this.userForm, this.errors);
        }
      });
    }
  }

  resendVerification(): void {
    this.userService.resendVerification().subscribe({
      next: () => this.snackbar.openSuccessSnackbar(this.translateService.instant('TheVerificationEmailWasResend'))
    });
  }

  /** Getters for Form Controls **/
  get email() { return this.userForm.get('email'); }

  /** Error Handling **/
  getFormFieldErrors(form: FormGroup<any>, fieldName: string): string[] {
    return this.errorMessageService.getFormFieldErrors(form, fieldName);
  }
}
