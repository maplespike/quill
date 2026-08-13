import type { Locale } from '@maplespike/i18n';

/**
 * Get the URL for a given path and locale.
 * English pages live at bare paths (/pricing, /explorer); French pages are
 * mirrored under a /fr prefix (/fr/pricing) by the fr/[...page].astro proxy.
 * The bare root `/` is language-neutral and redirects client-side.
 */
export function localeUrl(path: string, lang: Locale): string {
  const clean = path.replace(/^\/(en|fr)(\/|$)/, '/');
  if (lang === 'fr') return clean === '/' ? '/fr' : `/fr${clean}`;
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
