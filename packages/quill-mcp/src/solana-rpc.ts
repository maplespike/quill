// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Solana JSON-RPC verification for x402 payment proofs (Phase 2).
 *
 * Lightweight HTTP-only client. Avoids the @solana/web3.js dependency
 * by speaking Solana JSON-RPC directly over fetch(). Three-step flow:
 *
 *   1. introspect  — `getTransaction(signature)` to fetch the on-chain tx
 *   2. simulate    — pre/post USDC token balance diff for recipient ≥ expected
 *   3. confirm     — tx status == Ok AND blockTime within tolerance
 *
 * All failures throw `X402VerificationError` with a `reason` code so the
 * middleware can surface a specific error to the caller.
 */

import { X402_ASSET } from './x402-constants.js';

// ─── Types ──────────────────────────────────────────────────────────────

export type ConfirmationLevel = 'confirmed' | 'finalized';

export interface VerifyOptions {
  /** USDC amount expected (decimal USDC, e.g. 0.01 = 1 cent) */
  amountUsd: number;
  /** Recipient wallet public key (base58) */
  recipient: string;
  /** Tolerance around blockTime (seconds). Default 300. */
  timestampToleranceSec?: number;
  /** Confirmation level. Default 'confirmed'. */
  commitment?: ConfirmationLevel;
  /** Override RPC URL. Default from SOLANA_RPC_URL env. */
  rpcUrl?: string;
  /** Fetch implementation (mockable for tests). Default globalThis.fetch. */
  fetchImpl?: typeof fetch;
  /** AbortSignal for timeout handling */
  signal?: AbortSignal;
}

export interface VerifyResult {
  ok: true;
  signature: string;
  slot: number;
  blockTime: number;
  amountRaw: bigint;     // raw USDC units (decimals=6) actually transferred
}

export class X402VerificationError extends Error {
  readonly reason:
    | 'rpc_unreachable'
    | 'tx_not_found'
    | 'tx_failed'
    | 'tx_not_confirmed'
    | 'amount_too_low'
    | 'mint_mismatch'
    | 'recipient_mismatch'
    | 'timestamp_out_of_range'
    | 'invalid_signature';

  constructor(reason: X402VerificationError['reason'], message: string) {
    super(message);
    this.name = 'X402VerificationError';
    this.reason = reason;
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────

/** Resolve USDC decimals. Solana USDC mainnet always has decimals=6. */
const USDC_DECIMALS = 6;

/** Convert decimal USDC to raw integer (e.g. 0.01 → 10_000n). */
export function usdToRaw(amountUsd: number): bigint {
  if (!Number.isFinite(amountUsd) || amountUsd < 0) {
    throw new X402VerificationError(
      'amount_too_low',
      `amountUsd must be a non-negative finite number, got ${amountUsd}`,
    );
  }
  // Multiply by 10^n with explicit rounding so 0.001 → 1_000n (not 999n).
  const scaled = amountUsd * 10 ** USDC_DECIMALS;
  return BigInt(Math.round(scaled));
}

/**
 * Decode a base58 Solana signature.
 * Sig is 64 bytes; in base58 this is typically 87-88 chars.
 * We only validate the character set & length here — full decode requires
 * a base58 lib, which we don't want to add. The RPC call will reject invalid
 * sigs with `tx_not_found` so this character check is just an early sanity gate.
 */
function looksLikeBase58Sig(s: string): boolean {
  return /^[1-9A-HJ-NP-Za-km-z]{64,90}$/.test(s);
}

function defaultRpcUrl(): string {
  const url = process.env.SOLANA_RPC_URL;
  if (!url) {
    throw new X402VerificationError(
      'rpc_unreachable',
      'SOLANA_RPC_URL not set. Set it to a Solana JSON-RPC endpoint (e.g. https://api.mainnet-beta.solana.com or a Helius/Alchemy URL).',
    );
  }
  return url;
}

interface TokenBalance {
  accountIndex: number;
  mint: string;
  owner?: string;
  uiTokenAmount: { amount: string; decimals: number; uiAmount?: number };
}

interface SolanaTxResponse {
  slot: number;
  blockTime: number | null;
  meta: {
    err: unknown | null;
    status?: unknown;
    preTokenBalances: TokenBalance[] | null;
    postTokenBalances: TokenBalance[] | null;
  };
  transaction: {
    message: { accountKeys: string[] };
    signatures: string[];
  };
}

// ─── Verification ──────────────────────────────────────────────────────

/**
 * Verify a Solana USDC payment transaction.
 *
 * Throws `X402VerificationError` on any failure path. Returns `VerifyResult`
 * containing the raw USDC amount transferred on success. The middleware layer
 * records the signature in the replay ledger after this returns.
 */
export async function verifyPaymentTx(
  signature: string,
  opts: VerifyOptions,
): Promise<VerifyResult> {
  if (!looksLikeBase58Sig(signature)) {
    throw new X402VerificationError(
      'invalid_signature',
      `Signature is not base58-shaped: ${signature.slice(0, 12)}…`,
    );
  }

  const rpcUrl = opts.rpcUrl ?? defaultRpcUrl();
  const fetcher = opts.fetchImpl ?? globalThis.fetch;
  const commitment = opts.commitment ?? 'confirmed';
  const expectedRaw = usdToRaw(opts.amountUsd);

  // 1) Fetch the transaction with `jsonParsed` encoding so `preTokenBalances` /
  //    `postTokenBalances` include the `owner` field — we match the recipient
  //    wallet by `owner` rather than by `accountIndex`, avoiding the need for
  //    a separate getTokenAccountsByOwner round-trip AND full SPL account
  //    decoding (which would require @solana/web3.js).
  const tx = await getTransaction(rpcUrl, signature, commitment, fetcher, opts.signal);

  // 2) Step 1 — introspect: status & timestamp.
  if (tx.meta.err) {
    throw new X402VerificationError(
      'tx_failed',
      `Transaction failed on-chain: ${JSON.stringify(tx.meta.err)}`,
    );
  }
  if (tx.blockTime === null) {
    throw new X402VerificationError(
      'tx_not_confirmed',
      'Transaction has no blockTime (not yet finalized — try again later).',
    );
  }
  const tolerance = opts.timestampToleranceSec ?? 300;
  const nowSec = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSec - tx.blockTime) > tolerance) {
    throw new X402VerificationError(
      'timestamp_out_of_range',
      `blockTime ${tx.blockTime} is more than ${tolerance}s from now (${nowSec}). Payment proof too old or from the future — possible replay.`,
    );
  }

  // 3) Step 2 — simulate: sum all USDC pre→post balance DELTAS belonging
  //    to the recipient wallet (`owner === opts.recipient`).
  //    Note: a USDC transfer from sender→recipient credits the recipient's
  //    USDC token account, increasing the postBalance. Allowance / burn
  //    operations would DECREASE it — we ignore those (only positive deltas
  //    count).
  const pre = tx.meta.preTokenBalances ?? [];
  const post = tx.meta.postTokenBalances ?? [];

  let transferredRaw = 0n;
  let matchedRecipientAccount = false;
  for (const postBal of post) {
    if (postBal.owner !== opts.recipient) continue;
    if (postBal.mint !== X402_ASSET) continue;

    matchedRecipientAccount = true;
    const preBal = pre.find(
      (b) => b.accountIndex === postBal.accountIndex && b.owner === opts.recipient,
    );
    const preRaw = BigInt(preBal?.uiTokenAmount.amount ?? '0');
    const postRaw = BigInt(postBal.uiTokenAmount.amount);
    const diff = postRaw - preRaw;
    if (diff > 0n) transferredRaw += diff;
  }

  if (!matchedRecipientAccount) {
    throw new X402VerificationError(
      'recipient_mismatch',
      `No USDC balance change found for recipient ${opts.recipient} in tx ${signature.slice(0, 12)}… — payment was sent to a different wallet or the recipient has not received USDC at the address we expect.`,
    );
  }

  if (transferredRaw < expectedRaw) {
    throw new X402VerificationError(
      'amount_too_low',
      `Recipient received ${transferredRaw} raw USDC (${transferredRaw / 1_000_000n} USDC), expected ≥ ${expectedRaw} raw (${expectedRaw / 1_000_000n} USDC).`,
    );
  }

  // 5) Step 3 — confirm: in addition to status check above, ensure one of the
  //    tx signatures matches the proof (catches relayed/replayed sigs).
  if (!tx.transaction.signatures.includes(signature)) {
    throw new X402VerificationError(
      'invalid_signature',
      'Signature is not in the transaction\'s signature list — possible relay attack.',
    );
  }

  return {
    ok: true,
    signature,
    slot: tx.slot,
    blockTime: tx.blockTime,
    amountRaw: transferredRaw,
  };
}

// ─── RPC primitives ─────────────────────────────────────────────────────

async function getTransaction(
  rpcUrl: string,
  signature: string,
  commitment: ConfirmationLevel,
  fetcher: typeof fetch,
  signal?: AbortSignal,
): Promise<SolanaTxResponse> {
  // `encoding: 'jsonParsed'` fills `preTokenBalances` / `postTokenBalances`
  // with the `owner` field — we need that to identify which token account
  // is the recipient's (see verifyPaymentTx above).
  const body = {
    jsonrpc: '2.0',
    id: 1,
    method: 'getTransaction',
    params: [
      signature,
      { encoding: 'jsonParsed', maxSupportedTransactionVersion: 0, commitment },
    ],
  };
  let res: Response;
  try {
    res = await fetcher(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    });
  } catch (err) {
    throw new X402VerificationError(
      'rpc_unreachable',
      `Failed to reach Solana RPC: ${(err as Error).message}`,
    );
  }

  if (!res.ok) {
    throw new X402VerificationError(
      'rpc_unreachable',
      `Solana RPC HTTP ${res.status}: ${res.statusText}`,
    );
  }

  const json = (await res.json()) as {
    result: SolanaTxResponse | null;
    error?: { code: number; message: string };
  };

  if (json.error) {
    // -32602 or -32000 typically means invalid sig → tx_not_found
    throw new X402VerificationError(
      'tx_not_found',
      `Solana RPC error: ${json.error.message}`,
    );
  }
  if (!json.result) {
    throw new X402VerificationError(
      'tx_not_found',
      `Transaction not found: ${signature}`,
    );
  }
  return json.result;
}


