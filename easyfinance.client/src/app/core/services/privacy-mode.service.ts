import { isPlatformBrowser } from '@angular/common';
import { inject, Injectable, PLATFORM_ID } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class PrivacyModeService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly storageKey = 'privacy-mode-enabled';
  private readonly enabledSubject = new BehaviorSubject<boolean>(this.getInitialState());

  readonly isEnabled$ = this.enabledSubject.asObservable();

  get isEnabled(): boolean {
    return this.enabledSubject.value;
  }

  setEnabled(enabled: boolean): void {
    this.enabledSubject.next(enabled);
    this.persistState(enabled);
  }

  toggle(): void {
    this.setEnabled(!this.enabledSubject.value);
  }

  private getInitialState(): boolean {
    if (!isPlatformBrowser(this.platformId)) {
      return false;
    }

    return localStorage.getItem(this.storageKey) === 'true';
  }

  private persistState(enabled: boolean): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    localStorage.setItem(this.storageKey, String(enabled));
  }
}
