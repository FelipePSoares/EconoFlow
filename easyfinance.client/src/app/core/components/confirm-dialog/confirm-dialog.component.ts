
import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogContent, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { SafeHtml } from '@angular/platform-browser';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-confirm-dialog',
  imports: [
    MatButtonModule,
    MatIconModule,
    MatDialogContent,
    TranslateModule
],
    templateUrl: './confirm-dialog.component.html',
    styleUrl: './confirm-dialog.component.css'
})
export class ConfirmDialogComponent {
  private dialogRef = inject<MatDialogRef<ConfirmDialogComponent>>(MatDialogRef);
  data = inject<{
    title: string;
    message: string;
    action: string;
}>(MAT_DIALOG_DATA);

  title!: string;
  message!: SafeHtml;
  action!: string;
  modalInstance: unknown;

  close(isSuccess: boolean): void {
    this.dialogRef.close(isSuccess);
  }
}
