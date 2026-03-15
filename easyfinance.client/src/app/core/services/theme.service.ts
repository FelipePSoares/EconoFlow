import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { inject, Injectable, PLATFORM_ID } from '@angular/core';
import { BehaviorSubject, map } from 'rxjs';

export type ThemeMode = 'light' | 'dark';
type AppleStatusBarStyle = 'default' | 'black-translucent';

interface ThemePresentation {
  themeColor: string;
  manifestHref: string;
  appleStatusBarStyle: AppleStatusBarStyle;
}

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly document = inject(DOCUMENT);
  private readonly storageKey = 'theme-mode';
  private readonly themePresentation: Record<ThemeMode, ThemePresentation> = {
    light: {
      themeColor: '#0f76a8',
      manifestHref: '/manifest.webmanifest',
      appleStatusBarStyle: 'default'
    },
    dark: {
      themeColor: '#0f1724',
      manifestHref: '/manifest.dark.webmanifest',
      appleStatusBarStyle: 'black-translucent'
    }
  };
  private readonly themeSubject = new BehaviorSubject<ThemeMode>(this.getInitialTheme());

  readonly theme$ = this.themeSubject.asObservable();
  readonly isDarkTheme$ = this.theme$.pipe(map(theme => theme === 'dark'));

  constructor() {
    this.applyTheme(this.themeSubject.value);
  }

  get currentTheme(): ThemeMode {
    return this.themeSubject.value;
  }

  setTheme(theme: ThemeMode): void {
    this.themeSubject.next(theme);
    this.applyTheme(theme);
    this.persistTheme(theme);
  }

  toggleTheme(): void {
    this.setTheme(this.currentTheme === 'dark' ? 'light' : 'dark');
  }

  private getInitialTheme(): ThemeMode {
    if (!isPlatformBrowser(this.platformId)) {
      return 'light';
    }

    const storedTheme = localStorage.getItem(this.storageKey);
    if (storedTheme === 'light' || storedTheme === 'dark') {
      return storedTheme;
    }

    const supportsMatchMedia = typeof window !== 'undefined' && typeof window.matchMedia === 'function';
    if (supportsMatchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }

    return 'light';
  }

  private persistTheme(theme: ThemeMode): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    localStorage.setItem(this.storageKey, theme);
  }

  private applyTheme(theme: ThemeMode): void {
    const root = this.document?.documentElement;
    if (!root) {
      return;
    }

    root.setAttribute('data-theme', theme);

    const presentation = this.themePresentation[theme];
    this.setMetaContent('theme-color', presentation.themeColor);
    this.setMetaContent('apple-mobile-web-app-status-bar-style', presentation.appleStatusBarStyle);
    this.setManifestHref(presentation.manifestHref);
  }

  private setMetaContent(name: string, content: string): void {
    const meta = this.document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
    if (meta) {
      meta.setAttribute('content', content);
    }
  }

  private setManifestHref(href: string): void {
    const manifestLink = this.document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
    if (manifestLink) {
      manifestLink.setAttribute('href', href);
    }
  }
}
