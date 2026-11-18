// SPDX-License-Identifier: AGPL-3.0-only
// Cross-module datastore — caches MCP results and enables cross-API queries.
// JSON-file-backed. No native SQLite dependency.
// Each entry stores results from one tool call, tagged by tool name and query key.

import { cached } from './upstream-fetcher.js';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { homedir } from 'os';

interface DataStoreEntry {
  tool: string;
  queryKey: string;
  data: unknown;
  savedAt: string;
  ttl: number;
}

const DATA_DIR = join(homedir(), '.quill', 'datastore');
const CACHE_FILE = join(DATA_DIR, 'cache.json');

async function ensureDir(): Promise<void> {
  try { await mkdir(DATA_DIR, { recursive: true }); } catch { /* dir may already exist */ }
}

async function loadCache(): Promise<Record<string, DataStoreEntry>> {
  await ensureDir();
  try {
    const raw = await readFile(CACHE_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

async function saveCache(cache: Record<string, DataStoreEntry>): Promise<void> {
  await ensureDir();
  await writeFile(CACHE_FILE, JSON.stringify(cache, null, 2), 'utf-8');
}

export async function storeResult(
  tool: string,
  queryKey: string,
  data: unknown,
  ttlHours = 24
): Promise<void> {
  const cache = await loadCache();
  const key = `${tool}::${queryKey}`;
  cache[key] = { tool, queryKey, data, savedAt: new Date().toISOString(), ttl: ttlHours };
  await saveCache(cache);
}

export async function getStoredResult(tool: string, queryKey: string): Promise<unknown | null> {
  const cache = await loadCache();
  const key = `${tool}::${queryKey}`;
  const entry = cache[key];
  if (!entry) return null;

  const ageHours = (Date.now() - new Date(entry.savedAt).getTime()) / 3600000;
  if (ageHours > entry.ttl) {
    delete cache[key];
    await saveCache(cache);
    return null;
  }
  return entry.data;
}

export async function crossQuery(tools: string[], filterFn?: (entry: DataStoreEntry) => boolean): Promise<DataStoreEntry[]> {
  const cache = await loadCache();
  const entries = Object.values(cache);
  const filtered = tools.length > 0 ? entries.filter(e => tools.includes(e.tool)) : entries;
  return filterFn ? filtered.filter(filterFn) : filtered;
}

export async function datastoreStats(): Promise<{ total: number; tools: Record<string, number> }> {
  const cache = await loadCache();
  const entries = Object.values(cache);
  const toolCounts: Record<string, number> = {};
  for (const e of entries) {
    toolCounts[e.tool] = (toolCounts[e.tool] || 0) + 1;
  }
  return { total: entries.length, tools: toolCounts };
}
