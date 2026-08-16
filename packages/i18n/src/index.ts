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
 * Replace `{param}` placeholders in a translation template.
 * Unknown placeholders are left as-is.
 */
function interpolate(template: string, params: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (m, k: string) =>
    k in params ? String(params[k]) : m,
  );
}

/**
 * Create an AppI18n instance for a given locale.
 *
 * @example
 * const i18n = createI18n('fr');
 * i18n.t('nav.home')        // "Accueil"
 * i18n.t('privacy.last_updated', { date: '1 juillet 2026' })  // "Dernière mise à jour : …"
 * i18n.formatCurrency(50)   // "50 $ CA"
 */
export function createI18n(lang: Locale): AppI18n {
  const map = STRING_MAPS[lang] ?? en;

  return {
    lang,

    t(key: TranslationKeys, params?: Record<string, string | number>): string {
      const str = map[key] ?? en[key] ?? key;
      return params ? interpolate(str, params) : str;
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
