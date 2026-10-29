import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { TranslateDirective } from '@ngx-translate/core';
import { GlobalService } from '../../../core/services/global.service';
import {
  SECURITY_PAGE_LAST_UPDATED,
  SECURITY_REPORTING_ADDRESS,
  SecurityService
} from '../../../core/services/security.service';

@Component({
  selector: 'app-security',
  imports: [
    TranslateDirective
  ],
  templateUrl: './security.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './security.component.css'
})
export class SecurityComponent {
  private globalService = inject(GlobalService);
  private securityService = inject(SecurityService);

  /** Vulnerability reporting address, as published in /.well-known/security.txt. */
  readonly reportingAddress = SECURITY_REPORTING_ADDRESS;

  /** Date this page and `docs/security-user-guide.md` were last revised. */
  readonly lastUpdated = SECURITY_PAGE_LAST_UPDATED;

  readonly supportPeriod = this.securityService.getSupportPeriod();

  isPortuguese(): boolean {
    return this.globalService.currentLanguage.startsWith('pt');
  }
}
