import type { Locale } from './types.js';

/**
 * Format a CAD amount with locale-appropriate formatting.
 * en-CA: "$1,234.56 CAD"
 * fr-CA: "1 234,56 $ CA"
 */
export function formatCurrency(amount: number, locale: Locale): string {
  if (locale === 'fr') {
    // French-Canadian: "1 234,56 $ CA"
    const formatted = new Intl.NumberFormat('fr-CA', {
      style: 'currency',
      currency: 'CAD',
      currencyDisplay: 'code',
    }).format(amount);
    return formatted.replace('CAD', '$ CA').replace(',00', '');
  }
  // English-Canadian: "$1,234.56 CAD"
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
    currencyDisplay: 'code',
  }).format(amount);
}

/**
 * Format a date with locale-appropriate formatting.
 * en-CA short: "Jul 2, 2026"
 * fr-CA short: "2 juill. 2026"
 * en-CA long: "July 2, 2026"
 * fr-CA long: "2 juillet 2026"
 */
export function formatDate(
  date: Date | string,
  locale: Locale,
  style: 'short' | 'long' = 'short',
): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const localeStr = locale === 'fr' ? 'fr-CA' : 'en-CA';

  return new Intl.DateTimeFormat(localeStr, {
    year: 'numeric',
    month: style === 'long' ? 'long' : 'short',
    day: 'numeric',
  }).format(d);
}

/**
 * Format a number with locale-appropriate formatting.
 * en-CA: "1,234.56"
 * fr-CA: "1 234,56"
 */
export function formatNumber(
  n: number,
  locale: Locale,
  opts?: Intl.NumberFormatOptions,
): string {
  const localeStr = locale === 'fr' ? 'fr-CA' : 'en-CA';
  return new Intl.NumberFormat(localeStr, opts).format(n);
}

/**
 * Format a percentage.
 * en-CA: "12.5%"
 * fr-CA: "12,5 %"
 */
export function formatPercent(n: number, locale: Locale): string {
  const localeStr = locale === 'fr' ? 'fr-CA' : 'en-CA';
  return new Intl.NumberFormat(localeStr, {
    style: 'percent',
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(n / 100);
}

/**
 * Format a relative date (e.g., "3 days ago").
 * Falls back to formatDate for dates > 30 days.
 */
export function formatRelativeDate(
  date: Date | string,
  locale: Locale,
): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (locale === 'fr') {
    if (diffDays === 0) return 'Aujourd\'hui';
    if (diffDays === 1) return 'Hier';
    if (diffDays < 7) return `Il y a ${diffDays} jours`;
    if (diffDays < 30) return `Il y a ${Math.floor(diffDays / 7)} semaines`;
    return formatDate(d, 'fr', 'short');
  }

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  return formatDate(d, 'en', 'short');
}
