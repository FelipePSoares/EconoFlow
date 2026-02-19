
import { filter, firstValueFrom } from 'rxjs';
import { FormsModule } from '@angular/forms';
import { ApplicationRef, Component, inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Router, RouterOutlet } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { MomentDateAdapter, MAT_MOMENT_DATE_ADAPTER_OPTIONS, MAT_MOMENT_DATE_FORMATS } from '@angular/material-moment-adapter';
import { BehaviorSubject } from 'rxjs/internal/BehaviorSubject';
import { Observable } from 'rxjs/internal/Observable';
import { AuthService } from '../core/services/auth.service';
import { NavBarComponent } from '../core/components/nav-bar/nav-bar.component';
import { SpinnerComponent } from '../core/components/spinner/spinner.component';
import { TranslateModule } from '@ngx-translate/core';
import { VersionCheckService } from '../core/services/version-check.service';
import { CanonicalService } from '../core/services/canonical.service';
import { AddButtonComponent } from '../core/components/add-button/add-button.component';
import { PageModalComponent } from '../core/components/page-modal/page-modal.component';

import {
  DateAdapter,
  MAT_DATE_FORMATS,
  MAT_DATE_LOCALE,
} from '@angular/material/core';
import { NotificationService } from '../core/services/notification.service';
import { GlobalService } from '../core/services/global.service';
import { ProjectService } from '../core/services/project.service';

@Component({
  selector: 'app-root',
  imports: [
    CommonModule,
    RouterOutlet,
    NavBarComponent,
    SpinnerComponent,
    TranslateModule,
    FormsModule,
    AddButtonComponent
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
    { provide: MAT_DATE_FORMATS, useValue: MAT_MOMENT_DATE_FORMATS },
  ]
})

export class AppComponent {
  private router = inject(Router);
  private dialog = inject(MatDialog);
  private versionCheckService = inject(VersionCheckService);
  private canonicalService = inject(CanonicalService);
  private noticationService = inject(NotificationService);
  private globalService = inject(GlobalService);
  private projectService = inject(ProjectService);
  private appRef = inject(ApplicationRef);
  private platformId = inject(PLATFORM_ID);
  private dateAdapter = inject(DateAdapter<Date>);

  private isSignedIn: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(false);
  isSignedIn$: Observable<boolean> = this.isSignedIn.asObservable();
  supportedLanguages = this.globalService.supportedLanguages;
  selectedLanguage = this.globalService.currentLanguage;
  selectedProjectId: string | null = null;
  addButtons = ['income', 'expense', 'expense item'];

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

      this.projectService.selectedUserProject$.subscribe(userProject => {
        this.selectedProjectId = userProject?.project?.id ?? null;
      });

      firstValueFrom(this.appRef.isStable.pipe(filter(Boolean))).then(async () => {
        const storageLanguage = localStorage.getItem(this.globalService.languageStorageKey);

        const locale = storageLanguage || navigator.language || this.globalService.currentLanguage || 'en';
        await this.globalService.setLocale(locale);
        this.dateAdapter.setLocale(this.globalService.currentLanguage);
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

  async onLanguageChange(event: Event): Promise<void> {
    const target = event.target as HTMLSelectElement;
    const languageCode = target.value;

    await this.globalService.setLocale(languageCode);
    this.dateAdapter.setLocale(this.globalService.currentLanguage);
    this.selectedLanguage = this.globalService.currentLanguage;
  }

  addFromProject(action: string): void {
    if (!this.selectedProjectId || action === 'default') {
      return;
    }

    let modalRoute: string[] | null = null;
    switch (action) {
      case 'income':
        modalRoute = ['projects', this.selectedProjectId, 'add-income'];
        break;
      case 'expense':
        modalRoute = ['projects', this.selectedProjectId, 'add-expense'];
        break;
      case 'expense item':
        modalRoute = ['projects', this.selectedProjectId, 'add-expense-item'];
        break;
    }

    if (!modalRoute) {
      return;
    }

    this.router.navigate([{ outlets: { modal: modalRoute } }]);

    this.dialog.open(PageModalComponent, {
      autoFocus: false
    }).afterClosed().subscribe(() => {
      this.router.navigate([{ outlets: { modal: null } }]);
    });
  }
}
