// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Canada Gazette RIAS is served as a short excerpt. The full statement stays
 * on canada.ca. Reproductions are not an official version.
 */

export const RIAS_EXCERPT_MAX = 300;

export const GAZETTE_NOT_OFFICIAL_NOTICE = 'This is not the official version.';

export const GAZETTE_SOURCE_LINK = 'https://www.canada.ca/en/gazette.html';

const RIAS_TEXT_KEYS = ['riasText', 'rias_text', 'riasExcerpt', 'rias_excerpt'] as const;

/** Cap a RIAS string at 300 characters. Empty input becomes null. */
export function capRiasExcerpt(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null;
  const text = value.replace(/\s+/g, ' ').trim();
  if (!text) return null;
  return text.length <= RIAS_EXCERPT_MAX ? text : text.slice(0, RIAS_EXCERPT_MAX);
}

/** Served Gazette record: title and description stay; RIAS text is capped. */
export function presentGazetteRecord(record: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...record };
  for (const key of RIAS_TEXT_KEYS) {
    if (typeof out[key] === 'string') {
      out[key] = capRiasExcerpt(out[key]);
    }
  }
  out.notice = GAZETTE_NOT_OFFICIAL_NOTICE;
  out.source_link = GAZETTE_SOURCE_LINK;
  return out;
}
