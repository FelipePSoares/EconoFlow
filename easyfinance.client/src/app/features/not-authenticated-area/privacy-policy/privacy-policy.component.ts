import { Component, inject } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { GlobalService } from '../../../core/services/global.service';

@Component({
  selector: 'app-privacy-policy',
  imports: [
    TranslateModule
  ],
  templateUrl: './privacy-policy.component.html',
  styleUrl: './privacy-policy.component.css'
})
export class PrivacyPolicyComponent {
  private globalService = inject(GlobalService);

  isPortuguese(): boolean {
    return this.globalService.currentLanguage.startsWith('pt');
  }
}
