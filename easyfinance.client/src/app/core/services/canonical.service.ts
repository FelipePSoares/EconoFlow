import { Injectable, Inject, PLATFORM_ID, DOCUMENT } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class CanonicalService {

  private canonicalLink: HTMLLinkElement;

  constructor(
    @Inject(DOCUMENT) private document: Document,
    @Inject(PLATFORM_ID) private platformId: Object,
    private router: Router
  ) {
    this.canonicalLink = this.document.createElement('link');
    this.canonicalLink.setAttribute('rel', 'canonical');
    this.canonicalLink.setAttribute('href', this.currentUrl());

    if (isPlatformBrowser(platformId)) {

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
