import type { Locale } from '@maplespike/i18n';

/**
 * Pick the localized string for the current locale.
 *
 * Chrome (nav, footer, shared labels) lives in @maplespike/i18n's typed maps.
 * Page-local body copy (tiers, feature lists, FAQ, data tables) uses {en, fr}
 * pairs resolved through this helper, so the strict TranslationKeys union in
 * the i18n package doesn't have to absorb hundreds of page-local strings.
 */
export function pick(lang: Locale, en: string, fr: string): string {
  return lang === 'fr' ? fr : en;
}

/** A bilingual string pair. */
export type Bi = { en: string; fr: string };

/** Resolve a bilingual pair for the current locale. */
export function pickBi(lang: Locale, bi: Bi): string {
  return pick(lang, bi.en, bi.fr);
}
