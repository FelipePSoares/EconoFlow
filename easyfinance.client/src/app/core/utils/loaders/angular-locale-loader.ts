import { registerLocaleData } from '@angular/common';
import { GlobalService } from '../../services/global.service';
import { TranslateService } from '@ngx-translate/core';

export async function loadAngularLocale(globalService: GlobalService, translate: TranslateService): Promise<void> {
  translate.setDefaultLang('en');
  const locale = navigator.language || globalService.languageLoaded;
  try {
    globalService.languageLoaded = locale;

    switch (locale) {
      case 'pt':
      case 'pt-BR':
      case 'pt-PT':
        const { default: pt } = await import('@angular/common/locales/pt');
        registerLocaleData(pt, 'pt');
        translate.use('pt');
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
