import { CommonModule } from '@angular/common';
import { Component, Inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogActions, MatDialogClose, MatDialogContent, MatDialogRef, MatDialogTitle } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { TranslateModule } from '@ngx-translate/core';

declare var bootstrap: any;

@Component({
  selector: 'app-confirm-dialog',
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatDialogTitle,
    MatDialogContent,
    MatDialogActions,
    MatDialogClose,
    TranslateModule
  ],
    templateUrl: './confirm-dialog.component.html',
    styleUrl: './confirm-dialog.component.css'
})
export class ConfirmDialogComponent {
  title!: string;
  message!: SafeHtml;
  action!: string;
  modalInstance: any;

  constructor(
    private dialogRef: MatDialogRef<ConfirmDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { title: string, message: string, action: string}) {
    //this.title = title;
    //this.message = this.sanitizer.bypassSecurityTrustHtml(customMessage);
    //this.action = actionText;
  }

  close(isSuccess: boolean): void {
    this.dialogRef.close(isSuccess);
  }
}
