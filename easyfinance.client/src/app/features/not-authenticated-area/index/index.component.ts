import { isPlatformBrowser } from '@angular/common';
import { AfterViewInit, Component, ElementRef, inject, NgZone, OnDestroy, PLATFORM_ID } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-index',
  imports: [
    RouterLink,
    TranslateModule
  ],
  templateUrl: './index.component.html',
  styleUrl: './index.component.css'
})
export class IndexComponent implements AfterViewInit, OnDestroy  {
  private ngZone = inject(NgZone);
  private el = inject(ElementRef);
  private platformId = inject(PLATFORM_ID);

  private observer!: IntersectionObserver;
  private initTimer: ReturnType<typeof setTimeout> | null = null;

  ngAfterViewInit(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    this.ngZone.runOutsideAngular(() => {
      this.initTimer = setTimeout(() => this.initScrollAnimations(), 150);
    });
  }

  private initScrollAnimations(): void {
    const host: HTMLElement = this.el.nativeElement;
    const targets = Array.from(host.querySelectorAll<HTMLElement>('.scroll-hidden'));

    if (targets.length === 0) return;

    // Apply hidden state via inline style — this beats SSR hydration and any CSS specificity issues
    targets.forEach(el => {
      el.style.opacity = '0';
      // Apply the transform matching the animation class
      if (el.classList.contains('anim-fade-up')) el.style.transform = 'translateY(40px)';
      if (el.classList.contains('anim-fade-left')) el.style.transform = 'translateX(-40px)';
      if (el.classList.contains('anim-fade-right')) el.style.transform = 'translateX(40px)';
      if (el.classList.contains('anim-scale-in')) el.style.transform = 'scale(0.87)';
    });

    if (typeof IntersectionObserver === 'undefined') {
      targets.forEach(el => this.revealElement(el));
      return;
    }

    this.observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          this.revealElement(entry.target as HTMLElement);
          this.observer.unobserve(entry.target);
        }
      });
    }, {
      threshold: 0,
      rootMargin: '0px 0px -50px 0px'
    });

    targets.forEach(el => {
      const rect = el.getBoundingClientRect();
      if (rect.top < window.innerHeight && rect.bottom > 0) {
        this.revealElement(el);
      } else {
        this.observer.observe(el);
      }
    });
  }

  private revealElement(el: HTMLElement): void {
    // Read the delay from the class list
    let delay = 0;
    if (el.classList.contains('delay-100')) delay = 100;
    if (el.classList.contains('delay-200')) delay = 200;
    if (el.classList.contains('delay-300')) delay = 300;
    if (el.classList.contains('delay-400')) delay = 400;
    if (el.classList.contains('delay-500')) delay = 500;

    setTimeout(() => {
      el.style.transition = 'opacity 0.65s cubic-bezier(0.22, 1, 0.36, 1), transform 0.65s cubic-bezier(0.22, 1, 0.36, 1)';
      el.style.opacity = '1';
      el.style.transform = 'none';
    }, delay);
  }

  ngOnDestroy(): void {
    if (this.initTimer) clearTimeout(this.initTimer);
    if (this.observer) this.observer.disconnect();
  }
}
