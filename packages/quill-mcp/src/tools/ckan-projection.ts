// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Pure CKAN record shaping — no network, no workspace imports, so it can be
 * unit-tested without pulling the pipeline packages.
 */

/**
 * CKAN's package_search returns the whole dataset record: every file in the
 * dataset (url, hash, size, datastore flags), licence boilerplate, org blobs
 * and relationship arrays. Measured 2026-11-27: a single immigration record was
 * 60,035 bytes, of which `resources` was 59,727 — so `limit: 10` returned
 * 621,732 bytes to an agent. That is what made quill.search_immigration look
 * like it had hung: nothing was slow (the call took 0.55 s), the tool result
 * was just enormous.
 *
 * Project to what an agent can actually use, and never exceed a byte budget.
 * `detail: 'full'` remains available for callers that need the raw record.
 */
export const CKAN_NOTES_MAX = 320;
export const CKAN_RESULT_BYTE_BUDGET = 24_000;

function asText(value: unknown): string | undefined {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed || undefined;
  }
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    for (const key of ['en', 'fr']) {
      const candidate = obj[key];
      if (typeof candidate === 'string' && candidate.trim()) return candidate.trim();
    }
    const first = Object.values(obj).find((v): v is string => typeof v === 'string' && !!v.trim());
    return first?.trim();
  }
  return undefined;
}

function excerpt(text: string | undefined, max = CKAN_NOTES_MAX): string | undefined {
  if (!text) return undefined;
  const flat = text.replace(/\s+/g, ' ').trim();
  if (!flat) return undefined;
  return flat.length <= max ? flat : `${flat.slice(0, max - 1)}\u2026`;
}

/** Case-insensitive de-duplication, keeping the first spelling and order. */
function uniqueFold(values: (string | undefined)[], max: number): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    if (!value) continue;
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(value);
    if (out.length >= max) break;
  }
  return out;
}

/** Compact, stable projection of one CKAN dataset record. */
export function projectCkanRecord(raw: Record<string, unknown>): Record<string, unknown> {
  const resources = Array.isArray(raw.resources) ? (raw.resources as Record<string, unknown>[]) : [];
  const formats = uniqueFold(
    resources.map((resource) => asText(resource.format) ?? asText(resource.resource_type)),
    6,
  );
  const tags = Array.isArray(raw.tags) ? (raw.tags as Record<string, unknown>[]) : [];
  const subjects = uniqueFold([
    ...tags.map((tag) => asText(tag.display_name) ?? asText(tag.name)),
    ...(Array.isArray(raw.subject) ? (raw.subject as unknown[]).map(asText) : []),
  ], 8);

  return {
    id: asText(raw.id) ?? asText(raw.name),
    title: asText(raw.title) ?? asText(raw.title_translated),
    url: asText(raw.url),
    publisher: asText(raw.org_title_at_publication) ?? asText(raw.maintainer) ?? asText(raw.organization),
    published: asText(raw.date_published) ?? asText(raw.metadata_created),
    modified: asText(raw.metadata_modified),
    subjects: subjects.length ? subjects : undefined,
    resource_count: resources.length || undefined,
    formats: formats.length ? formats : undefined,
    notes: excerpt(asText(raw.notes) ?? asText(raw.notes_translated)),
  };
}

export function budgetedProjection(rawResults: Record<string, unknown>[]): {
  results: Record<string, unknown>[];
  truncated: boolean;
} {
  const projected: Record<string, unknown>[] = [];
  let bytes = 0;
  let truncated = false;
  for (const raw of rawResults) {
    const record = projectCkanRecord(raw);
    const size = JSON.stringify(record).length + 1;
    if (bytes + size > CKAN_RESULT_BYTE_BUDGET && projected.length > 0) {
      truncated = true;
      break;
    }
    projected.push(record);
    bytes += size;
  }
  return { results: projected, truncated };
}
