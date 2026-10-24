// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Request-scoped context for MCP tool calls.
 *
 * Uses Node.js AsyncLocalStorage (Node ≥16) so each concurrent tool call
 * (e.g. two SSE clients posting /messages simultaneously) gets its own
 * isolated identity bucket. The previous module-level mutable `let current`
 * approach had a TOCTOU race: request A's `setCurrentIdentity` could be
 * overwritten by request B during an `await` yield inside the handler.
 *
 * AsyncLocalStorage.run(identity, () => handler()) sets the store for the
 * duration of the handler and all its async descendants — even across
 * `await` boundaries — then restores the previous scope when it returns.
 *
 * Only `system_health` currently reads via `getCurrentIdentity()`. The
 * quota gate in `server.ts` uses the explicit `identity` parameter on
 * `handleMessage`, not this slot, so the gate is always correct regardless
 * of the AsyncLocalStorage state.
 */

import { AsyncLocalStorage } from 'node:async_hooks';
import type { QuotaIdentity } from './quota.js';

const store = new AsyncLocalStorage<QuotaIdentity>();

/**
 * Set the identity for the current async context.
 *
 * Typically called by the server dispatch (server.ts) via
 * `store.run(identity, () => handler())` rather than by transports directly.
 * The direct-set path exists for backward compatibility with stdio.
 */
export function setCurrentIdentity(id: QuotaIdentity): void {
  store.enterWith(id);
}

/**
 * Wrap a function so it executes with the given identity in AsyncLocalStorage.
 * Use this in server.ts when dispatching tool handlers:
 *
 *   await runWithIdentity(identity, () => tool.handler(args));
 */
export function runWithIdentity<T>(id: QuotaIdentity, fn: () => T): T {
  return store.run(id, fn);
}

/** Read the identity for the current async context (null if unset). */
export function getCurrentIdentity(): QuotaIdentity | null {
  return store.getStore() ?? null;
}

/** Clear the slot — useful in tests. */
export function clearCurrentIdentity(): void {
  store.enterWith(undefined as unknown as QuotaIdentity);
}
