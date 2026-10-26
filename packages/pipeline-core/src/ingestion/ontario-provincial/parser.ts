// SPDX-License-Identifier: AGPL-3.0-only

import { computeHash } from '../../verification/hashing.js';
import type {
  OntarioCKANRecord,
  OntarioCKANResource,
  OntarioProvincialResult,
} from './types.js';

export async function parseOntarioProvincialRecords(
  rawRecords: OntarioCKANRecord[],
  options: {
    sourceUrl?: string;
    skipDedup?: boolean;
  } = {},
): Promise<OntarioProvincialResult[]> {
  const now = new Date().toISOString();
  const records: OntarioProvincialResult[] = [];
  const seenHashes = new Set<string>();

  for (const pkg of rawRecords) {
    try {
      const orgName = pkg.organization?.title ?? undefined;
      const orgId = pkg.organization?.id ?? undefined;
      const maintainer = pkg.maintainer ?? undefined;
      const createdDate = pkg.metadata_created ?? undefined;
      const lastModifiedDate = pkg.metadata_modified ?? undefined;

      for (const resource of pkg.resources) {
        try {
          const hashContent = `ontario-ckan|${pkg.id}|${resource.id}|${resource.url}`;
          const id = await computeHash(hashContent, 'sha256');
          if (!options.skipDedup && seenHashes.has(id)) continue;
          seenHashes.add(id);

          records.push({
            id,
            packageName: pkg.name ?? '',
            packageTitle: pkg.title ?? '',
            packageDescription: pkg.notes ?? undefined,
            organizationName: orgName,
            organizationId: orgId,
            maintainer,
            resourceName: resource.name ?? '',
            resourceFormat: resource.format ?? undefined,
            resourceUrl: resource.url,
            resourceSize: normalizeResourceSize(resource.size),
            createdDate: normalizeDate(resource.created ?? createdDate),
            lastModifiedDate: normalizeDate(resource.last_modified ?? lastModifiedDate),
            sourceSystem: 'ontario-ckan-parser',
            ckanPackageId: pkg.id,
            ckanResourceId: resource.id,
            ingestedAt: now,
          });
        } catch (err) {
          console.warn(`[Ontario Parser] Skipping resource "${resource.name}" in package "${pkg.name}": ${err instanceof Error ? err.message : String(err)}`);
        }
      }
    } catch (err) {
      console.warn(`[Ontario Parser] Skipping package "${pkg.name}": ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return records;
}

function normalizeResourceSize(size: number | string | undefined): number | undefined {
  if (size === undefined || size === null) return undefined;
  if (typeof size === 'number') return size;
  const num = parseInt(String(size), 10);
  return isNaN(num) ? undefined : num;
}

function normalizeDate(dateStr: string | undefined): string | undefined {
  if (!dateStr) return undefined;
  try {
    const date = new Date(dateStr);
    return isNaN(date.getTime()) ? undefined : date.toISOString();
  } catch {
    return undefined;
  }
}