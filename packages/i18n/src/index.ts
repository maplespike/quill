export { en } from './en.js';
export { fr } from './fr.js';
export { detectLocale, localizePath } from './detect.js';
export { formatCurrency, formatDate, formatNumber, formatPercent, formatRelativeDate } from './formatters.js';
export type { Locale, TranslationKeys, TranslationMap, AppI18n } from './types.js';

import type { Locale, TranslationKeys, AppI18n } from './types.js';
import { en } from './en.js';
import { fr } from './fr.js';
import { formatCurrency, formatDate, formatNumber } from './formatters.js';

const STRING_MAPS: Record<Locale, Partial<Record<TranslationKeys, string>>> = {
  en,
  fr,
};

/**
 * Create an AppI18n instance for a given locale.
 *
 * @example
 * const i18n = createI18n('fr');
 * i18n.t('nav.home')        // "Accueil"
 * i18n.formatCurrency(50)   // "50 $ CA"
 */
export function createI18n(lang: Locale): AppI18n {
  const map = STRING_MAPS[lang] ?? en;

  return {
    lang,

    t(key: TranslationKeys, fallbackLang?: Locale): string {
      const str = map[key];
      if (str !== undefined) return str;

      // Try fallback locale
      if (fallbackLang && fallbackLang !== lang) {
        const fallback = STRING_MAPS[fallbackLang]?.[key];
        if (fallback !== undefined) return fallback;
      }

      // Ultimate fallback: English
      return en[key] ?? key;
    },

    formatCurrency(amount: number): string {
      return formatCurrency(amount, lang);
    },

    formatDate(date: Date | string, style?: 'short' | 'long'): string {
      return formatDate(date, lang, style);
    },

    formatNumber(n: number, opts?: Intl.NumberFormatOptions): string {
      return formatNumber(n, lang, opts);
    },
  };
}
