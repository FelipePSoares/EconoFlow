import {
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnDestroy,
  OnInit,
  Output,
  ViewChild,
  NgZone,
  inject,
  PLATFORM_ID
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { TurnstileService } from '../../services/turnstile.service';

declare global {
  interface Window {
    turnstile?: {
      render: (container: HTMLElement, options: Record<string, unknown>) => string;
      reset: (widgetId: string) => void;
      remove: (widgetId: string) => void;
    };
    onTurnstileLoad?: () => void;
  }
}

@Component({
  selector: 'app-turnstile-widget',
  standalone: true,
  template: `<div #turnstileContainer></div>`
})
export class TurnstileWidgetComponent implements OnInit, OnDestroy {
  @ViewChild('turnstileContainer', { static: true }) container!: ElementRef<HTMLDivElement>;
  @Output() tokenReceived = new EventEmitter<string>();
  @Output() tokenExpired = new EventEmitter<void>();
  @Input() theme: 'light' | 'dark' | 'auto' = 'auto';

  private turnstileService = inject(TurnstileService);
  private ngZone = inject(NgZone);
  private platformId = inject(PLATFORM_ID);

  private widgetId: string | null = null;
  private scriptLoaded = false;

  ngOnInit(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    this.turnstileService.loadConfig().subscribe(config => {
      if (config.enabled && config.siteKey) {
        this.loadScriptAndRender(config.siteKey);
      }
    });
  }

  ngOnDestroy(): void {
    if (this.widgetId && window.turnstile) {
      window.turnstile.remove(this.widgetId);
      this.widgetId = null;
    }
  }

  reset(): void {
    if (this.widgetId && window.turnstile) {
      window.turnstile.reset(this.widgetId);
    }
  }

  private loadScriptAndRender(siteKey: string): void {
    if (window.turnstile) {
      this.renderWidget(siteKey);
      return;
    }

    if (this.scriptLoaded) return;

    this.scriptLoaded = true;
    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onTurnstileLoad&render=explicit';
    script.async = true;
    script.defer = true;

    window.onTurnstileLoad = () => {
      this.ngZone.run(() => this.renderWidget(siteKey));
    };

    document.head.appendChild(script);
  }

  private renderWidget(siteKey: string): void {
    if (!window.turnstile || !this.container?.nativeElement) return;

    if (this.widgetId) {
      window.turnstile.remove(this.widgetId);
    }

    this.widgetId = window.turnstile.render(this.container.nativeElement, {
      sitekey: siteKey,
      theme: this.theme,
      callback: (token: string) => {
        this.ngZone.run(() => this.tokenReceived.emit(token));
      },
      'expired-callback': () => {
        this.ngZone.run(() => {
          this.tokenExpired.emit();
          this.tokenReceived.emit('');
        });
      },
      'error-callback': () => {
        this.ngZone.run(() => this.tokenReceived.emit(''));
      }
    });
  }
}
