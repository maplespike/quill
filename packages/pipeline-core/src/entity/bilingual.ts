// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Quill — Bilingual entity names for entity resolution (issues #743, #741)
 *
 * Canadian federal institutions have official names in both official
 * languages ("Department of Finance Canada" / "Ministère des Finances
 * Canada"). Entity resolution that only indexes the English form silently
 * fails for French-language queries, so this module carries the public
 * institutional name pairs used to expand a lookup across both languages.
 *
 * Scope rules:
 *   - Public roles and institutions only. No private individuals, no
 *     personal information — every entry is a government body whose official
 *     EN/FR names are published by the institution itself.
 *   - Names are the official French/English forms; accents are preserved in
 *     the stored value and stripped only for matching.
 */

export interface BilingualEntityName {
  /** Stable slug used by callers (e.g. "finance-canada"). */
  id: string;
  /** Official English name. */
  en: string;
  /** Official French name. */
  fr: string;
}

/**
 * Public federal institutions with official bilingual names.
 * Adding an entry without its French form is a bug: the FR path must exist
 * for every entry (enforced by bilingual.test.ts).
 */
export const BILINGUAL_ENTITY_NAMES: readonly BilingualEntityName[] = [
  { id: 'finance-canada', en: 'Department of Finance Canada', fr: 'Ministère des Finances Canada' },
  { id: 'justice-canada', en: 'Department of Justice Canada', fr: 'Ministère de la Justice Canada' },
  { id: 'health-canada', en: 'Health Canada', fr: 'Santé Canada' },
  { id: 'eccc', en: 'Environment and Climate Change Canada', fr: 'Environnement et Changement climatique Canada' },
  { id: 'esdc', en: 'Employment and Social Development Canada', fr: 'Emploi et Développement social Canada' },
  { id: 'ircc', en: 'Immigration, Refugees and Citizenship Canada', fr: 'Immigration, Réfugiés et Citoyenneté Canada' },
  { id: 'global-affairs', en: 'Global Affairs Canada', fr: 'Affaires mondiales Canada' },
  { id: 'dnd', en: 'National Defence', fr: 'Défense nationale' },
  { id: 'pspc', en: 'Public Services and Procurement Canada', fr: 'Services publics et Approvisionnement Canada' },
  { id: 'statcan', en: 'Statistics Canada', fr: 'Statistique Canada' },
  { id: 'cra', en: 'Canada Revenue Agency', fr: 'Agence du revenu du Canada' },
  { id: 'tbs', en: 'Treasury Board of Canada Secretariat', fr: 'Secrétariat du Conseil du Trésor du Canada' },
  { id: 'pco', en: 'Privy Council Office', fr: 'Bureau du Conseil privé' },
  { id: 'public-safety', en: 'Public Safety Canada', fr: 'Sécurité publique Canada' },
  { id: 'transport-canada', en: 'Transport Canada', fr: 'Transports Canada' },
  { id: 'nrcan', en: 'Natural Resources Canada', fr: 'Ressources naturelles Canada' },
  { id: 'ised', en: 'Innovation, Science and Economic Development Canada', fr: 'Innovation, Sciences et Développement économique Canada' },
  { id: 'infrastructure-canada', en: 'Infrastructure Canada', fr: 'Infrastructure Canada' },
  { id: 'canadian-heritage', en: 'Canadian Heritage', fr: 'Patrimoine canadien' },
  { id: 'isc', en: 'Indigenous Services Canada', fr: 'Services aux Autochtones Canada' },
  { id: 'cirnac', en: 'Crown-Indigenous Relations and Northern Affairs Canada', fr: 'Relations Couronne-Autochtones et Affaires du Nord Canada' },
  { id: 'dfo', en: 'Fisheries and Oceans Canada', fr: 'Pêches et Océans Canada' },
  { id: 'aafc', en: 'Agriculture and Agri-Food Canada', fr: 'Agriculture et Agroalimentaire Canada' },
  { id: 'veterans-affairs', en: 'Veterans Affairs Canada', fr: 'Anciens Combattants Canada' },
  { id: 'wage', en: 'Women and Gender Equality Canada', fr: 'Femmes et Égalité des genres Canada' },
  { id: 'cmhc', en: 'Canada Mortgage and Housing Corporation', fr: "Société canadienne d'hypothèques et de logement" },
  { id: 'bank-of-canada', en: 'Bank of Canada', fr: 'Banque du Canada' },
  { id: 'oag', en: 'Office of the Auditor General of Canada', fr: 'Bureau du vérificateur général du Canada' },
  { id: 'scc', en: 'Supreme Court of Canada', fr: 'Cour suprême du Canada' },
  { id: 'federal-court', en: 'Federal Court of Canada', fr: 'Cour fédérale du Canada' },
  { id: 'parliament', en: 'Parliament of Canada', fr: 'Parlement du Canada' },
  { id: 'house-of-commons', en: 'House of Commons', fr: 'Chambre des communes' },
];

export type EntityLang = 'en' | 'fr';

export interface BilingualEntityMatch {
  id: string;
  /** Official English name. */
  en: string;
  /** Official French name. */
  fr: string;
  /** Which language the query string matched. */
  matchedLang: EntityLang;
  /** The stored name that matched (accents preserved). */
  matchedName: string;
  /** Name to display for a requested locale. */
  preferredName: string;
}

/** Leading articles / institutional boosters stripped for a "core" comparison. */
const LEADING_TOKENS = new Set([
  'the', 'le', 'la', 'les', 'l', 'du', 'de', 'des', 'of',
  'department', 'ministere', 'ministry', 'office', 'bureau',
]);

/**
 * Normalize a name for matching: lowercase, strip accents, fold `&` to
 * "and", drop punctuation, collapse whitespace. Hyphens are kept because
 * "Crown-Indigenous" and "agri-food" are meaningful.
 */
export function normalizeEntityName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Reduce a normalized name to its distinctive core by dropping leading
 * articles/boosters and a trailing "canada" — e.g.
 * "ministere des finances canada" → "finances".
 * Only used as a secondary lookup key, never as the primary identity.
 */
export function coreEntityName(name: string): string {
  const tokens = normalizeEntityName(name).split(' ').filter(Boolean);
  while (tokens.length > 1 && LEADING_TOKENS.has(tokens[0])) tokens.shift();
  if (tokens.length > 1 && tokens[tokens.length - 1] === 'canada') tokens.pop();
  return tokens.join(' ');
}

interface IndexEntry {
  entity: BilingualEntityName;
  lang: EntityLang;
  name: string;
}

let primaryIndex: Map<string, IndexEntry> | null = null;
let coreIndex: Map<string, IndexEntry> | null = null;

function buildIndexes(): { primary: Map<string, IndexEntry>; core: Map<string, IndexEntry> } {
  if (primaryIndex && coreIndex) return { primary: primaryIndex, core: coreIndex };
  const primary = new Map<string, IndexEntry>();
  const core = new Map<string, IndexEntry>();
  for (const entity of BILINGUAL_ENTITY_NAMES) {
    for (const lang of ['en', 'fr'] as const) {
      const name = entity[lang];
      if (!name) continue; // an empty FR/EN form is the failure this guards against
      const entry: IndexEntry = { entity, lang, name };
      const key = normalizeEntityName(name);
      if (!primary.has(key)) primary.set(key, entry);
      const coreKey = coreEntityName(name);
      if (coreKey && !core.has(coreKey)) core.set(coreKey, entry);
    }
  }
  primaryIndex = primary;
  coreIndex = core;
  return { primary, core };
}

/** Test hook — clear the memoized name indexes. */
export function resetBilingualEntityIndex(): void {
  primaryIndex = null;
  coreIndex = null;
}

/**
 * Resolve a query string (English or French) to a bilingual entity pair.
 * Matching order: exact normalized name, then distinctive-core name.
 */
export function resolveBilingualEntity(
  query: string,
  preferredLang: EntityLang = 'en',
): BilingualEntityMatch | null {
  const normalized = normalizeEntityName(query);
  if (!normalized) return null;
  const { primary, core } = buildIndexes();

  const entry = primary.get(normalized) ?? core.get(coreEntityName(query));
  if (!entry) return null;

  return {
    id: entry.entity.id,
    en: entry.entity.en,
    fr: entry.entity.fr,
    matchedLang: entry.lang,
    matchedName: entry.name,
    preferredName: preferredLang === 'fr' ? entry.entity.fr : entry.entity.en,
  };
}

/**
 * Names (in the *other* official language) that should also be searched when
 * a query resolves to a known bilingual entity. Used by the SQL resolver to
 * expand exact/alias/fuzzy lookups across both languages.
 */
export function bilingualEntityCandidates(query: string): string[] {
  const match = resolveBilingualEntity(query);
  if (!match) return [];
  const other = match.matchedLang === 'en' ? match.fr : match.en;
  const candidates = [normalizeEntityName(other)];
  const otherCore = coreEntityName(other);
  if (otherCore) candidates.push(otherCore);
  return [...new Set(candidates.filter(Boolean))];
}

/** True when two strings are the EN/FR pair of the same known entity. */
export function isBilingualEntityPair(a: string, b: string): boolean {
  const left = resolveBilingualEntity(a);
  const right = resolveBilingualEntity(b);
  return Boolean(left && right && left.id === right.id);
}

/** Locale-appropriate official name for a known entity id. */
export function localizeEntityName(id: string, lang: EntityLang): string | null {
  const entity = BILINGUAL_ENTITY_NAMES.find((e) => e.id === id);
  if (!entity) return null;
  return lang === 'fr' ? entity.fr : entity.en;
}
