import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { inject, Injectable, PLATFORM_ID } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { BehaviorSubject, firstValueFrom } from 'rxjs';
import { PwaInstallIosGuideDialogComponent } from '../components/pwa-install-ios-guide-dialog/pwa-install-ios-guide-dialog.component';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed', platform: string }>;
};

@Injectable({
  providedIn: 'root'
})
export class PwaInstallService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly document = inject(DOCUMENT);
  private readonly dialog = inject(MatDialog);

  private deferredPrompt: BeforeInstallPromptEvent | null = null;
  private readonly canInstallSubject = new BehaviorSubject<boolean>(false);
  private readonly isStandaloneSubject = new BehaviorSubject<boolean>(false);

  readonly canInstall$ = this.canInstallSubject.asObservable();
  readonly isStandalone$ = this.isStandaloneSubject.asObservable();

  constructor() {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    this.refreshStandaloneState();

    window.addEventListener('beforeinstallprompt', this.captureInstallPrompt as EventListener);
    window.addEventListener('appinstalled', this.handleInstalledEvent as EventListener);

    const displayModeMediaQuery = window.matchMedia('(display-mode: standalone)');
    if (typeof displayModeMediaQuery.addEventListener === 'function') {
      displayModeMediaQuery.addEventListener('change', this.handleDisplayModeChange);
    } else if (typeof displayModeMediaQuery.addListener === 'function') {
      displayModeMediaQuery.addListener(this.handleDisplayModeChange);
    }
  }

  async promptInstall(): Promise<boolean> {
    if (this.deferredPrompt) {
      await this.deferredPrompt.prompt();
      const choiceResult = await this.deferredPrompt.userChoice;
      this.deferredPrompt = null;
      this.refreshStandaloneState();

      return choiceResult.outcome === 'accepted';
    }

    if (this.isIosSafariInstallFallback()) {
      const dialogRef = this.dialog.open(PwaInstallIosGuideDialogComponent, {
        autoFocus: false,
        width: '420px',
        maxWidth: '95vw'
      });
      await firstValueFrom(dialogRef.afterClosed());
      return true;
    }

    return false;
  }

  private captureInstallPrompt = (event: Event): void => {
    if (this.isStandaloneMode()) {
      return;
    }

    const promptEvent = event as BeforeInstallPromptEvent;
    if (typeof promptEvent.prompt !== 'function') {
      return;
    }

    event.preventDefault();
    this.deferredPrompt = promptEvent;
    this.refreshStandaloneState();
  };

  private handleInstalledEvent = (): void => {
    this.deferredPrompt = null;
    this.refreshStandaloneState();
  };

  private handleDisplayModeChange = (): void => {
    this.refreshStandaloneState();
  };

  private refreshStandaloneState(): void {
    const isStandalone = this.isStandaloneMode();
    this.isStandaloneSubject.next(isStandalone);
    this.canInstallSubject.next(!isStandalone && (this.deferredPrompt !== null || this.isIosSafariInstallFallback()));
  }

  private isStandaloneMode(): boolean {
    const nav = this.document.defaultView?.navigator as Navigator & { standalone?: boolean };
    const displayModeStandalone = this.document.defaultView?.matchMedia('(display-mode: standalone)').matches ?? false;
    const iOSStandalone = nav?.standalone === true;
    const androidTrustedWebApp = this.document.referrer.startsWith('android-app://');

    return displayModeStandalone || iOSStandalone || androidTrustedWebApp;
  }

  private isIosSafariInstallFallback(): boolean {
    if (this.isStandaloneMode()) {
      return false;
    }

    const view = this.document.defaultView;
    if (!view) {
      return false;
    }

    const nav = view.navigator as Navigator & { standalone?: boolean, maxTouchPoints?: number };
    const userAgent = nav.userAgent ?? '';
    const platform = nav.platform ?? '';
    const maxTouchPoints = nav.maxTouchPoints ?? 0;

    const isIosDevice = /iPad|iPhone|iPod/i.test(userAgent) || (platform === 'MacIntel' && maxTouchPoints > 1);
    if (!isIosDevice) {
      return false;
    }

    const isSafari = /Safari/i.test(userAgent);
    const isUnsupportedBrowser = /CriOS|FxiOS|EdgiOS|OPiOS|YaBrowser|DuckDuckGo|GSA/i.test(userAgent);
    return isSafari && !isUnsupportedBrowser;
  }
}
