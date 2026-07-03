import type { Locale } from '@maplespike/i18n';

/**
 * French route translations for the MapleSpike portal.
 * Maps English paths to their French equivalents.
 */
export const FRENCH_ROUTES: Record<string, string> = {
  '/': '/',
  '/dashboard': '/tableau-de-bord',
  '/docs': '/documentation',
  '/pricing': '/tarifs',
  '/contact': '/contact',
  '/api-explorer': '/explorateur-api',
  '/settings': '/parametres',
  '/signup': '/inscription',
  '/login': '/connexion',
  '/explorer': '/explorateur-de-donnees',
  '/agents': '/agents',
  '/signal': '/signaux',
  '/watcher': '/surveillance',
  '/status': '/statut',
  '/citation': '/citations',
  '/workspace': '/espace-de-travail',
  '/changelog': '/journal-des-modifications',
  '/privacy': '/confidentialite',
  '/terms': '/conditions-utilisation',
  '/blog': '/blogue',
  '/ask': '/interroger',
  '/dashboard/extraction': '/tableau-de-bord/extraction',
  '/dashboard/owasp': '/tableau-de-bord/securite',
};

/**
 * Get the localized URL for a given path and locale.
 * If the path already has a language prefix, it's replaced.
 */
export function localeUrl(path: string, lang: Locale): string {
  // Strip existing /en/ or /fr/ prefix
  const clean = path.replace(/^\/(en|fr)(\/|$)/, '/');

  // Find the matching route
  const normalized = clean.endsWith('/') && clean !== '/' ? clean.slice(0, -1) : clean;

  if (lang === 'fr') {
    const frPath = FRENCH_ROUTES[normalized] ?? FRENCH_ROUTES['/'];
    return `/fr${frPath === '/' ? '' : frPath}`;
  }

  return `/en${normalized === '/' ? '' : normalized}`;
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
