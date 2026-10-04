/**
 * UN Data API Client — Quill
 *
 * Typed wrapper around the UNdata SDMX REST API.
 * No authentication required. 32+ databases, ~60M records.
 *
 * API Reference:
 *   Base: http://data.un.org/ws/rest/
 *   Format: SDMX-ML (XML) or JSON
 *   Auth: None required
 *   Limits: None documented (fair use expected)
 *
 * Terms: Consult UNdata and agency-specific terms; do not infer permission from API access.
 */

import { XMLParser } from 'fast-xml-parser';
import { httpGet } from '../../utils/http.js';
import {
  UN_DEFAULT_TIMEOUT_MS,
  unDataUrl,
  unDataflowUrl,
  unDataStructureUrl,
} from './constants.js';
import type {
  SdmxMessage,
  SdmxSeries,
  SdmxObs,
  UnDataflowInfo,
} from './types.js';

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@',
  isArray: (name: string) => {
    return name === 'generic:Series' || name === 'Series' ||
           name === 'generic:Obs' || name === 'Obs' ||
           name === 'generic:Value' || name === 'Value';
  },
});

export class UnApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly dataflowId?: string,
  ) {
    super(message);
    this.name = 'UnApiError';
  }
}

export async function fetchDatasetXml(
  dataflowId: string,
  options: {
    key?: string;
    startTime?: string;
    endTime?: string;
    timeoutMs?: number;
  } = {},
): Promise<SdmxMessage> {
  const timeoutMs = options.timeoutMs ?? UN_DEFAULT_TIMEOUT_MS;

  try {
    const url = unDataUrl(dataflowId, {
      key: options.key,
      startTime: options.startTime,
      endTime: options.endTime,
      detail: 'dataonly',
    });

    const resp = await httpGet(url, {
      headers: { Accept: 'application/json' },
      timeoutMs,
    });

    if (resp.statusCode !== 200) {
      throw new UnApiError(
        `UN SDMX API returned ${resp.statusCode} for dataflow ${dataflowId}`,
        resp.statusCode,
        dataflowId,
      );
    }

    const bodyText = resp.body;
    if (!bodyText || bodyText.trim().length === 0) {
      return {};
    }

    // Try JSON first (format=json param), fall back to XML parsing
    try {
      const jsonBody = await resp.json();
      if (jsonBody && typeof jsonBody === 'object') {
        return normalizeJsonSdmx(jsonBody as Record<string, unknown>);
      }
    } catch {
      // Not JSON — parse as XML
    }

    const parsed = xmlParser.parse(bodyText);
    return (parsed as Record<string, unknown>)['message:GenericData'] as SdmxMessage
      ?? (parsed as Record<string, unknown>)['message:CompactData'] as SdmxMessage
      ?? parsed as SdmxMessage;
  } catch (error) {
    if (error instanceof UnApiError) throw error;
    throw new UnApiError(
      `Failed to fetch UN dataflow ${dataflowId}: ${(error as Error).message}`,
      undefined,
      dataflowId,
    );
  }
}

export async function fetchDataflows(
  options: { timeoutMs?: number } = {},
): Promise<UnDataflowInfo[]> {
  const timeoutMs = options.timeoutMs ?? UN_DEFAULT_TIMEOUT_MS;

  try {
    const url = unDataflowUrl();
    const resp = await httpGet(url, {
      headers: { Accept: 'application/json' },
      timeoutMs,
    });

    if (resp.statusCode !== 200) return [];

    const bodyText = resp.body;
    if (!bodyText || bodyText.trim().length === 0) return [];

    try {
      const jsonBody = await resp.json();
      return extractDataflows(jsonBody);
    } catch {
      const parsed = xmlParser.parse(bodyText);
      return extractDataflowsFromXml(parsed);
    }
  } catch {
    return [];
  }
}

export async function fetchDataStructure(
  agency: string,
  structureId: string,
  options: { timeoutMs?: number } = {},
): Promise<Record<string, unknown> | null> {
  const timeoutMs = options.timeoutMs ?? UN_DEFAULT_TIMEOUT_MS;

  try {
    const url = unDataStructureUrl(agency, structureId);
    const resp = await httpGet(url, {
      headers: { Accept: 'application/json' },
      timeoutMs,
    });

    if (resp.statusCode !== 200) return null;

    try {
      return await resp.json();
    } catch {
      return null;
    }
  } catch {
    return null;
  }
}

export function extractSeriesFromSdmx(message: SdmxMessage): SdmxSeries[] {
  const dataSection = message['message:GenericData'] ?? message['message:CompactData'];
  if (!dataSection) return [];

  const dataSet = dataSection['message:DataSet'];
  if (!dataSet) return [];

  const dataSets = Array.isArray(dataSet) ? dataSet : [dataSet];
  const allSeries: SdmxSeries[] = [];

  for (const ds of dataSets) {
    const series = ds['generic:Series'] ?? ds['Series'];
    if (!series) continue;
    const seriesArr = Array.isArray(series) ? series : [series];
    allSeries.push(...seriesArr);
  }

  return allSeries;
}

export function extractObsFromSeries(series: SdmxSeries): SdmxObs[] {
  const obs = series['generic:Obs'] ?? series['Obs'];
  if (!obs) return [];
  return Array.isArray(obs) ? obs : [obs];
}

export function extractSeriesKeyValue(series: SdmxSeries): Record<string, string> {
  const seriesKey = series['generic:SeriesKey'] ?? series['SeriesKey'];
  if (!seriesKey) return {};

  const values = seriesKey['generic:Value'] ?? seriesKey['Value'];
  if (!values) return {};

  const valueArr = Array.isArray(values) ? values : [values];
  const result: Record<string, string> = {};
  for (const v of valueArr) {
    const id = v['@id'] ?? v.id ?? '';
    const val = v['@value'] ?? v.value ?? '';
    if (id) result[id] = val;
  }
  return result;
}

function normalizeJsonSdmx(jsonBody: Record<string, unknown>): SdmxMessage {
  // UN SDMX JSON format: { structure: { ... }, data: { observations: [...] } }
  // Normalize to our SdmxMessage shape
  if (jsonBody.structure || jsonBody.data) {
    const dataSets = (jsonBody.data as Record<string, unknown>)?.observations;
    return {
      'message:GenericData': {
        'message:DataSet': dataSets ? { 'generic:Series': dataSets } : undefined,
      },
    } as SdmxMessage;
  }
  return jsonBody as unknown as SdmxMessage;
}

function extractDataflows(jsonBody: unknown): UnDataflowInfo[] {
  if (!jsonBody || typeof jsonBody !== 'object') return [];

  const obj = jsonBody as Record<string, unknown>;
  const structure = obj.structure as Record<string, unknown> | undefined;
  if (!structure) return [];

  const dataflows = structure.dataflows as Array<Record<string, unknown>> | undefined;
  if (!Array.isArray(dataflows)) return [];

  return dataflows.map((df) => {
    const id = String(df.id ?? '');
    const name = df.name
      ? typeof df.name === 'string' ? df.name : String((df.name as Record<string, unknown>)['#text'] ?? '')
      : id;
    const code = id.includes('/') ? id.split('/').pop() ?? id : id;

    return {
      id,
      name,
      databaseCode: code.replace(/^DF_/, ''),
      description: df.description ? String(df.description) : null,
    };
  });
}

function extractDataflowsFromXml(parsed: unknown): UnDataflowInfo[] {
  const obj = parsed as Record<string, unknown>;
  const msg = obj['message:Structure'] as Record<string, unknown> | undefined;
  if (!msg) return [];

  const structures = msg['structure:Structures'] as Record<string, unknown> | undefined;
  if (!structures) return [];

  const dataflows = structures['structure:Dataflows'] as Record<string, unknown> | undefined;
  if (!dataflows) return [];

  const flowList = dataflows['structure:Dataflow'] as Array<Record<string, unknown>> | undefined;
  if (!Array.isArray(flowList)) return [];

  return flowList.map((df) => {
    const id = String(df['@id'] ?? df.id ?? '');
    const nameObj = df['common:Name'] ?? df['structure:Name'];
    const name = typeof nameObj === 'string' ? nameObj
      : nameObj && typeof nameObj === 'object' ? String((nameObj as Record<string, unknown>)['#text'] ?? id)
      : id;
    const code = id.includes('/') ? id.split('/').pop() ?? id : id;

    return {
      id,
      name,
      databaseCode: code.replace(/^DF_/, ''),
      description: null,
    };
  });
}
