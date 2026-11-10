// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Bilingual tool descriptions loader.
 * Injects French (fr-CA) descriptions into all tool definitions using
 * a mapping keyed by tool name. Tools without a specific French translation
 * will use a generated pattern-based fallback.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FR_TOOLS_PATH = path.resolve(__dirname, '../../i18n/fr-tools.json');

// Initialised to `null` so `if (frDescriptions)` correctly triggers lazy load.
// (An empty object would be truthy — the JSON file would never be parsed.)
let frDescriptions: Record<string, string> | null = null;

function loadFrDescriptions(): Record<string, string> {
  if (frDescriptions) return frDescriptions;
  try {
    if (fs.existsSync(FR_TOOLS_PATH)) {
      const raw = fs.readFileSync(FR_TOOLS_PATH, 'utf-8');
      frDescriptions = JSON.parse(raw);
    } else {
      frDescriptions = {};
    }
  } catch {
    frDescriptions = {};
  }
  return frDescriptions ?? {};
}

/**
 * Common tool name → French mapping patterns.
 * Used as fallback when a tool has no explicit French translation.
 */
const PATTERN_TEMPLATES: Record<string, string> = {
  search: 'Rechercher',
  get: 'Obtenir',
  query: 'Interroger',
  list: 'Lister',
  compare: 'Comparer',
  analyze: 'Analyser',
  fetch: 'Récupérer',
  track: 'Suivre',
  signal: 'Signaler',
  resolve: 'Résoudre',
  find: 'Trouver',
  explore: 'Explorer',
  ai: 'IA',
  smart: 'Recherche intelligente',
  fact: 'Vérification des faits',
  citation: 'Obtenir une citation',
};

/**
 * Get the French description for a tool based on its English description.
 * Falls back to the explicit mapping, then to a generated pattern-based one.
 */
export function getFrenchDescription(toolName: string, englishDescription: string): string {
  const explicit = loadFrDescriptions()[toolName];
  if (explicit) return explicit;

  // Pattern-based fallback: replace common English patterns with French
  for (const [pattern, french] of Object.entries(PATTERN_TEMPLATES)) {
    if (englishDescription.startsWith(pattern.charAt(0).toUpperCase() + pattern.slice(1)) ||
        englishDescription.startsWith(pattern)) {
      // Replace the leading English prefix with French equivalent
      return englishDescription.replace(
        new RegExp(`^${pattern.charAt(0).toUpperCase() + pattern.slice(1)}`),
        french,
      ).replace(
        new RegExp(`^${pattern}`),
        french,
      );
    }
  }

  // Generic fallback
  return englishDescription;
}

/**
 * Return the French description for a tool from the fr-tools.json file.
 */
export function getFrDescription(toolName: string): string | undefined {
  return loadFrDescriptions()[toolName];
}
