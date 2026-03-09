import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-pwa-install-ios-guide-dialog',
  imports: [
    MatButtonModule,
    MatIconModule,
    TranslateModule
  ],
  templateUrl: './pwa-install-ios-guide-dialog.component.html',
  styleUrl: './pwa-install-ios-guide-dialog.component.css'
})
export class PwaInstallIosGuideDialogComponent {
  private dialogRef = inject(MatDialogRef<PwaInstallIosGuideDialogComponent>);

  close(): void {
    this.dialogRef.close();
  }
}
