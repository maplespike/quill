import type { Locale } from '@maplespike/i18n';

/**
 * Get the URL for a given path and locale.
 * The portal uses bare paths (/pricing, /explorer) without locale prefixes.
 * Language is handled via client-side redirect on the root path only.
 */
export function localeUrl(path: string, _lang: Locale): string {
  const clean = path.replace(/^\/(en|fr)(\/|$)/, '/');
  return clean;
}

/**
 * Detect if the current URL has a language prefix.
 */
export function detectLangFromUrl(pathname: string): Locale | null {
  if (pathname.startsWith('/fr/') || pathname === '/fr') return 'fr';
  if (pathname.startsWith('/en/') || pathname === '/en') return 'en';
  return null;
}

/**
 * Strip language prefix from a path.
 */
export function stripLangPrefix(pathname: string): string {
  return pathname.replace(/^\/(en|fr)(\/|$)/, '/');
}
