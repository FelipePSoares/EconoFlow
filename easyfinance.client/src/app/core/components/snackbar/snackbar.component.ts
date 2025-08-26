import { Component, Injectable } from '@angular/core';
import { MatSnackBar, MatSnackBarConfig } from '@angular/material/snack-bar';
import { TranslateService } from '@ngx-translate/core';

@Component({
    selector: 'app-snackbar',
    imports: [],
    template: ''
})
@Injectable({
  providedIn: 'root',
})
export class SnackbarComponent {
  constructor(private snackBar: MatSnackBar, private translateService: TranslateService) {}

  openSuccessSnackbar(
    message: string,
    action = 'Close',
    config: MatSnackBarConfig = { duration: 3000, horizontalPosition: 'center', verticalPosition: 'bottom', panelClass: ['success-snackbar'] }
  ) {
    this.snackBar.open(this.translateService.instant(message), action, config);
  }

  openErrorSnackbar(
    message: string,
    action = 'Close',
    config: MatSnackBarConfig = { duration: 5000, horizontalPosition: 'center', verticalPosition: 'bottom', panelClass: ['error-snackbar'] }
  ) {
    this.snackBar.open(this.translateService.instant(message), action, config);
  }
}
