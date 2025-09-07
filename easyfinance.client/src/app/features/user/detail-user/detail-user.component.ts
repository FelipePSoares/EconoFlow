import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { debounceTime, distinctUntilChanged, Observable, Subscription } from 'rxjs';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatSelectModule } from '@angular/material/select';
import { MatOptionModule } from '@angular/material/core';
import { MatIcon } from "@angular/material/icon";
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { UserService } from '../../../core/services/user.service';
import { DeleteUser, User } from '../../../core/models/user';
import { AsyncPipe, CommonModule } from '@angular/common';
import { ApiErrorResponse } from '../../../core/models/error';
import { ErrorMessageService } from '../../../core/services/error-message.service';
import { ConfirmDialogComponent } from '../../../core/components/confirm-dialog/confirm-dialog.component';
import { SnackbarComponent } from '../../../core/components/snackbar/snackbar.component';
import { MatDialog } from '@angular/material/dialog';
import { compare } from 'fast-json-patch';

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
    TranslateModule,
    MatSlideToggleModule
  ],
  templateUrl: './detail-user.component.html',
  styleUrl: './detail-user.component.css'
})
export class DetailUserComponent implements OnInit, OnDestroy {
  // Private Properties
  private deleteToken!: string;
  private sub!: Subscription;

  // ViewChild
  @ViewChild(ConfirmDialogComponent) ConfirmDialog!: ConfirmDialogComponent;

  // Observables & Forms
  user$: Observable<User>;
  userForm!: FormGroup;

  // User & Validation State
  isEmailNotificationChecked = true;
  isPushNotificationChecked = true;

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
        firstName: new FormControl(user.firstName, [Validators.required]),
        lastName: new FormControl(user.lastName, [Validators.required])
      });

      this.sub = this.userForm.valueChanges
        .pipe(
          debounceTime(800),
          distinctUntilChanged()
        )
        .subscribe(() => {
          this.saveGeneralInfo();
        });

      this.isEmailNotificationChecked = user.notificationChannels.some(n => n == "Email");
      this.isPushNotificationChecked = user.notificationChannels.some(n => n == "Push");

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

  saveNotificationPreferences(): void {
    const oldUser = ({
      notificationChannels: this.editingUser.notificationChannels.join(',')
    });

    const notificationChannels = [
      ...(this.isEmailNotificationChecked ? ["Email"] : []),
      ...(this.isPushNotificationChecked ? ["Push"] : []),
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

        this.isEmailNotificationChecked = this.editingUser.notificationChannels.some(n => n == "Email");
        this.isPushNotificationChecked = this.editingUser.notificationChannels.some(n => n == "Push");

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
  }
}
