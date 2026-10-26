// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Signal Store — in-memory change detection for upstream data sources.
 *
 * Tracks item IDs seen per source. On each check, compares fresh results
 * against known IDs and returns new items. No persistence — resets on restart.
 */

interface SeenEntry {
  id: string;
  title: string;
  firstSeen: number;
}

interface SourceState {
  seen: Map<string, SeenEntry>;
  lastCheck: number;
}

const sources = new Map<string, SourceState>();

export function getOrCreateSource(source: string): SourceState {
  if (!sources.has(source)) {
    sources.set(source, { seen: new Map(), lastCheck: 0 });
  }
  return sources.get(source)!;
}

export function registerSeen(source: string, id: string, title: string): void {
  const state = getOrCreateSource(source);
  if (!state.seen.has(id)) {
    state.seen.set(id, { id, title, firstSeen: Date.now() });
  }
}

export function isNew(source: string, id: string): boolean {
  const state = sources.get(source);
  return state ? !state.seen.has(id) : true;
}

export interface SignalFinding {
  source: string;
  id: string;
  title: string;
  firstSeen: number;
}

export function getNewItems(source: string, freshIds: Set<string>): SignalFinding[] {
  const state = getOrCreateSource(source);
  const newItems: SignalFinding[] = [];

  for (const id of freshIds) {
    if (!state.seen.has(id)) {
      const entry: SeenEntry = { id, title: '', firstSeen: Date.now() };
      state.seen.set(id, entry);
      newItems.push({ source, id, title: '', firstSeen: entry.firstSeen });
    }
  }

  state.lastCheck = Date.now();
  return newItems;
}

export function getSourceStats(): Record<string, { totalSeen: number; lastCheck: number }> {
  const stats: Record<string, { totalSeen: number; lastCheck: number }> = {};
  for (const [name, state] of sources) {
    stats[name] = { totalSeen: state.seen.size, lastCheck: state.lastCheck };
  }
  return stats;
}

export function getAllSeen(source: string): SeenEntry[] {
  const state = sources.get(source);
  return state ? Array.from(state.seen.values()) : [];
}
