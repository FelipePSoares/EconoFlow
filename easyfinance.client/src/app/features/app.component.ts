
import { filter, firstValueFrom } from 'rxjs';
import { FormsModule } from '@angular/forms';
import { ApplicationRef, Component, inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Router, RouterOutlet } from '@angular/router';
import { MomentDateAdapter, MAT_MOMENT_DATE_ADAPTER_OPTIONS } from '@angular/material-moment-adapter';
import { BehaviorSubject } from 'rxjs/internal/BehaviorSubject';
import { Observable } from 'rxjs/internal/Observable';
import { AuthService } from '../core/services/auth.service';
import { NavBarComponent } from '../core/components/nav-bar/nav-bar.component';
import { SpinnerComponent } from '../core/components/spinner/spinner.component';
import { TranslateModule } from '@ngx-translate/core';
import { VersionCheckService } from '../core/services/version-check.service';
import { CanonicalService } from '../core/services/canonical.service';

import {
  DateAdapter,
  MAT_DATE_FORMATS,
  MAT_DATE_LOCALE,
} from '@angular/material/core';
import * as moment from 'moment';
import { NotificationService } from '../core/services/notification.service';
import { GlobalService } from '../core/services/global.service';

export const MY_FORMATS = {
  parse: {
    dateInput: 'DD/MM/YYYY',
  },
  display: {
    dateInput: 'DD/MM/YYYY',
    monthYearLabel: 'MMMM YYYY',
    dateA11yLabel: 'DD/MM/YYYY',
    monthYearA11yLabel: 'MMMM YYYY',
  },
};

@Component({
  selector: 'app-root',
  imports: [
    CommonModule,
    RouterOutlet,
    NavBarComponent,
    SpinnerComponent,
    TranslateModule,
    FormsModule
  ],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
  providers: [
    { provide: MAT_MOMENT_DATE_ADAPTER_OPTIONS, useValue: { useUtc: true } },
    {
      provide: DateAdapter,
      useClass: MomentDateAdapter,
      deps: [MAT_DATE_LOCALE, MAT_MOMENT_DATE_ADAPTER_OPTIONS],
    },
    { provide: MAT_DATE_FORMATS, useValue: MY_FORMATS },
  ]
})

export class AppComponent {
  private router = inject(Router);
  private versionCheckService = inject(VersionCheckService);
  private canonicalService = inject(CanonicalService);
  private noticationService = inject(NotificationService);
  private globalService = inject(GlobalService);
  private appRef = inject(ApplicationRef);
  private platformId = inject(PLATFORM_ID);

  private isSignedIn: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(false);
  isSignedIn$: Observable<boolean> = this.isSignedIn.asObservable();
  supportedLanguages = this.globalService.supportedLanguages;
  selectedLanguage = this.globalService.currentLanguage;

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      this.versionCheckService.init();
      const authService = inject(AuthService);
      this.isSignedIn$ = authService.isSignedIn$;

      authService.isSignedIn$.subscribe(isSignedIn => {
        if (isSignedIn) {
          authService.startUserPolling();
          this.noticationService.startPolling();
        }
      });

      firstValueFrom(this.appRef.isStable.pipe(filter(Boolean))).then(async () => {
        const storageLanguage = localStorage.getItem(this.globalService.languageStorageKey);

        const locale = storageLanguage || navigator.language || this.globalService.currentLanguage || 'en';
        await this.globalService.setLocale(locale);
        this.selectedLanguage = this.globalService.currentLanguage;
      });
    }
  }

  isLogin(): boolean {
    return this.router.url === '/login';
  }

  isRegister(): boolean {
    return this.router.url === '/register';
  }

  isRecovery(): boolean {
    return this.router.url === '/recovery';
  }

  onLanguageChange(event: Event): void {
    const target = event.target as HTMLSelectElement;
    const languageCode = target.value;

    this.globalService.setLocale(languageCode);
  }
}
