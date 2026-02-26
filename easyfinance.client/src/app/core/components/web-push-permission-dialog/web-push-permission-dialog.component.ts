import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-web-push-permission-dialog',
  imports: [
    MatButtonModule,
    MatIconModule,
    TranslateModule
  ],
  templateUrl: './web-push-permission-dialog.component.html',
  styleUrl: './web-push-permission-dialog.component.css'
})
export class WebPushPermissionDialogComponent {
  private dialogRef = inject(MatDialogRef<WebPushPermissionDialogComponent>);

  close(accept: boolean): void {
    this.dialogRef.close(accept);
  }
}
