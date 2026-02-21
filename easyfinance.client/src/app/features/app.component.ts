
import { filter, firstValueFrom } from 'rxjs';
import { FormsModule } from '@angular/forms';
import { ApplicationRef, Component, inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, DOCUMENT, isPlatformBrowser } from '@angular/common';
import { NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
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
    RouterLink,
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
  private readonly localizedPublicPaths = new Set([
    '',
    'privacy-policy',
    'use-terms',
    'contact-us',
    'how-to-create-budget'
  ]);

  private router = inject(Router);
  private dialog = inject(MatDialog);
  private versionCheckService = inject(VersionCheckService);
  private canonicalService = inject(CanonicalService);
  private noticationService = inject(NotificationService);
  private globalService = inject(GlobalService);
  private projectService = inject(ProjectService);
  private document = inject(DOCUMENT);
  private appRef = inject(ApplicationRef);
  private platformId = inject(PLATFORM_ID);
  private dateAdapter = inject(DateAdapter<Date>);

  private isSignedIn: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(false);
  isSignedIn$: Observable<boolean> = this.isSignedIn.asObservable();
  supportedLanguages = this.globalService.supportedLanguages;
  selectedLanguage = this.globalService.currentLanguage;
  selectedProjectId: string | null = null;
  selectedProjectName: string | null = null;
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
        this.selectedProjectName = userProject?.project?.name ?? null;
      });

      const initialRouteLanguage = this.getPublicRouteLanguageFromPath(this.document.location.pathname)
        ?? this.getPublicRouteLanguage(this.router.url);
      if (initialRouteLanguage) {
        this.selectedLanguage = initialRouteLanguage;
      }

      firstValueFrom(this.appRef.isStable.pipe(filter(Boolean))).then(async () => {
        const routeLanguage = this.getPublicRouteLanguageFromPath(this.document.location.pathname)
          ?? this.getPublicRouteLanguage(this.router.url);
        const storageLanguage = localStorage.getItem(this.globalService.languageStorageKey);

        const locale = routeLanguage || storageLanguage || navigator.language || this.globalService.currentLanguage || 'en';
        await this.globalService.setLocale(locale);
        this.dateAdapter.setLocale(this.globalService.currentLanguage);
        this.selectedLanguage = this.globalService.currentLanguage;
      });

      this.router.events
        .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
        .subscribe(event => {
          const routeLanguage = this.getPublicRouteLanguage(event.urlAfterRedirects);
          if (!routeLanguage || routeLanguage === this.globalService.currentLanguage) {
            return;
          }

          void this.globalService.setLocale(routeLanguage).then(() => {
            this.dateAdapter.setLocale(this.globalService.currentLanguage);
            this.selectedLanguage = this.globalService.currentLanguage;
          });
        });
    }
  }

  isLogin(): boolean {
    return this.getPrimaryRoutePath() === '/login';
  }

  isRegister(): boolean {
    return this.getPrimaryRoutePath() === '/register';
  }

  isRecovery(): boolean {
    return this.getPrimaryRoutePath() === '/recovery';
  }

  private getPrimaryRoutePath(): string {
    const primarySegments = this.router.parseUrl(this.router.url).root.children['primary']?.segments ?? [];
    const joinedPath = primarySegments.map(segment => segment.path).join('/');
    return `/${joinedPath}`;
  }

  async onLanguageChange(event: Event): Promise<void> {
    const target = event.target as HTMLSelectElement;
    const languageCode = target.value;

    await this.globalService.setLocale(languageCode);
    this.dateAdapter.setLocale(this.globalService.currentLanguage);
    this.selectedLanguage = this.globalService.currentLanguage;
    await this.updatePublicRouteLanguage(this.globalService.currentLanguage);
  }

  getPublicRoute(path: string = ''): string {
    const normalizedPath = path.trim().replace(/^\/+|\/+$/g, '');
    const isPortuguese = this.isPortugueseLanguage(this.selectedLanguage);

    if (isPortuguese) {
      return normalizedPath ? `/pt/${normalizedPath}` : '/pt';
    }

    return normalizedPath ? `/${normalizedPath}` : '/';
  }

  getPublicRouteCommands(path: string = ''): string[] {
    return this.toAbsoluteCommands(this.getPublicRoute(path));
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
      autoFocus: false,
      width: '560px',
      maxWidth: '95vw',
      data: {
        titleSuffix: this.selectedProjectName
      }
    }).afterClosed().subscribe(() => {
      this.router.navigate([{ outlets: { modal: null } }]);
    });
  }

  private getPublicRouteLanguage(url: string): string | null {
    const localizedRoute = this.parseLocalizedPublicRoute(url);
    return localizedRoute?.language ?? null;
  }

  private getPublicRouteLanguageFromPath(pathname: string): string | null {
    const primarySegments = pathname
      .replace(/^\/+|\/+$/g, '')
      .split('/')
      .filter(segment => segment.length > 0);

    const localizedRoute = this.parseLocalizedPublicRouteFromSegments(primarySegments);
    return localizedRoute?.language ?? null;
  }

  private parseLocalizedPublicRoute(url: string): { language: 'en' | 'pt', path: string } | null {
    const primarySegments = this.router.parseUrl(url).root.children['primary']?.segments.map(segment => segment.path) ?? [];
    return this.parseLocalizedPublicRouteFromSegments(primarySegments);
  }

  private parseLocalizedPublicRouteFromSegments(primarySegments: string[]): { language: 'en' | 'pt', path: string } | null {
    if (primarySegments[0] === 'pt') {
      const localizedPath = primarySegments.slice(1).join('/');
      if (this.localizedPublicPaths.has(localizedPath)) {
        return { language: 'pt', path: localizedPath };
      }

      return null;
    }

    const defaultPath = primarySegments.join('/');
    if (this.localizedPublicPaths.has(defaultPath)) {
      return { language: 'en', path: defaultPath };
    }

    return null;
  }

  private async updatePublicRouteLanguage(languageCode: string): Promise<void> {
    const localizedRoute = this.parseLocalizedPublicRoute(this.router.url);
    if (!localizedRoute) {
      return;
    }

    const targetLanguage: 'en' | 'pt' = this.isPortugueseLanguage(languageCode) ? 'pt' : 'en';
    if (localizedRoute.language === targetLanguage) {
      return;
    }

    const targetPath = targetLanguage === 'pt'
      ? localizedRoute.path ? `/pt/${localizedRoute.path}` : '/pt'
      : localizedRoute.path ? `/${localizedRoute.path}` : '/';

    const parsedCurrentUrl = this.router.parseUrl(this.router.url);
    const urlTree = this.router.createUrlTree(
      this.toAbsoluteCommands(targetPath),
      {
        queryParams: parsedCurrentUrl.queryParams,
        fragment: parsedCurrentUrl.fragment ?? undefined
      }
    );

    await this.router.navigateByUrl(urlTree, { replaceUrl: true });
  }

  private toAbsoluteCommands(path: string): string[] {
    const normalizedPath = path.trim().replace(/^\/+|\/+$/g, '');
    if (!normalizedPath) {
      return ['/'];
    }

    return ['/', ...normalizedPath.split('/')];
  }

  private isPortugueseLanguage(languageCode: string): boolean {
    return languageCode.toLowerCase().startsWith('pt');
  }
}
