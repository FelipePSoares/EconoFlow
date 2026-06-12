import { Component, ChangeDetectionStrategy } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-offline',
  imports: [
    RouterLink,
    TranslateModule
  ],
  templateUrl: './offline.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './offline.component.css'
})
export class OfflineComponent {
  reloadPage(): void {
    window.location.reload();
  }
}
