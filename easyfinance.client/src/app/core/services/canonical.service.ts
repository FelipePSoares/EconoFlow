import { Injectable, PLATFORM_ID, DOCUMENT, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class CanonicalService {
  private router = inject(Router);
  private document = inject(DOCUMENT);
  private platformId = inject(PLATFORM_ID);

  private canonicalLink: HTMLLinkElement;

  constructor() {
    this.canonicalLink = this.document.createElement('link');
    this.canonicalLink.setAttribute('rel', 'canonical');
    this.canonicalLink.setAttribute('href', this.currentUrl());

    if (isPlatformBrowser(this.platformId)) {

      this.document.head.appendChild(this.canonicalLink);

      this.router.events.pipe(
        filter(e => e instanceof NavigationEnd)
      ).subscribe((e: NavigationEnd) => {
        this.canonicalLink.setAttribute('href', this.currentUrl());
      });
    }
  }

  private currentUrl(): string {
    let host = this.document.location.host;

    if (host.startsWith('www.')) {
      host = host.substring(4);
    }

    return 'https://' + host + this.document.location.pathname;
  }
}
