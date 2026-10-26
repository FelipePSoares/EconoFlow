import { Component, ChangeDetectionStrategy } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslateDirective, TranslatePipe } from '@ngx-translate/core';

@Component({
  selector: 'app-offline',
  imports: [
    RouterLink,
    TranslateDirective,
    TranslatePipe
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
