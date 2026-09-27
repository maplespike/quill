// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

const USER_AGENT = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';
const TIMEOUT = 30_000;

async function fetchOk(url: string): Promise<{ ok: boolean; status: number; body?: string }> {
  const maxAttempts = 5;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const resp = await fetch(url, {
        headers: { 'User-Agent': USER_AGENT },
        signal: AbortSignal.timeout(TIMEOUT),
      });
      const body = await resp.text().catch(() => '');
      return { ok: resp.ok, status: resp.status, body };
    } catch {
      if (attempt === maxAttempts) {
        return { ok: false, status: 0 };
      }
      // wait longer before retrying
      await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
    }
  }
  // unreachable
  return { ok: false, status: 0 };
}

// ── Upstream reachability tests (MCP tool critical path) ──────────