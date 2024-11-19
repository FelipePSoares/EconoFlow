import { registerLocaleData } from '@angular/common';

export async function loadAngularLocale(locale: string): Promise<void> {
  try {
    switch (locale) {
      case 'de-AT':
      case 'de-DE':
        const { default: de } = await import('@angular/common/locales/de');
        registerLocaleData(de, 'de');
        break;
      case 'pl':
        const { default: pl } = await import('@angular/common/locales/pl');
        registerLocaleData(pl, 'pl');
        break;
      case 'pt-BR':
      case 'pt-PT':
        const { default: pt } = await import('@angular/common/locales/pt');
        registerLocaleData(pt, 'pt');
        break;
      case 'en-US':
      default:
        const { default: en } = await import('@angular/common/locales/en');
        registerLocaleData(en, 'en');
        break;
    }
  } catch (error) {
    console.error(`Error loading locale ${locale}:`, error);
    registerLocaleData(await import('@angular/common/locales/en').then((m) => m.default), 'en');
  }
}
