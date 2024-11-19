import * as moment from 'moment';

export async function loadMomentLocale(locale: string): Promise<void> {
  try {
    moment.locale(locale.split('-')[0]); 
  } catch (error) {
    console.error(`Error loading Moment.js locale for ${locale}:`, error);
  }
}
