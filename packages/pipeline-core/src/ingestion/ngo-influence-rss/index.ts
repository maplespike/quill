import { fetchAllNgoSources, fetchNgoSource, searchNgoItems } from './fetcher.js';
import { NGO_RSS_SOURCES } from './constants.js';
import type { NgoRssItem, NgoRssIngestionResult, NgoRssConfig, NgoCategory, NarrativeFlag } from './types.js';

/** Ingest all NGO/influence RSS sources */
export async function ingestAllNgoRss(): Promise<NgoRssIngestionResult> {
  return fetchAllNgoSources();
}

/** Ingest a single source by name */
export async function ingestNgoSource(name: string): Promise<NgoRssItem[]> {
  const source = NGO_RSS_SOURCES.find(s => s.name === name);
  if (!source) return [];
  return fetchNgoSource(source);
}

/** Search across cached NGO RSS items */
export function searchNgoRss(items: NgoRssItem[], query: string): NgoRssItem[] {
  return searchNgoItems(items, query);
}

/** Classify narrative flags for an item */
export function classifyNarrative(item: NgoRssItem): NarrativeFlag[] {
  const flags: NarrativeFlag[] = [];
  const tags = item.narrativeTags.map(t => t.toLowerCase());
  const text = item.title.toLowerCase();

  if (tags.some(t => t.includes('wef') || t.includes('global-governance'))) flags.push('wef-alignment');
  if (tags.some(t => t.includes('foreign-policy') || t.includes('trade'))) flags.push('foreign-influence');
  if (tags.some(t => t.includes('economic-policy') || t.includes('regulation'))) flags.push('policy-echo');
  if (tags.some(t => t.includes('advocacy') || t.includes('human-rights'))) flags.push('none');

  if (text.includes('great reset') || text.includes('world economic forum')) flags.push('wef-alignment');
  if (flags.length === 0) flags.push('none');

  return [...new Set(flags)];
}

export { NGO_RSS_SOURCES } from './constants.js';
export type { NgoRssItem, NgoRssIngestionResult, NgoRssConfig, NgoCategory, NarrativeFlag } from './types.js';
export { parseNgoRssItem, parseNgoRssItems, normalizeDate, parseNumeric } from './parser.js';
