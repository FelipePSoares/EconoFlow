import { registerLocaleData } from '@angular/common';
import { GlobalService } from '../../services/global.service';

export async function loadAngularLocale(globalService: GlobalService): Promise<void> {
  const locale = navigator.language || globalService.languageLoaded;
  try {
    globalService.languageLoaded = locale;

    switch (locale) {
      case 'de':
      case 'de-AT':
      case 'de-DE':
        const { default: de } = await import('@angular/common/locales/de');
        registerLocaleData(de, 'de');
        break;
      case 'pl':
        const { default: pl } = await import('@angular/common/locales/pl');
        registerLocaleData(pl, 'pl');
        break;
      case 'fr':
      case 'fr-FR':
        const { default: fr } = await import('@angular/common/locales/fr');
        registerLocaleData(fr, 'fr');
        break;
      case 'pt':
      case 'pt-BR':
      case 'pt-PT':
        const { default: pt } = await import('@angular/common/locales/pt');
        registerLocaleData(pt, 'pt');
        break;
      case 'en':
      case 'en-US':
      default:
        const { default: en } = await import('@angular/common/locales/en');
        registerLocaleData(en, 'en');
        globalService.languageLoaded = 'en';
        break;
    }
  } catch (error) {
    console.error(`Error loading locale ${locale}:`, error);
    registerLocaleData(await import('@angular/common/locales/en').then((m) => m.default), 'en');
  }
}
