import { Component, inject } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { GlobalService } from '../../../core/services/global.service';

@Component({
  selector: 'app-use-terms',
  imports: [
    TranslateModule
  ],
  templateUrl: './use-terms.component.html',
  styleUrl: './use-terms.component.css'
})
export class UseTermsComponent {
  private globalService = inject(GlobalService);

  isPortuguese(): boolean {
    return this.globalService.currentLanguage.startsWith('pt');
  }
}
