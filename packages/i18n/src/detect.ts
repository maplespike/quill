import type { Locale } from './types.js';

/**
 * Detect the user's preferred locale.
 *
 * Priority: URL path /fr/... > cookie > Accept-Language header > default
 */
export function detectLocale(
  options?: {
    path?: string;
    cookie?: string | null | undefined;
    acceptLanguage?: string | null | undefined;
    default?: Locale;
  },
): Locale {
  const defaultLocale = options?.default ?? 'en';

  // 1. URL path prefix
  if (options?.path) {
    if (options.path.startsWith('/fr/') || options.path === '/fr') {
      return 'fr';
    }
    if (options.path.startsWith('/en/') || options.path === '/en') {
      return 'en';
    }
  }

  // 2. Cookie
  if (options?.cookie === 'fr' || options?.cookie === 'en') {
    return options.cookie;
  }

  // 3. Accept-Language header
  if (options?.acceptLanguage) {
    const parsed = parseAcceptLanguage(options.acceptLanguage);
    for (const lang of parsed) {
      if (lang === 'fr' || lang === 'en') return lang;
    }
  }

  return defaultLocale;
}

/**
 * Simple Accept-Language header parser.
 * Returns language codes in quality order.
 * Example: "fr-CA,fr;q=0.9,en;q=0.8" → ["fr", "en"]
 */
function parseAcceptLanguage(header: string): string[] {
  return header
    .split(',')
    .map((part) => {
      const [lang] = part.trim().split(';');
      const q = parseFloat(part.match(/q=([0-9.]+)/)?.[1] ?? '1');
      return { lang: lang.split('-')[0], q };
    })
    .sort((a, b) => b.q - a.q)
    .map((entry) => entry.lang);
}

/**
 * Normalize a path to include a language prefix.
 * Accepts bare paths like "/dashboard" or already-prefixed like "/en/dashboard".
 */
export function localizePath(path: string, lang: Locale, frenchRoutes?: Record<string, string>): string {
  // Strip any existing /en/ or /fr/ prefix
  let clean = path.replace(/^\/(en|fr)(\/|$)/, '/');

  // Apply French route translation map
  if (lang === 'fr' && frenchRoutes) {
    for (const [enPath, frPath] of Object.entries(frenchRoutes)) {
      if (clean === enPath || clean.startsWith(enPath + '/') || clean.startsWith(enPath + '?')) {
        clean = clean.replace(enPath, frPath);
        break;
      }
    }
  }

  // Ensure leading /
  if (!clean.startsWith('/')) clean = '/' + clean;

  return `/${lang}${clean === '/' ? '' : clean}`;
}
