import { inject, Injectable } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { getCurrencySymbol, registerLocaleData } from '@angular/common';
import { loadMomentLocale } from '../utils/loaders/moment-locale-loader';
import { firstValueFrom } from 'rxjs';
import { SupportedLanguage } from '../types/supported-language';

@Injectable({
  providedIn: 'root',
})
export class GlobalService {
  private translateService = inject(TranslateService);

  private languageLoaded = 'en-US';
  public languageStorageKey = "language-key";
  public groupSeparator = '.';
  public decimalSeparator = ',';
  public currency = 'EUR';
  public supportedLanguages: SupportedLanguage[] = [
    { code: 'en', nativeName: 'English' },
    { code: 'pt', nativeName: 'Português' }
  ];

  get currentLanguage(): string {
    return this.languageLoaded;
  }

  get currencySymbol(): string {
    return getCurrencySymbol(this.currency, "narrow");
  }
    
  async setLocale(locale: string): Promise<void> {
    try {
      switch (locale) {
        case 'pt':
        case 'pt-BR':
        case 'pt-PT': {
          const { default: pt } = await import('@angular/common/locales/pt');
          registerLocaleData(pt, 'pt');
          this.languageLoaded = 'pt';
          break;
        }
        case 'en':
        case 'en-US':
        case 'en-GB':
        default: {
          const { default: en } = await import('@angular/common/locales/en');
          registerLocaleData(en, 'en');
          this.languageLoaded = 'en';
          break;
        }
      }

      localStorage.setItem(this.languageStorageKey, this.languageLoaded);
      await firstValueFrom(this.translateService.use(this.languageLoaded));

      await loadMomentLocale(this.languageLoaded);
      // Update numeric separators
      const formatter = new Intl.NumberFormat(this.languageLoaded);
      const parts = formatter.formatToParts(1234.5);
      this.decimalSeparator = parts.find(p => p.type === 'decimal')?.value || '.';
      const groupSeparator = parts.find(p => p.type === 'group')?.value || ',';
      this.groupSeparator = ['.', ','].includes(groupSeparator)
        ? groupSeparator
        : this.decimalSeparator === '.' ? ',' : '.';

    } catch (error) {
      console.error(`Error loading locale ${locale}:`, error);
    }
  }
}
