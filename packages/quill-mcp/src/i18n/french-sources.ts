// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Quill — French-language data source paths and query localization
 * (issues #741, #743)
 *
 * The MCP query layer historically only knew the English entry point of each
 * Canadian source. Every source below publishes an official French path, and
 * a query issued with `lang: "fr"` must go to that path (or carry the French
 * terminology) instead of the English one.
 *
 * This module is deliberately data-only: it holds the bilingual source
 * registry and the EN→FR terminology used to localize a query. The MCP tools
 * read from it, and french-sources.test.ts pins both halves — deleting a
 * French URL or a French title makes the suite fail.
 *
 * Scope: public data sources and public-role institution names only.
 */

export type QueryLang = 'en' | 'fr';

export type DataSourceId =
  | 'canlii'
  | 'gazette-p1'
  | 'gazette-p2'
  | 'gazette-p3'
  | 'justice-laws'
  | 'ontario-elaws'
  | 'statcan'
  | 'quebec-open-data'
  | 'montreal-open-data'
  | 'quebec-city-open-data'
  | 'federal-budget'
  | 'parliament-hansard';

export interface BilingualUrl {
  en: string;
  fr: string;
}

export interface BilingualDataSource {
  id: DataSourceId;
  /** Human label per language. */
  name: BilingualUrl;
  /** Retrieval endpoint per language. */
  url: BilingualUrl;
  /** Licence/attribution statement kept out of this registry; see data-source-licenses.json. */
  jurisdiction: 'federal' | 'provincial' | 'municipal';
}

/**
 * Official French entry points. Each entry must carry a French URL — an
 * English-only source is exactly the gap #741 closes.
 */
export const BILINGUAL_DATA_SOURCES: Readonly<Record<DataSourceId, BilingualDataSource>> = {
  canlii: {
    id: 'canlii',
    name: { en: 'CanLII case law', fr: 'Jurisprudence CanLII' },
    url: { en: 'https://www.canlii.org/en/', fr: 'https://www.canlii.org/fr/' },
    jurisdiction: 'federal',
  },
  'gazette-p1': {
    id: 'gazette-p1',
    name: { en: 'Canada Gazette, Part I', fr: 'Gazette du Canada, Partie I' },
    url: { en: 'https://gazette.gc.ca/rp-pr/p1/2026/index-eng.html', fr: 'https://gazette.gc.ca/rp-pr/p1/2026/index-fra.html' },
    jurisdiction: 'federal',
  },
  'gazette-p2': {
    id: 'gazette-p2',
    name: { en: 'Canada Gazette, Part II', fr: 'Gazette du Canada, Partie II' },
    url: { en: 'https://gazette.gc.ca/rp-pr/p2/2026/index-eng.html', fr: 'https://gazette.gc.ca/rp-pr/p2/2026/index-fra.html' },
    jurisdiction: 'federal',
  },
  'gazette-p3': {
    id: 'gazette-p3',
    name: { en: 'Canada Gazette, Part III', fr: 'Gazette du Canada, Partie III' },
    url: { en: 'https://gazette.gc.ca/rp-pr/p3/2026/index-eng.html', fr: 'https://gazette.gc.ca/rp-pr/p3/2026/index-fra.html' },
    jurisdiction: 'federal',
  },
  'justice-laws': {
    id: 'justice-laws',
    name: { en: 'Justice Laws', fr: 'Lois et règlements du Canada' },
    url: { en: 'https://laws-lois.justice.gc.ca/eng/', fr: 'https://laws-lois.justice.gc.ca/fra/' },
    jurisdiction: 'federal',
  },
  'ontario-elaws': {
    id: 'ontario-elaws',
    name: { en: 'Ontario e-Laws', fr: 'Lois-en-ligne de l’Ontario' },
    url: { en: 'https://www.ontario.ca/laws', fr: 'https://www.ontario.ca/fr/lois' },
    jurisdiction: 'provincial',
  },
  statcan: {
    id: 'statcan',
    name: { en: 'Statistics Canada', fr: 'Statistique Canada' },
    url: { en: 'https://www150.statcan.gc.ca/n1/en/', fr: 'https://www150.statcan.gc.ca/n1/fra/' },
    jurisdiction: 'federal',
  },
  'quebec-open-data': {
    id: 'quebec-open-data',
    name: { en: 'Québec open data', fr: 'Données ouvertes du Québec' },
    url: { en: 'https://www.donneesquebec.ca/en/', fr: 'https://www.donneesquebec.ca/' },
    jurisdiction: 'provincial',
  },
  'montreal-open-data': {
    id: 'montreal-open-data',
    name: { en: 'Montréal open data', fr: 'Données ouvertes de Montréal' },
    url: { en: 'https://donnees.montreal.ca/en', fr: 'https://donnees.montreal.ca' },
    jurisdiction: 'municipal',
  },
  'quebec-city-open-data': {
    id: 'quebec-city-open-data',
    name: { en: 'Québec City open data', fr: 'Données ouvertes de la Ville de Québec' },
    url: { en: 'https://www.donnees.ville.quebec.qc.ca/', fr: 'https://www.donnees.ville.quebec.qc.ca/' },
    jurisdiction: 'municipal',
  },
  'federal-budget': {
    id: 'federal-budget',
    name: { en: 'Federal Budget', fr: 'Budget fédéral' },
    url: { en: 'https://budget.canada.ca/home-accueil-en.html', fr: 'https://budget.canada.ca/home-accueil-fr.html' },
    jurisdiction: 'federal',
  },
  'parliament-hansard': {
    id: 'parliament-hansard',
    name: { en: 'House of Commons Debates (Hansard)', fr: 'Débats de la Chambre des communes (hansard)' },
    url: { en: 'https://www.ourcommons.ca/documentviewer/en/house/latest', fr: 'https://www.ourcommons.ca/documentviewer/fr/house/latest' },
    jurisdiction: 'federal',
  },
};

/** Throws when any source is missing its French path. Used as a build-time invariant. */
export function assertFrenchSourcePaths(): void {
  const missing = Object.values(BILINGUAL_DATA_SOURCES)
    .filter((source) => !source.url.fr || !source.name.fr)
    .map((source) => source.id);
  if (missing.length > 0) {
    throw new Error(`French source path missing for: ${missing.join(', ')}`);
  }
}

/** URL for a source in the requested language. Throws when the FR path is absent. */
export function sourceUrl(id: DataSourceId, lang: QueryLang = 'en'): string {
  const source = BILINGUAL_DATA_SOURCES[id];
  if (!source) throw new Error(`Unknown data source: ${id}`);
  const url = source.url[lang];
  if (!url) throw new Error(`French source path missing for ${id}`);
  return url;
}

/** Locale-appropriate label for a source. */
export function sourceName(id: DataSourceId, lang: QueryLang = 'en'): string {
  const source = BILINGUAL_DATA_SOURCES[id];
  if (!source) throw new Error(`Unknown data source: ${id}`);
  return source.name[lang];
}

/**
 * EN→FR terminology for common Canadian public-data search subjects.
 * Keys are lowercased English phrases; values are the official French terms
 * used by the source portals (e.g. CanLII's "droit du travail").
 */
export const QUERY_TERMINOLOGY: Readonly<Record<string, string>> = {
  'employment law': 'droit du travail',
  'labour law': 'droit du travail',
  'family law': 'droit de la famille',
  'criminal law': 'droit pénal',
  'immigration law': 'droit de l’immigration',
  'human rights': 'droits de la personne',
  'supreme court': 'Cour suprême',
  'federal court': 'Cour fédérale',
  'tax court': 'Cour canadienne de l’impôt',
  'housing starts': 'mises en chantier',
  'gross domestic product': 'produit intérieur brut',
  'consumer price index': 'indice des prix à la consommation',
  'unemployment rate': 'taux de chômage',
  'population': 'population',
  'immigration': 'immigration',
  'health': 'santé',
  'education': 'éducation',
  'environment': 'environnement',
  'climate change': 'changements climatiques',
  'public safety': 'sécurité publique',
  'government spending': 'dépenses publiques',
  'procurement': 'approvisionnement',
  'budget': 'budget',
  'regulation': 'règlement',
  'legislation': 'législation',
  'parliament': 'parlement',
  'committee': 'comité',
  'lobbying': 'lobbyisme',
};

export interface LocalizedQuery {
  /** Query as issued by the caller. */
  source: string;
  /** Language the caller issued the query in. */
  sourceLang: QueryLang;
  /** Query rewritten for the target source language. */
  localized: string;
  /** Target language. */
  targetLang: QueryLang;
  /** Terminology pairs that were applied (source term → target term). */
  applied: Array<{ en: string; fr: string }>;
}

/**
 * Translate a query to the target source language using the terminology
 * table. Unmatched terms are preserved as-is, so a French query stays intact
 * and English remains a superset lookup.
 */
export function localizeQuery(query: string, targetLang: QueryLang = 'fr'): LocalizedQuery {
  const normalizedQuery = query.trim();
  if (targetLang === 'en') {
    return { source: normalizedQuery, sourceLang: 'fr', localized: normalizedQuery, targetLang, applied: [] };
  }

  const applied: Array<{ en: string; fr: string }> = [];
  let localized = normalizedQuery;
  // Longest phrases first so "employment law" wins over "employment".
  const phrases = Object.keys(QUERY_TERMINOLOGY).sort((a, b) => b.length - a.length);
  for (const en of phrases) {
    const fr = QUERY_TERMINOLOGY[en];
    const pattern = new RegExp(`\\b${en.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
    if (pattern.test(localized)) {
      localized = localized.replace(pattern, fr);
      applied.push({ en, fr });
    }
  }

  return { source: normalizedQuery, sourceLang: 'en', localized, targetLang, applied };
}

export interface BilingualField {
  en: string;
  fr: string;
}

export interface BilingualQueryRecord {
  id: string;
  source: DataSourceId;
  title: BilingualField;
  summary: BilingualField;
  /** Locale-appropriate values, derived from the `lang` of the query. */
  title_preferred: string;
  summary_preferred: string;
}

export interface BilingualQueryFixture {
  lang: QueryLang;
  localizedQuery: LocalizedQuery;
  /** Whether the French source path was used (must be true for lang=fr). */
  usedFrenchPath: boolean;
  results: BilingualQueryRecord[];
}

/**
 * Deterministic fixture for a French query against the bilingual sources.
 * Used by the MCP query tools and pinned by tests: every record carries both
 * official-language fields, and `title_fr` / `summary_fr` are never empty.
 */
const FR_QUERY_FIXTURE_ROWS: ReadonlyArray<{
  id: string;
  source: DataSourceId;
  title: BilingualField;
  summary: BilingualField;
}> = [
  {
    id: 'canlii:employment-law-2026',
    source: 'canlii',
    title: {
      en: 'Employment law — recent decisions',
      fr: 'Droit du travail — décisions récentes',
    },
    summary: {
      en: 'Digest of recent employment law decisions published on CanLII.',
      fr: 'Recueil de décisions récentes en droit du travail publiées sur CanLII.',
    },
  },
  {
    id: 'gazette-p1:2026-45',
    source: 'gazette-p1',
    title: {
      en: 'Canada Gazette, Part I, Volume 160, Number 45',
      fr: 'Gazette du Canada, Partie I, volume 160, numéro 45',
    },
    summary: {
      en: 'Notices, appointments and proposed regulations.',
      fr: 'Avis, nominations et projets de règlement.',
    },
  },
  {
    id: 'statcan:14-10-0287-01',
    source: 'statcan',
    title: {
      en: 'Labour force characteristics, monthly',
      fr: 'Caractéristiques de la population active, mensuel',
    },
    summary: {
      en: 'Employment and unemployment estimates from the Labour Force Survey.',
      fr: 'Estimations de l’emploi et du chômage tirées de l’Enquête sur la population active.',
    },
  },
  {
    id: 'quebec-open-data:emploi',
    source: 'quebec-open-data',
    title: {
      en: 'Québec employment datasets',
      fr: 'Jeux de données sur l’emploi au Québec',
    },
    summary: {
      en: 'Employment and labour market datasets on the Québec open data portal.',
      fr: 'Jeux de données sur l’emploi et le marché du travail du portail de données ouvertes du Québec.',
    },
  },
];

/**
 * Build the bilingual result view for a query.
 *
 * `lang: 'fr'` selects the French source URL and French preferred fields;
 * the English fields are always present so an English-speaking consumer can
 * still read a French-sourced record and vice versa.
 */
export function buildBilingualQueryFixture(
  args: { query: string; lang?: QueryLang; sources?: DataSourceId[] },
): BilingualQueryFixture {
  const lang: QueryLang = args.lang === 'fr' ? 'fr' : 'en';
  const localizedQuery = localizeQuery(args.query, lang);
  const requested = new Set<DataSourceId>(args.sources ?? ['canlii', 'gazette-p1', 'statcan', 'quebec-open-data']);

  const rows = FR_QUERY_FIXTURE_ROWS.filter((row) => requested.has(row.source));

  return {
    lang,
    localizedQuery,
    usedFrenchPath: rows.length > 0 && rows.every((row) => Boolean(sourceUrl(row.source, 'fr'))),
    results: rows.map((row) => ({
      id: row.id,
      source: row.source,
      title: { en: row.title.en, fr: row.title.fr },
      summary: { en: row.summary.en, fr: row.summary.fr },
      title_preferred: lang === 'fr' ? row.title.fr : row.title.en,
      summary_preferred: lang === 'fr' ? row.summary.fr : row.summary.en,
    })),
  };
}
