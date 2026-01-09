import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { debounceTime, distinctUntilChanged, Observable, Subscription } from 'rxjs';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatSelectModule } from '@angular/material/select';
import { MatOptionModule } from '@angular/material/core';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { UserService } from '../../../core/services/user.service';
import { DeleteUser, User } from '../../../core/models/user';

import { ApiErrorResponse } from '../../../core/models/error';
import { ErrorMessageService } from '../../../core/services/error-message.service';
import { ConfirmDialogComponent } from '../../../core/components/confirm-dialog/confirm-dialog.component';
import { SnackbarComponent } from '../../../core/components/snackbar/snackbar.component';
import { MatDialog } from '@angular/material/dialog';
import { compare } from 'fast-json-patch';

@Component({
  selector: 'app-account',
  imports: [
    FormsModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatSelectModule,
    MatOptionModule,
    TranslateModule,
    MatSlideToggleModule
],
  templateUrl: './account.component.html',
  styleUrl: './account.component.css'
})
export class AccountComponent implements OnInit, OnDestroy {
  // Private Properties
  private deleteToken!: string;
  private sub!: Subscription;
  private sub2!: Subscription;

  // ViewChild
  @ViewChild(ConfirmDialogComponent) ConfirmDialog!: ConfirmDialogComponent;

  // Observables & Forms
  user$: Observable<User>;
  userForm!: FormGroup;
  notificationForm!: FormGroup;

  // User & Validation State
  editingUser!: User;

  // Error Handling
  httpErrors = false;
  errors!: Record<string, string[]>;

  constructor(
    private userService: UserService,
    private router: Router,
    private errorMessageService: ErrorMessageService,
    private snackbar: SnackbarComponent,
    private dialog: MatDialog,
    private translateService: TranslateService
  ) {
    this.user$ = this.userService.loggedUser$;
  }

  ngOnInit(): void {
    this.reset();
  }

  /** User Form Initialization **/
  reset() {
    this.user$.subscribe(user => {
      this.userForm = new FormGroup({
        firstName: new FormControl(user.firstName, [Validators.required, Validators.maxLength(100)]),
        lastName: new FormControl(user.lastName, [Validators.required, Validators.maxLength(100)])
      });

      this.sub = this.userForm.valueChanges
        .pipe(
          debounceTime(800),
          distinctUntilChanged()
        )
        .subscribe(() => {
          this.saveGeneralInfo();
        });

      this.notificationForm = new FormGroup({
        isEmailNotificationChecked: new FormControl(user.notificationChannels?.some(n => n == "Email")),
        isPushNotificationChecked: new FormControl(user.notificationChannels?.some(n => n == "Push"))
      });

      this.sub2 = this.notificationForm.valueChanges
        .pipe(
          distinctUntilChanged()
      )
        .subscribe(change => {
          this.saveNotificationPreferences(change);
        });

      this.editingUser = user;
    });
  }

  /** Deletion Handling **/
  openDeleteDialog(): void {
    this.userService.deleteUser().subscribe({
      next: (response: DeleteUser) => {
        if (response?.confirmationToken) {
          this.deleteToken = response.confirmationToken;
          this.dialog.open(ConfirmDialogComponent, {
            data: { title: 'ConfirmDeletion', message: response.confirmationMessage, action: 'ButtonDelete' },
          }).afterClosed().subscribe((result) => {
            if (result && this.deleteToken) {
              this.userService.deleteUser(this.deleteToken).subscribe({
                next: () => {
                  this.userService.removeUserInfo();
                  this.router.navigate(['/']);
                },
              });
            }
          });
        }
      },
      error: () => {
        this.snackbar.openErrorSnackbar('FailToDeleteAccount');
      }
    });
  }

  /** Getters for Form Controls **/
  get firstName() { return this.userForm.get('firstName'); }
  get lastName() { return this.userForm.get('lastName'); }

  /** Getters for Form Controls **/
  saveGeneralInfo(): void {
    if (this.userForm.valid) {
      const { firstName, lastName } = this.userForm.value;

      const oldUser = ({
        firstName: this.editingUser.firstName,
        lastName: this.editingUser.lastName
      });

      const newUser = ({
        firstName,
        lastName
      });

      const patch = compare(oldUser, newUser);

      this.userService.update(patch).subscribe({
        next: (response: User) => this.editingUser = response,
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

  saveNotificationPreferences(value: { isEmailNotificationChecked: boolean, isPushNotificationChecked: boolean }): void {
    const oldUser = ({
      notificationChannels: this.editingUser.notificationChannels.join(',')
    });

    const notificationChannels = [
      ...(value.isEmailNotificationChecked ? ["Email"] : []),
      ...(value.isPushNotificationChecked ? ["Push"] : []),
    ].join(',');

    const newUser = ({
      ...(notificationChannels && notificationChannels.length > 0 && {
        notificationChannels
      })
    });

    const patch = compare(oldUser, newUser);

    this.userService.update(patch).subscribe({
      next: (response: User) => this.editingUser = response,
      error: (response: ApiErrorResponse) => {
        this.httpErrors = true;
        this.errors = response.errors;

        this.user$ = this.userService.loggedUser$;

        this.errorMessageService.setFormErrors(this.userForm, this.errors);

        if (this.errors['general']) {
          this.snackbar.openErrorSnackbar(this.translateService.instant('GenericError'));
        }
      }
    });
  }

  /** Error Handling **/
  getFormFieldErrors(form: FormGroup<any>, fieldName: string): string[] {
    return this.errorMessageService.getFormFieldErrors(form, fieldName);
  }

  ngOnDestroy() {
    this.sub.unsubscribe();
    this.sub2.unsubscribe();
  }
}
