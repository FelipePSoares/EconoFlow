import { isPlatformBrowser } from '@angular/common';
import { inject, Injectable, PLATFORM_ID } from '@angular/core';
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';
import { BehaviorSubject, filter, interval } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class PwaUpdateService {
  private readonly swUpdate = inject(SwUpdate);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly updateAvailableSubject = new BehaviorSubject<boolean>(false);

  readonly updateAvailable$ = this.updateAvailableSubject.asObservable();

  constructor() {
    if (!isPlatformBrowser(this.platformId) || !this.swUpdate.isEnabled) {
      return;
    }

    this.swUpdate.versionUpdates
      .pipe(filter((event): event is VersionReadyEvent => event.type === 'VERSION_READY'))
      .subscribe(() => {
        this.updateAvailableSubject.next(true);
      });

    void this.checkForUpdates();
    interval(6 * 60 * 60 * 1000).subscribe(() => {
      void this.checkForUpdates();
    });
  }

  dismissUpdate(): void {
    this.updateAvailableSubject.next(false);
  }

  async activateUpdateAndReload(): Promise<void> {
    if (!this.swUpdate.isEnabled) {
      return;
    }

    await this.swUpdate.activateUpdate();
    this.updateAvailableSubject.next(false);
    window.location.reload();
  }

  private async checkForUpdates(): Promise<void> {
    if (!this.swUpdate.isEnabled) {
      return;
    }

    try {
      await this.swUpdate.checkForUpdate();
    } catch {
      // Keep this flow silent; update checks must not interrupt app usage.
    }
  }
}
