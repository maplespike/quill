// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Shared CSV Utility — Quill
 *
 * Single canonical implementation of CSV parsing functions.
 * All modules should import from here instead of defining private copies.
 */

/**
 * Parse a single CSV line respecting quoted fields (RFC 4180).
 * Handles:
 *   - Quoted fields with embedded commas
 *   - Escaped quotes ("") within quoted fields
 *   - Empty fields
 *   - Leading/trailing whitespace trimming
 */
export function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];

    if (ch === '"') {
      if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
        // Escaped quote inside quoted field
        current += '"';
        i++; // skip the next quote
      } else {
        // Toggle quote mode
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      // End of field
      fields.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }

  // Push the last field
  fields.push(current.trim());

  return fields;
}

/**
 * Parse a currency string to a number.
 * Handles: "$1,234.56", "1 234,56" (European), "(1,234.56)" (negative parens)
 */
export function parseCurrency(val: string | undefined | null): number | null {
  if (!val) return null;
  const s = val.trim();
  if (s === '' || s === '-' || s === '—' || s === 'N/A' || s === 'n/a') return null;

  // Handle parenthesized negatives: ($1,234.56) → -1234.56
  const negative = s.startsWith('(') && s.endsWith(')');
  let cleaned = s.replace(/^[($\s]+|[)$\s]+$/g, '');

  // Detect European format: 1.234,56 → 1234.56
  if (/^\d{1,3}(\.\d{3})*(,\d+)?$/.test(cleaned)) {
    cleaned = cleaned.replace(/\./g, '').replace(',', '.');
  } else {
    // Standard format: remove commas and spaces
    cleaned = cleaned.replace(/[,\s]/g, '');
  }

  const num = parseFloat(cleaned);
  return isNaN(num) ? null : (negative ? -num : num);
}

/**
 * Normalize a CSV header string to a canonical snake_case key.
 * Handles: "First Name" → "first_name", "NOC/Skill Level" → "noc_skill_level"
 */
export function normalizeHeader(header: string): string {
  return header
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}
