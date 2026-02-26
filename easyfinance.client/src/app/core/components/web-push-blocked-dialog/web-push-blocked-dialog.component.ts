import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-web-push-blocked-dialog',
  imports: [
    MatButtonModule,
    MatIconModule,
    TranslateModule
  ],
  templateUrl: './web-push-blocked-dialog.component.html',
  styleUrl: './web-push-blocked-dialog.component.css'
})
export class WebPushBlockedDialogComponent {
  private dialogRef = inject(MatDialogRef<WebPushBlockedDialogComponent>);

  close(tryAgain: boolean): void {
    this.dialogRef.close(tryAgain);
  }
}
