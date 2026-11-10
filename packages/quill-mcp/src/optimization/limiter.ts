// SPDX-License-Identifier: AGPL-3.0-only
const DEFAULT_MAX_RESULTS = 200;
const ABSOLUTE_MAX = 1000;

export function applyLimit<T>(data: T[], requested?: number): T[] {
  const limit = Math.min(
    requested && requested > 0 ? requested : DEFAULT_MAX_RESULTS,
    ABSOLUTE_MAX,
  );
  return data.slice(0, limit);
}

export function validateLimit(value: unknown): number | null {
  if (value === undefined || value === null) return null;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1) return null;
  return Math.min(n, ABSOLUTE_MAX);
}
