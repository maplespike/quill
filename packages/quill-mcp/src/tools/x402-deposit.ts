// SPDX-License-Identifier: AGPL-3.0-only
/**
 * x402 deposit MCP tool (Phase 3).
 *
 * Lets a verified caller pre-fund their credit balance via a single
 * on-chain USDC transfer, then spend across many tool calls without
 * per-call RPC verification.
 *
 * Flow:
 *   1. Client provides { signature, expectedAmount } as tool arguments.
 *   2. We call solana-rpc.verifyPaymentTx() to confirm the tx exists,
 *      is confirmed, and transferred ≥ expectedAmount USDC to X402_RECIPIENT.
 *   3. If valid AND the signature is fresh (replay-ledger recordIfNew = true),
 *      we credit CreditStore with the actual amount transferred.
 *   4. If verification fails OR the signature was already consumed,
 *      we return an error with the verification reason.
 *
 * Gated by X402_ENABLED — when disabled, the tool still resolves but
 * deposits are no-ops (free tools don't need credits).
 *
 * Exports follow the repo's tool-file convention: named `definition` and
 * `handler` exports (consumed by `tools/index.ts` via `import * as` —
 * the resulting module namespace object IS the ToolModule shape).
 */

import type { ToolDefinition, ToolHandler, ToolResponse } from './types.js';
import {
  X402_ASSET,
  X402_NETWORK,
  X402_DEFAULT_COMMITMENT,
  X402_DEFAULT_TIMESTAMP_TOLERANCE_SEC,
  X402_USDC_DECIMALS,
} from '../x402-constants.js';
import { verifyPaymentTx, X402VerificationError } from '../solana-rpc.js';
import { getReplayLedger } from '../x402-ledger.js';
import { getCreditStore } from '../credit-balance.js';
import { getCurrentIdentity, type QuotaIdentity } from '../quota.js';

export const definition: ToolDefinition = {
  name: 'x402-deposit',
  description:
    'Deposit USDC on Solana to pre-fund your credit balance. Provide a verified ' +
    'transaction signature and the amount in USDC. Subsequent tool calls draw ' +
    'from this balance without per-call on-chain latency.',
  inputSchema: {
    type: 'object',
    properties: {
      signature: {
        type: 'string',
        description: 'Base58 Solana transaction signature proving the deposit',
        minLength: 64,
        maxLength: 90,
      },
      expectedAmount: {
        type: 'number',
        description: 'Expected USDC amount (decimal, e.g. 0.10)',
        minimum: 0.001,
        maximum: 100,
      },
    },
    required: ['signature', 'expectedAmount'],
  },
};

function ok(text: string): ToolResponse {
  return { content: [{ type: 'text', text }] };
}
function err(text: string): ToolResponse {
  return { content: [{ type: 'text', text }], isError: true };
}

export const handler: ToolHandler = async (args) => {
  // Free / unconfigured path — still resolves but doesn't do anything useful.
  if (process.env.X402_ENABLED !== 'true') {
    return ok(
      '[x402] Deposits are a no-op when X402_ENABLED is false. ' +
        'Set X402_ENABLED=true, X402_RECIPIENT=<wallet>, and SOLANA_RPC_URL=https://api.mainnet-beta.solana.com (or a Helius/Alchemy URL) to enable.',
    );
  }

  const signature = typeof args.signature === 'string' ? args.signature : '';
  const expectedAmount = typeof args.expectedAmount === 'number' ? args.expectedAmount : NaN;
  if (!signature || !Number.isFinite(expectedAmount) || expectedAmount <= 0) {
    return err(
      'Invalid args: signature (base58 string, 64–90 chars) and expectedAmount (positive number, USDC decimal) are both required.',
    );
  }

  const recipient = process.env.X402_RECIPIENT || '';
  if (!recipient) {
    return err('Server misconfiguration: X402_RECIPIENT env var is not set.');
  }

  const rpcUrl = process.env.SOLANA_RPC_URL;
  if (!rpcUrl) {
    return err(
      'Server misconfiguration: SOLANA_RPC_URL env var is not set. Use a public Solana RPC (e.g. https://api.mainnet-beta.solana.com) or a Helius/Alchemy endpoint.',
    );
  }

  // Replay protection: refuse if this signature was already used.
  const ledger = getReplayLedger();
  if (ledger.has(signature)) {
    return err(
      `[x402] Replay blocked: signature ${signature.slice(0, 12)}… has already been consumed. Submit a fresh deposit.`,
    );
  }

  // Verify the on-chain tx.
  try {
    const result = await verifyPaymentTx(signature, {
      amountUsd: expectedAmount,
      recipient,
      rpcUrl,
      commitment:
        (process.env.X402_CONFIRMATION_LEVEL as 'confirmed' | 'finalized') ||
        X402_DEFAULT_COMMITMENT,
      timestampToleranceSec:
        parseInt(process.env.X402_TIMESTAMP_TOLERANCE_SEC ?? '', 10) ||
        X402_DEFAULT_TIMESTAMP_TOLERANCE_SEC,
    });

    // Mark signature as consumed ATOMICALLY with crediting the balance — if
    // recordIfNew returns false, someone else raced us between has() and
    // recordIfNew() and we must NOT credit.
    if (!ledger.recordIfNew(signature)) {
      return err(
        `[x402] Replay detected mid-verification: signature ${signature.slice(0, 12)}… was just consumed by a concurrent call. Submit a fresh deposit.`,
      );
    }

    const identity: QuotaIdentity | null = getCurrentIdentity();
    if (!identity || identity.mode === 'self-hosted') {
      // Self-hosted callers don't have a quota identity; deposits are not
      // scoped. We still consumed the replay slot — that's intentional so the
      // signature can't be re-deposited into a future hosted call. NOTE: in
      // production, the deposit tool is unreachable from self-hosted runs
      // because X402_ENABLED is normally false there too.
      return ok(
        `[x402] Verified ${result.amountRaw / BigInt(10 ** X402_USDC_DECIMALS)} USDC ` +
          `(slot ${result.slot}, blockTime ${result.blockTime}) — but no quota identity ` +
          `was attached, so credits were NOT allocated. Use the hosted SSE endpoint ` +
          `with a Bearer token for crediting.`,
      );
    }

    const creditUsd = Number(result.amountRaw) / 10 ** X402_USDC_DECIMALS;
    const status = getCreditStore().deposit(identity, creditUsd);
    return ok(JSON.stringify({
      network: X402_NETWORK,
      asset: X402_ASSET,
      depositedUsd: creditUsd.toFixed(X402_USDC_DECIMALS),
      slot: result.slot,
      blockTime: result.blockTime,
      credit: status,
    }, null, 2));
  } catch (e) {
    if (e instanceof X402VerificationError) {
      return err(`[x402] Verification failed (${e.reason}): ${e.message}`);
    }
    return err(`[x402] Unexpected error: ${(e as Error).message}`);
  }
};
