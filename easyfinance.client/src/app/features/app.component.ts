import { Component, Inject, Injector, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Router, RouterOutlet } from '@angular/router';
import { MomentDateAdapter, MAT_MOMENT_DATE_ADAPTER_OPTIONS } from '@angular/material-moment-adapter';
import { BehaviorSubject } from 'rxjs/internal/BehaviorSubject';
import { Observable } from 'rxjs/internal/Observable';
import { AuthService } from '../core/services/auth.service';
import { NavBarComponent } from '../core/components/nav-bar/nav-bar.component';
import { SpinnerComponent } from '../core/components/spinner/spinner.component';
import { TranslateModule } from '@ngx-translate/core';

import {
  DateAdapter,
  MAT_DATE_FORMATS,
  MAT_DATE_LOCALE,
} from '@angular/material/core';
import * as moment from 'moment';

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
        TranslateModule
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
  private isSignedIn: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(false);
  isSignedIn$: Observable<boolean> = this.isSignedIn.asObservable();

  constructor(
    private router: Router,
    private injector: Injector,
    @Inject(PLATFORM_ID) private platformId: object) {   
    if (isPlatformBrowser(this.platformId)) {
      const authService = injector.get(AuthService);
      this.isSignedIn$ = authService.isSignedIn$;

      authService.isSignedIn$.subscribe(isSignedIn => {
        if (isSignedIn){
          authService.startUserPolling();
        }
      });
    }
  }

  isIndex(): boolean {
    return this.router.url === '/';
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
}
