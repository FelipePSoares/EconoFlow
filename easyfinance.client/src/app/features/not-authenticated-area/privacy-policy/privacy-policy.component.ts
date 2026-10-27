import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { TranslateDirective } from '@ngx-translate/core';
import { GlobalService } from '../../../core/services/global.service';

@Component({
  selector: 'app-privacy-policy',
  imports: [
  TranslateDirective
],
  templateUrl: './privacy-policy.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './privacy-policy.component.css'
})
export class PrivacyPolicyComponent {
  private globalService = inject(GlobalService);

  isPortuguese(): boolean {
    return this.globalService.currentLanguage.startsWith('pt');
  }
}
