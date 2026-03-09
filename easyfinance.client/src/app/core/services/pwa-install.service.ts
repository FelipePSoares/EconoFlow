import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { inject, Injectable, PLATFORM_ID } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

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
    if (!this.deferredPrompt) {
      return false;
    }

    await this.deferredPrompt.prompt();
    const choiceResult = await this.deferredPrompt.userChoice;
    this.deferredPrompt = null;
    this.canInstallSubject.next(false);
    this.refreshStandaloneState();

    return choiceResult.outcome === 'accepted';
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
    this.canInstallSubject.next(true);
  };

  private handleInstalledEvent = (): void => {
    this.deferredPrompt = null;
    this.canInstallSubject.next(false);
    this.refreshStandaloneState();
  };

  private handleDisplayModeChange = (): void => {
    this.refreshStandaloneState();
  };

  private refreshStandaloneState(): void {
    const isStandalone = this.isStandaloneMode();
    this.isStandaloneSubject.next(isStandalone);
    if (isStandalone) {
      this.canInstallSubject.next(false);
    }
  }

  private isStandaloneMode(): boolean {
    const nav = this.document.defaultView?.navigator as Navigator & { standalone?: boolean };
    const displayModeStandalone = this.document.defaultView?.matchMedia('(display-mode: standalone)').matches ?? false;
    const iOSStandalone = nav?.standalone === true;
    const androidTrustedWebApp = this.document.referrer.startsWith('android-app://');

    return displayModeStandalone || iOSStandalone || androidTrustedWebApp;
  }
}
