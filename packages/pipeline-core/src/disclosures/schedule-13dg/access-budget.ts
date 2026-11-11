// SPDX-License-Identifier: AGPL-3.0-only

import { MAX_ACCESS_ATTEMPTS } from './constants.js';

export interface AccessAttemptResult {
  outcome: 'refused-zero-budget' | 'failed-closed' | 'completed';
  transportCalls: number;
  waits: readonly number[];
  status: number | null;
}

/**
 * Budget and backoff contract. The caller supplies the transport.
 * This function does not open a socket and does not build a URL.
 * A budget of zero returns before the transport is called.
 */
export async function runBoundedAccess(args: {
  budgetRequests: number;
  transport: () => Promise<{ status: number }>;
  sleep: (ms: number) => Promise<void>;
}): Promise<AccessAttemptResult> {
  if (!Number.isFinite(args.budgetRequests) || args.budgetRequests <= 0) {
    return { outcome: 'refused-zero-budget', transportCalls: 0, waits: [], status: null };
  }

  const waits: number[] = [];
  const maxAttempts = Math.min(MAX_ACCESS_ATTEMPTS, Math.floor(args.budgetRequests));
  let calls = 0;
  let status: number | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    calls += 1;
    try {
      const response = await args.transport();
      status = response.status;
    } catch {
      return { outcome: 'failed-closed', transportCalls: calls, waits, status: null };
    }

    if (status >= 200 && status < 300) {
      return { outcome: 'completed', transportCalls: calls, waits, status };
    }

    const retryable = status === 403 || status === 429;
    if (!retryable || attempt === maxAttempts) {
      return { outcome: 'failed-closed', transportCalls: calls, waits, status };
    }

    const waitMs = 1000 * 2 ** (attempt - 1);
    waits.push(waitMs);
    await args.sleep(waitMs);
  }

  return { outcome: 'failed-closed', transportCalls: calls, waits, status };
}
