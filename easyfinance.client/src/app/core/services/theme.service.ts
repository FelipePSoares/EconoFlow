import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { inject, Injectable, PLATFORM_ID } from '@angular/core';
import { BehaviorSubject, map } from 'rxjs';

export type ThemeMode = 'light' | 'dark';

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly document = inject(DOCUMENT);
  private readonly storageKey = 'theme-mode';
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
    root.style.colorScheme = theme;

    const themeColorMeta = this.document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (themeColorMeta) {
      themeColorMeta.setAttribute('content', theme === 'dark' ? '#101828' : '#0f76a8');
    }
  }
}
