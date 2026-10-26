import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { TranslateDirective } from '@ngx-translate/core';
import { GlobalService } from '../../../core/services/global.service';

@Component({
  selector: 'app-use-terms',
  imports: [
  TranslateDirective
],
  templateUrl: './use-terms.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './use-terms.component.css'
})
export class UseTermsComponent {
  private globalService = inject(GlobalService);

  isPortuguese(): boolean {
    return this.globalService.currentLanguage.startsWith('pt');
  }
}
