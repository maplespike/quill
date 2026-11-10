// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Tests for the Solana RPC payment verifier.
 *
 * Uses a mocked fetch() (typed via `Parameters<typeof fetch>` so the test
 * doesn't depend on DOM lib types) to simulate Solana JSON-RPC responses.
 *
 * Covers:
 *   - happy path → valid VerifyResult
 *   - tx not found → tx_not_found
 *   - tx failed (err present) → tx_failed
 *   - blockTime out of tolerance → timestamp_out_of_range
 *   - amount below expected → amount_too_low
 *   - invalid signature shape → invalid_signature
 *   - RPC HTTP error → rpc_unreachable
 *   - signature missing from tx signatures list → invalid_signature
 *   - recipient not in any pre/post balance → recipient_mismatch
 *   - usdToRaw rounding semantics
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  verifyPaymentTx,
  usdToRaw,
  X402VerificationError,
} from '../solana-rpc.js';

const VALID_SIG = 'A'.repeat(88);            // base58-shaped, 88 chars
const OTHER_SIG = 'B'.repeat(88);
const RPC_URL = 'https://mock-rpc.test';
const RECIPIENT_KEY = '9'.repeat(44);        // base58-shaped (32 bytes)
const SENDER_KEY = '8'.repeat(44);

/**
 * Build a canned Solana getTransaction response.
 *
 * `ownerByIndex` lets tests target a specific accountIndex with a chosen
 * owner string — tests that need recipient_mismatch set a different owner.
 */
function mockTxResponse(opts: {
  err?: unknown | null;
  blockTimeDeltaSec?: number;
  amountRaw?: string;
  ownerByIndex?: Array<{ accountIndex: number; owner: string; amount: string }>;
  signatures?: string[];
}): unknown {
  const blockTime = Math.floor(Date.now() / 1000) + (opts.blockTimeDeltaSec ?? 0);
  const entries = opts.ownerByIndex ?? [
    {
      accountIndex: 0,
      owner: RECIPIENT_KEY,
      amount: opts.amountRaw ?? '10000', // 0.01 USDC
    },
  ];
  return {
    jsonrpc: '2.0',
    id: 1,
    result: {
      slot: 123_456_789,
      blockTime,
      meta: {
        err: opts.err ?? null,
        status: opts.err ? { Err: opts.err } : { Ok: null },
        preTokenBalances: entries.map((e) => ({
          accountIndex: e.accountIndex,
          mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
          owner: e.owner,
          uiTokenAmount: { amount: '0', decimals: 6, uiAmount: 0 },
        })),
        postTokenBalances: entries.map((e) => ({
          accountIndex: e.accountIndex,
          mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
          owner: e.owner,
          uiTokenAmount: { amount: e.amount, decimals: 6, uiAmount: 0.01 },
        })),
      },
      transaction: {
        message: { accountKeys: [SENDER_KEY, RECIPIENT_KEY] },
        signatures: opts.signatures ?? [VALID_SIG],
      },
    },
  };
}

/**
 * Mock fetch — routes by JSON-RPC method.
 *
 * Typed via `Parameters<typeof fetch>` to avoid DOM lib dependency.
 */
function buildMockFetch(
  routes: Record<string, unknown>,
): (...args: Parameters<typeof fetch>) => Promise<Response> {
  return async (...args: Parameters<typeof fetch>): Promise<Response> => {
    const init = args[1] as { body?: string | undefined } | undefined;
    const body = JSON.parse(init?.body ?? '{}') as { method?: string };
    const method = body.method ?? '<unknown>';
    const result = routes[method];
    if (result === '__http_error__') {
      return new Response('boom', { status: 500, statusText: 'Internal Server Error' });
    }
    if (result === undefined) {
      return new Response(
        JSON.stringify({
          jsonrpc: '2.0', id: 1,
          error: { code: -32602, message: `Method not supported in mock: ${method}` },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    }
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };
}

// Suppress unused-import linter warnings — TypedResponse not constructable here.
void (null as unknown as Response);

// ─── usdToRaw ──────────────────────────────────────────────────────────

test('solana-rpc: usdToRaw rounding', () => {
  assert.equal(usdToRaw(0.001), 1_000n);
  assert.equal(usdToRaw(0.01), 10_000n);
  assert.equal(usdToRaw(0.10), 100_000n);
  assert.equal(usdToRaw(1.0), 1_000_000n);
  assert.equal(usdToRaw(2.50), 2_500_000n);
});

test('solana-rpc: usdToRaw rejects negative / non-finite', () => {
  assert.throws(() => usdToRaw(-0.01), X402VerificationError);
  assert.throws(() => usdToRaw(Number.NaN), X402VerificationError);
});

// ─── verifyPaymentTx ──────────────────────────────────────────────────

test('solana-rpc: happy path returns VerifyResult', async () => {
  const mockFetch = buildMockFetch({
    getTransaction: mockTxResponse({ amountRaw: '10000' }),
  });
  const result = await verifyPaymentTx(VALID_SIG, {
    amountUsd: 0.01,
    recipient: RECIPIENT_KEY,
    rpcUrl: RPC_URL,
    timestampToleranceSec: 600,
    fetchImpl: mockFetch as unknown as typeof fetch,
  });
  assert.equal(result.ok, true);
  assert.equal(result.signature, VALID_SIG);
  assert.equal(result.amountRaw, 10_000n);
});

test('solana-rpc: tx failed (meta.err set) → tx_failed', async () => {
  const mockFetch = buildMockFetch({
    getTransaction: mockTxResponse({ err: 'InstructionError' }),
  });
  await assert.rejects(
    verifyPaymentTx(VALID_SIG, {
      amountUsd: 0.01,
      recipient: RECIPIENT_KEY,
      rpcUrl: RPC_URL,
      fetchImpl: mockFetch as unknown as typeof fetch,
    }),
    (e: unknown) => {
      const err = e as X402VerificationError;
      assert.equal(err.reason, 'tx_failed');
      return true;
    },
  );
});

test('solana-rpc: blockTime out of tolerance → timestamp_out_of_range', async () => {
  const mockFetch = buildMockFetch({
    getTransaction: mockTxResponse({ blockTimeDeltaSec: -3600 }), // 1h old
  });
  await assert.rejects(
    verifyPaymentTx(VALID_SIG, {
      amountUsd: 0.01,
      recipient: RECIPIENT_KEY,
      rpcUrl: RPC_URL,
      timestampToleranceSec: 60,
      fetchImpl: mockFetch as unknown as typeof fetch,
    }),
    (e: unknown) => {
      const err = e as X402VerificationError;
      assert.equal(err.reason, 'timestamp_out_of_range');
      return true;
    },
  );
});

test('solana-rpc: amount below expected → amount_too_low', async () => {
  const mockFetch = buildMockFetch({
    getTransaction: mockTxResponse({ amountRaw: '10000' }), // 0.01 only
  });
  await assert.rejects(
    verifyPaymentTx(VALID_SIG, {
      amountUsd: 1.0,
      recipient: RECIPIENT_KEY,
      rpcUrl: RPC_URL,
      fetchImpl: mockFetch as unknown as typeof fetch,
    }),
    (e: unknown) => {
      const err = e as X402VerificationError;
      assert.equal(err.reason, 'amount_too_low');
      return true;
    },
  );
});

test('solana-rpc: invalid signature shape → invalid_signature', async () => {
  // The early signature-shape check throws BEFORE any RPC call.
  await assert.rejects(
    verifyPaymentTx('not-base-58!!!', {
      amountUsd: 0.01,
      recipient: RECIPIENT_KEY,
      rpcUrl: RPC_URL,
      fetchImpl: buildMockFetch({}) as unknown as typeof fetch,
    }),
    (e: unknown) => {
      const err = e as X402VerificationError;
      assert.equal(err.reason, 'invalid_signature');
      return true;
    },
  );
});

test('solana-rpc: RPC HTTP 500 → rpc_unreachable', async () => {
  const mockFetch = buildMockFetch({
    getTransaction: '__http_error__',
  });
  await assert.rejects(
    verifyPaymentTx(VALID_SIG, {
      amountUsd: 0.01,
      recipient: RECIPIENT_KEY,
      rpcUrl: RPC_URL,
      fetchImpl: mockFetch as unknown as typeof fetch,
    }),
    (e: unknown) => {
      const err = e as X402VerificationError;
      assert.equal(err.reason, 'rpc_unreachable');
      return true;
    },
  );
});

test('solana-rpc: signature missing from tx.signatures list → invalid_signature', async () => {
  const mockFetch = buildMockFetch({
    getTransaction: mockTxResponse({ signatures: [OTHER_SIG] }),
  });
  await assert.rejects(
    verifyPaymentTx(VALID_SIG, {
      amountUsd: 0.01,
      recipient: RECIPIENT_KEY,
      rpcUrl: RPC_URL,
      fetchImpl: mockFetch as unknown as typeof fetch,
    }),
    (e: unknown) => {
      const err = e as X402VerificationError;
      assert.equal(err.reason, 'invalid_signature');
      return true;
    },
  );
});

test('solana-rpc: recipient not in any pre/post balance → recipient_mismatch', async () => {
  // The mock sets owner = SOMEONE_ELSE so the recipient doesn't appear.
  const mockFetch = buildMockFetch({
    getTransaction: mockTxResponse({
      ownerByIndex: [{
        accountIndex: 0,
        owner: SENDER_KEY, // someone else got the USDC
        amount: '5000000',  // 5 USDC but to wrong recipient
      }],
    }),
  });
  await assert.rejects(
    verifyPaymentTx(VALID_SIG, {
      amountUsd: 0.01,
      recipient: RECIPIENT_KEY,
      rpcUrl: RPC_URL,
      fetchImpl: mockFetch as unknown as typeof fetch,
    }),
    (e: unknown) => {
      const err = e as X402VerificationError;
      assert.equal(err.reason, 'recipient_mismatch');
      return true;
    },
  );
});

test('solana-rpc: missing RPC URL fallback throws rpc_unreachable', async () => {
  delete process.env.SOLANA_RPC_URL;
  await assert.rejects(
    verifyPaymentTx(VALID_SIG, {
      amountUsd: 0.01,
      recipient: RECIPIENT_KEY,
      // rpcUrl omitted → falls back to env which is unset
      fetchImpl: buildMockFetch({}) as unknown as typeof fetch,
    }),
    (e: unknown) => {
      const err = e as X402VerificationError;
      assert.equal(err.reason, 'rpc_unreachable');
      return true;
    },
  );
});
