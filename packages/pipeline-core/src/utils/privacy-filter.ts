// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Privacy Filter — PII detection and output sanitization
 *
 * Scans text for Canadian PII patterns and redacts them.
 * Runs on both enriched data (before LLM) and model output (after LLM).
 */

// Canadian PII patterns
const PATTERNS: { name: string; regex: RegExp; replacement: string }[] = [
  // Social Insurance Number (SIN): xxx-xxx-xxx
  { name: 'SIN', regex: /\b\d{3}[ -]?\d{3}[ -]?\d{3}\b/g, replacement: '[REDACTED SIN]' },
  // Canadian passport numbers: Xxxx000000 (2 letters + 6 digits)
  { name: 'passport', regex: /\b[A-Za-z]{2}\d{6}\b/g, replacement: '[REDACTED PASSPORT]' },
  // Health card numbers (provincial, variable format)
  { name: 'health-card', regex: /\b\d{4}[ -]?\d{4}[ -]?\d{4}[ -]?\d{4}\b/g, replacement: '[REDACTED HEALTH CARD]' },
  // Driver's license (provincial, variable — catch 7-12 digit sequences with letters)
  { name: 'drivers-license', regex: /\b[A-Za-z]\d{6,11}\b/g, replacement: '[REDACTED DL]' },
  // Email addresses
  { name: 'email', regex: /\b[\w.+-]+@[\w-]+\.[\w.-]+\b/g, replacement: '[REDACTED EMAIL]' },
  // Phone numbers (Canadian: +1 xxx-xxx-xxxx or xxx-xxx-xxxx)
  { name: 'phone', regex: /(\+1[ -]?)?\(?\d{3}\)?[ -]?\d{3}[ -]?\d{4}\b/g, replacement: '[REDACTED PHONE]' },
  // Postal codes: A#A #A#
  { name: 'postal-code', regex: /\b[A-Za-z]\d[A-Za-z][ -]?\d[A-Za-z]\d\b/g, replacement: '[REDACTED POSTAL]' },
  // Street addresses (simple pattern — number + street name)
  { name: 'address', regex: /\b\d{1,5}\s+(?:[A-Za-z]+\s+){1,3}(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln|Way|Court|Ct|Crescent|Cres)\b/gi, replacement: '[REDACTED ADDRESS]' },
  // Credit card numbers (16 digits, common formats)
  { name: 'credit-card', regex: /\b(?:\d{4}[ -]?){3}\d{4}\b/g, replacement: '[REDACTED CC]' },
];

export interface ScanResult {
  redacted: string;
  found: { pattern: string; count: number }[];
  totalRedactions: number;
}

export function scanPII(input: string): ScanResult {
  const found: Record<string, number> = {};
  let redacted = input;

  for (const p of PATTERNS) {
    const matches = redacted.match(p.regex);
    if (matches) {
      found[p.name] = matches.length;
      redacted = redacted.replace(p.regex, p.replacement);
    }
  }

  const total = Object.values(found).reduce((sum, c) => sum + c, 0);
  return {
    redacted,
    found: Object.entries(found).map(([pattern, count]) => ({ pattern, count })),
    totalRedactions: total,
  };
}

export function sanitizeOutput(output: unknown): unknown {
  if (typeof output === 'string') return scanPII(output).redacted;
  if (Array.isArray(output)) return output.map(sanitizeOutput);
  if (output && typeof output === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(output as Record<string, unknown>)) {
      result[key] = sanitizeOutput(value);
    }
    return result;
  }
  return output;
}
