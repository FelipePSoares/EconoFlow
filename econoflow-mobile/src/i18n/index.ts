import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import pt from './locales/pt.json';

// Detect device locale without an extra package — Intl is available on
// React Native 0.73+ (Hermes) which ships with Expo SDK 51+.
const deviceLocale = Intl.DateTimeFormat().resolvedOptions().locale ?? 'en';
const initialLang = deviceLocale.toLowerCase().startsWith('pt') ? 'pt' : 'en';

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    pt: { translation: pt },
  },
  lng: initialLang,
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

export default i18n;
