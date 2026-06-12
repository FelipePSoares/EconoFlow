import { Component, Injectable, inject, ChangeDetectionStrategy } from '@angular/core';
import { MatSnackBar, MatSnackBarConfig } from '@angular/material/snack-bar';

@Component({
    selector: 'app-snackbar',
    imports: [],
    changeDetection: ChangeDetectionStrategy.Eager,
    template: ''
})
@Injectable({
  providedIn: 'root',
})
export class SnackbarComponent {
  private snackBar = inject(MatSnackBar);


  openSuccessSnackbar(
    message: string,
    action = 'Close',
    config: MatSnackBarConfig = { duration: 3000, horizontalPosition: 'center', verticalPosition: 'bottom', panelClass: ['success-snackbar'] }
  ) {
    this.snackBar.open(message, action, config);
  }

  openErrorSnackbar(
    message: string,
    action = 'Close',
    config: MatSnackBarConfig = { duration: 5000, horizontalPosition: 'center', verticalPosition: 'bottom', panelClass: ['error-snackbar'] }
  ) {
    this.snackBar.open(message, action, config);
  }
}
