import * as moment from 'moment';

export async function loadMomentLocale(locale: string): Promise<void> {
  try {
    const normalized = (locale || 'en').toLowerCase();

    if (normalized.startsWith('pt')) {
      // Ensure Portuguese locale data is loaded in the bundle before switching.
      await import('moment/locale/pt');
      moment.locale('pt');
      return;
    }

    moment.locale('en');
  } catch (error) {
    console.error(`Error loading Moment.js locale for ${locale}:`, error);
  }
}
