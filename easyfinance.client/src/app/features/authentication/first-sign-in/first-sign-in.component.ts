import { Component, inject } from '@angular/core';
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatOptionModule } from '@angular/material/core';
import { MatSelectModule } from '@angular/material/select';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { UserService } from '../../../core/services/user.service';
import { ApiErrorResponse } from '../../../core/models/error';
import { ErrorMessageService } from '../../../core/services/error-message.service';
import { GlobalService } from '../../../core/services/global.service';
import { User } from '../../../core/models/user';
import { SnackbarComponent } from '../../../core/components/snackbar/snackbar.component';
import { compare } from 'fast-json-patch';

@Component({
  selector: 'app-first-sign-in',
  imports: [
    FormsModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatSelectModule,
    MatOptionModule,
    TranslateModule
  ],
  templateUrl: './first-sign-in.component.html',
  styleUrls: ['./first-sign-in.component.css']
})
export class FirstSignInComponent {
  private userService = inject(UserService);
  private router = inject(Router);
  private errorMessageService = inject(ErrorMessageService);
  private globalService = inject(GlobalService);
  private snackbar = inject(SnackbarComponent);
  private translateService = inject(TranslateService);

  editingUser!: User;
  httpErrors = false;
  errors!: Record<string, string[]>;
  supportedLanguages = this.globalService.supportedLanguages;
  userForm = new FormGroup({
    firstName: new FormControl('', [Validators.required, Validators.maxLength(100)]),
    lastName: new FormControl('', [Validators.required, Validators.maxLength(100)]),
    languageCode: new FormControl(this.globalService.currentLanguage, [Validators.required])
  });

  constructor() {
    this.editingUser = new User();
    this.editingUser.languageCode = this.globalService.currentLanguage;
  }

  get firstName() {
    return this.userForm.get('firstName');
  }

  get lastName() {
    return this.userForm.get('lastName');
  }

  get languageCode() {
    return this.userForm.get('languageCode');
  }

  onSubmit(): void {
    if (this.userForm.valid) {

      const oldUser = ({
        firstName: this.editingUser.firstName,
        lastName: this.editingUser.lastName,
        languageCode: this.editingUser.languageCode
      });

      const { firstName, lastName, languageCode } = this.userForm.value;

      const newUser = ({
        firstName: firstName,
        lastName: lastName,
        languageCode: languageCode
      });

      const patch = compare(oldUser, newUser);

      this.userService.update(patch).subscribe({
        next: () => this.router.navigate(['/projects']),
        error: (response: ApiErrorResponse) => {
          this.httpErrors = true;
          this.errors = response.errors;

          this.errorMessageService.setFormErrors(this.userForm, this.errors);

          if (this.errors['general']) {
            this.snackbar.openErrorSnackbar(this.translateService.instant('GenericError'));
          }
        }
      });
    }
  }

  getFormFieldErrors(fieldName: string): string[] {
    return this.errorMessageService.getFormFieldErrors(this.userForm, fieldName);
  }
}
