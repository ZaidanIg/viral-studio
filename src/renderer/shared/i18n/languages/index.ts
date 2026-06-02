// src/shared/i18n/languages/index.ts
import { en } from './en';
import { id } from './id';
import { ms } from './ms';
import { pt } from './pt';
import { es } from './es';
import { fr } from './fr';
import { ru } from './ru';
import { TranslationStrings, LanguageCode } from '../types';

export const translations: Record<LanguageCode, TranslationStrings> = {
  en,
  id,
  ms,
  pt,
  es,
  fr,
  ru,
};

export { en, id, ms, pt, es, fr, ru };
