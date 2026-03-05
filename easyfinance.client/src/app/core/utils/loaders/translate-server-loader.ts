import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { TranslateLoader, TranslationObject } from '@ngx-translate/core';
import { Observable, of } from 'rxjs';

const supportedLanguages = new Set(['en', 'pt']);
const fallbackLanguage = 'en';
const translationFolderCandidates = [
  join(process.cwd(), 'dist', 'easyfinance.client', 'browser', 'assets', 'i18n'),
  join(process.cwd(), 'src', 'assets', 'i18n'),
  join(process.cwd(), 'browser', 'assets', 'i18n')
];

export class TranslateServerLoader implements TranslateLoader {
  getTranslation(lang: string): Observable<TranslationObject> {
    return of(loadTranslation(this.normalizeLanguage(lang)));
  }

  private normalizeLanguage(lang: string): string {
    if (!lang) {
      return fallbackLanguage;
    }

    const normalized = lang.toLowerCase().startsWith('pt') ? 'pt' : 'en';
    return supportedLanguages.has(normalized) ? normalized : fallbackLanguage;
  }
}

const loadTranslation = (lang: string): TranslationObject => {
  const fileName = `messages.${lang}.json`;

  for (const folderPath of translationFolderCandidates) {
    const filePath = join(folderPath, fileName);
    if (!existsSync(filePath)) {
      continue;
    }

    try {
      return JSON.parse(readFileSync(filePath, 'utf-8')) as TranslationObject;
    } catch (error) {
      console.error(`Failed to parse translation file "${filePath}".`, error);
      break;
    }
  }

  if (lang !== fallbackLanguage) {
    return loadTranslation(fallbackLanguage);
  }

  console.warn('Server translation loader could not find any translation file. Using empty translations.');
  return {};
};
