/**
 * LODE Geospatial — Fetcher
 *
 * WFS/WMS client for Canadian geospatial data sources:
 * - BC LODE (BC Land Ownership Data Exchange)
 * - GeoMet (Environment Canada weather geo data)
 *
 * Uses native fetch (ES2022+).
 */

import { WFS_VERSION, LODE_SOURCES } from './constants.js';
import type { BoundingBox, GeoFeature, GeoLayer, LODEResult } from './types.js';

/* ------------------------------------------------------------------ */
/*  XML helpers                                                        */
/* ------------------------------------------------------------------ */

/**
 * Minimal XML tag value extractor.  Avoids pulling in a full DOM/XML
 * parser dependency.  Returns the text content of the *first* matching
 * element at the top level of {@code xml}.
 */
function extractTag(xml: string, tag: string): string | null {
  const open = `<${tag}>`;
  const close = `</${tag}>`;
  const start = xml.indexOf(open);
  if (start === -1) return null;
  const valueStart = start + open.length;
  const valueEnd = xml.indexOf(close, valueStart);
  if (valueEnd === -1) return null;
  return xml.slice(valueStart, valueEnd).trim();
}

/**
 * Extract all occurrences of a parent tag that contain a given child tag,
 * returning an array of the child tag values.  Used to parse
 * <FeatureType><Name>…</Name>…</FeatureType> blocks from
 * GetCapabilities XML.
 */
function extractRepeatedTag(xml: string, parentTag: string, childTag: string): string[] {
  const results: string[] = [];
  const parentOpen = `<${parentTag}>`;
  const parentClose = `</${parentTag}>`;
  let pos = 0;
  while (true) {
    const blockStart = xml.indexOf(parentOpen, pos);
    if (blockStart === -1) break;
    const blockEnd = xml.indexOf(parentClose, blockStart);
    if (blockEnd === -1) break;
    const block = xml.slice(blockStart + parentOpen.length, blockEnd);

    const childOpen = `<${childTag}>`;
    const childClose = `</${childTag}>`;
    const cs = block.indexOf(childOpen);
    if (cs !== -1) {
      const ce = block.indexOf(childClose, cs);
      if (ce !== -1) {
        results.push(block.slice(cs + childOpen.length, ce).trim());
      }
    }
    pos = blockEnd + parentClose.length;
  }
  return results;
}

/* ------------------------------------------------------------------ */
/*  WFS Capabilities -> Layer list                                      */
/* ------------------------------------------------------------------ */

/**
 * Discover available WFS layers from a GeoServer-compatible endpoint.
 *
 * Sends a WFS GetCapabilities request and parses the FeatureTypeList
 * from the returned XML.  Returns an empty array on any error.
 */
export async function discoverLayers(baseUrl: string): Promise<GeoLayer[]> {
  try {
    const url = `${baseUrl.replace(/\/+$/, '')}?service=WFS&request=GetCapabilities&version=${WFS_VERSION}`;
    const response = await fetch(url, {
      headers: { Accept: 'application/xml' },
      signal: AbortSignal.timeout(15_000),
    });

    if (!response.ok) {
      throw new Error(`WFS GetCapabilities returned ${response.status}`);
    }

    const xml = await response.text();

    // Extract feature type names
    const names = extractRepeatedTag(xml, 'FeatureType', 'Name');
    const titles = extractRepeatedTag(xml, 'FeatureType', 'Title');

    // Build GeoLayer list from the parsed names/titles
    const layers: GeoLayer[] = [];
    const seen = new Set<string>();

    for (let i = 0; i < names.length; i++) {
      const name = names[i];
      if (seen.has(name)) continue;
      seen.add(name);

      layers.push({
        name,
        title: titles[i] || name,
        crs: 'EPSG:4326',
        features: 0,
        bbox: { west: -180, south: -90, east: 180, north: 90 },
      });
    }

    return layers;
  } catch (error) {
    console.error(`[geospatial] discoverLayers failed for ${baseUrl}:`, (error as Error).message);
    return [];
  }
}

/* ------------------------------------------------------------------ */
/*  WFS GetFeature -> GeoJSON features                                  */
/* ------------------------------------------------------------------ */

/**
 * Fetch features from a WFS layer.
 *
 * Sends a WFS GetFeature request with `outputFormat=application/json`
 * (GeoJSON) and parses the response.  An optional bounding box can be
 * provided to spatially filter results.
 *
 * Returns an empty array on any error.
 */
export async function fetchFeatures(
  baseUrl: string,
  layerName: string,
  bbox?: BoundingBox,
): Promise<GeoFeature[]> {
  try {
    let url = `${baseUrl.replace(/\/+$/, '')}?service=WFS&request=GetFeature&version=${WFS_VERSION}&typeName=${encodeURIComponent(layerName)}&outputFormat=application/json`;

    if (bbox) {
      url += `&bbox=${bbox.west},${bbox.south},${bbox.east},${bbox.north},EPSG:4326`;
    }

    const response = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(30_000),
    });

    if (!response.ok) {
      throw new Error(`WFS GetFeature returned ${response.status} for layer "${layerName}"`);
    }

    const geoJson: any = await response.json();

    if (!geoJson || geoJson.type !== 'FeatureCollection' || !Array.isArray(geoJson.features)) {
      return [];
    }

    return geoJson.features.map((f: any) => ({
      id: f.id ?? f.properties?.id ?? '',
      type: f.geometry?.type ?? 'Unknown',
      geometry: f.geometry ?? { type: 'Unknown', coordinates: [] },
      properties: f.properties ?? {},
      bbox: f.bbox
        ? {
            west: f.bbox[0],
            south: f.bbox[1],
            east: f.bbox[2],
            north: f.bbox[3],
          }
        : undefined,
    }));
  } catch (error) {
    console.error(`[geospatial] fetchFeatures failed for "${layerName}" at ${baseUrl}:`, (error as Error).message);
    return [];
  }
}

/* ------------------------------------------------------------------ */
/*  LODE orchestration                                                  */
/* ------------------------------------------------------------------ */

/**
 * Orchestrate discovery + feature fetching for a LODE geospatial service.
 *
 * 1. Resolves the service URL from the `LODE_SOURCES` map (or uses
 *    {@code service} directly if it looks like a URL).
 * 2. Calls {@link discoverLayers} to get available layers.
 * 3. If {@code options.layers} is specified, only fetches features for
 *    those layers; otherwise fetches features for **all** discovered
 *    layers (limited to the first 5 to avoid excessive requests).
 * 4. Returns a {@link LODEResult} with accumulated features, layers,
 *    errors, and elapsed time.
 */
export async function fetchLODEData(
  service: string,
  options?: { layers?: string[]; bbox?: BoundingBox },
): Promise<LODEResult> {
  const start = performance.now();
  const errors: string[] = [];
  const allFeatures: GeoFeature[] = [];
  const allLayers: GeoLayer[] = [];

  // Resolve service URL
  let baseUrl: string | undefined;

  // Check if it's a known source key
  if (service in LODE_SOURCES) {
    baseUrl = (LODE_SOURCES as any)[service].url;
  } else {
    // Assume it's a raw URL
    baseUrl = service;
  }

  if (!baseUrl) {
    errors.push(`Unknown geospatial service: "${service}"`);
    return { features: [], layers: [], errors, durationMs: performance.now() - start };
  }

  // Step 1: discover layers
  let layers: GeoLayer[];
  try {
    layers = await discoverLayers(baseUrl);
    allLayers.push(...layers);
  } catch (err) {
    const msg = `Layer discovery failed for "${service}": ${(err as Error).message}`;
    errors.push(msg);
    console.error(`[geospatial] ${msg}`);
    return { features: [], layers: [], errors, durationMs: performance.now() - start };
  }

  if (layers.length === 0) {
    errors.push(`No layers discovered for "${service}"`);
    return { features: [], layers, errors, durationMs: performance.now() - start };
  }

  // Determine which layers to fetch
  let targetLayers: string[];
  if (options?.layers && options.layers.length > 0) {
    targetLayers = options.layers.filter((l) => layers.some((gl) => gl.name === l));
    if (targetLayers.length === 0) {
      errors.push(`None of the requested layers found on "${service}"`);
      return { features: [], layers, errors, durationMs: performance.now() - start };
    }
  } else {
    // Limit to first 5 to avoid hammering the service
    targetLayers = layers.slice(0, 5).map((l) => l.name);
  }

  // Step 2: fetch features for each target layer
  const results = await Promise.allSettled(
    targetLayers.map((layerName) =>
      fetchFeatures(baseUrl!, layerName, options?.bbox).then((features) => ({ layerName, features })),
    ),
  );

  for (const result of results) {
    if (result.status === 'fulfilled') {
      allFeatures.push(...result.value.features);
    } else {
      errors.push(`Feature fetch failed: ${result.reason?.message ?? result.reason}`);
    }
  }

  return {
    features: allFeatures,
    layers: allLayers,
    errors,
    durationMs: Math.round(performance.now() - start),
  };
}
