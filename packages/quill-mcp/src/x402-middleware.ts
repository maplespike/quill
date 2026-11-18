// SPDX-License-Identifier: AGPL-3.0-only
/**
 * x402 (Solana USDC) payment middleware for Quill MCP.
 *
 * Phase 1: stub verification (trust presence of proof).
 * Phase 2: full Solana tx verification via solana-rpc.ts,
 *          replay protection via x402-ledger.ts.
 * Phase 3: pre-pay credit balance via credit-balance.ts,
 *          with the x402-deposit tool as the funding entry point.
 *
 * Gated behind the X402_ENABLED env var. When disabled, every call
 * passes through with zero overhead.
 *
 * Compatible with the MCPay CLI proxy (mcpay connect) which intercepts
 * 402 responses and handles the payment flow transparently.
 */

import { getToolPrice, type ToolPrice } from './pricing.js';
import {
  X402_ASSET,
  X402_NETWORK,
  X402_DEFAULT_COMMITMENT,
  X402_DEFAULT_TIMESTAMP_TOLERANCE_SEC,
} from './x402-constants.js';
import {
  verifyPaymentTx,
  X402VerificationError,
} from './solana-rpc.js';
import { getReplayLedger } from './x402-ledger.js';
import { getCreditStore } from './credit-balance.js';
import { getCurrentIdentity, type QuotaIdentity } from './quota.js';

// ─── Types ──────────────────────────────────────────────────────────────

export interface PaymentProof {
  /** Base58-encoded Solana transaction signature */
  signature: string;
  /** Amount paid in USDC (decimal) */
  amount: number;
  /** Unix timestamp (seconds) of the payment (caller-supplied; tx blockTime is authoritative) */
  timestamp: number;
  /** Optional Solana USDC mint address */
  mint?: string;
}

export interface PaymentValidationResult {
  allowed: boolean;
  /** The path that authorised the call — helpful for debugging in tool responses. */
  via?: 'free' | 'credit' | 'signature' | 'disabled';
  price?: number;
  tier?: string;
  error?: string;
  /** x402-compatible error data for 402 responses */
  paymentRequired?: {
    network: string;
    asset: string;
    amount: number;
    decimals: number;
    recipient?: string;
  };
}

// ─── Configuration ─────────────────────────────────────────────────────

function isEnabled(): boolean {
  return process.env.X402_ENABLED === 'true';
}

function getRecipient(): string {
  return process.env.X402_RECIPIENT || '';
}

function getRpcUrl(): string | undefined {
  return process.env.SOLANA_RPC_URL || undefined;
}

// ─── Validation ─────────────────────────────────────────────────────────

/**
 * Validate whether a tool call is allowed based on x402 payment.
 *
 * Order of precedence when X402_ENABLED=true:
 *   1. Free tools (priceUsd === 0)         → allow
 *   2. Credit balance ≥ price              → spend from credit, allow
 *   3. Proof with signature                → verify on-chain via solana-rpc,
 *                                            record in replay ledger, allow
 *   4. Otherwise                            → 402 with payment requirements
 *
 * @param toolName - The name of the tool being called
 * @param proof    - Optional payment proof from the client
 * @param identity - Optional caller identity (for credit-based payments)
 */
export async function validatePayment(
  toolName: string,
  proof?: PaymentProof,
  identity?: QuotaIdentity,
): Promise<PaymentValidationResult> {
  // 0. Feature flag — all calls allowed if x402 is not enabled.
  if (!isEnabled()) {
    return { allowed: true, via: 'disabled' };
  }

  const price: ToolPrice = getToolPrice(toolName);

  // 1. Free tools always pass.
  if (price.priceUsd === 0) {
    return { allowed: true, via: 'free', price: 0, tier: price.tier };
  }

  const callerIdentity = identity ?? safeReadIdentity();

  // 2. Pre-pay credit balance (Phase 3). Spend from credit before falling
  //    through to per-call on-chain verification.
  if (callerIdentity && callerIdentity.mode !== 'self-hosted') {
    const credits = getCreditStore();
    const status = credits.getStatus(callerIdentity);
    if (status.balance >= price.priceUsd) {
      const spent = credits.spend(callerIdentity, price.priceUsd);
      if (spent) {
        return {
          allowed: true,
          via: 'credit',
          price: price.priceUsd,
          tier: price.tier,
        };
      }
      // Another concurrent call drained the balance between getStatus and
      // spend — fall through to per-call verification.
    }
  }

  const recipient = getRecipient();
  if (!recipient) {
    return {
      allowed: false,
      price: price.priceUsd,
      tier: price.tier,
      error:
        'Server misconfiguration: X402_RECIPIENT env var is not set. Cannot verify payments without a recipient wallet.',
    };
  }

  // 3. Per-call on-chain verification (Phase 2). Requires a signature.
  if (!proof?.signature) {
    return {
      allowed: false,
      price: price.priceUsd,
      tier: price.tier,
      error: `Payment required: ${price.tier} tier ($${price.priceUsd.toFixed(3)} USDC). ` +
        `Either deposit credits via the x402-deposit tool, or attach an X-PAYMENT header ` +
        `with a Solana tx signature proving this amount was sent to the recipient.`,
      paymentRequired: {
        network: X402_NETWORK,
        asset: X402_ASSET,
        amount: price.priceUsd,
        decimals: 6,
        recipient,
      },
    };
  }

  const rpcUrl = getRpcUrl();
  if (!rpcUrl) {
    return {
      allowed: false,
      price: price.priceUsd,
      tier: price.tier,
      error:
        'Server misconfiguration: SOLANA_RPC_URL env var is not set. Cannot verify on-chain tx.',
    };
  }

  // Replay-block before RPC. Cheap O(1) check; saves an RPC call when
  // a duplicate signature is replayed.
  const ledger = getReplayLedger();
  if (ledger.has(proof.signature)) {
    return {
      allowed: false,
      price: price.priceUsd,
      tier: price.tier,
      error: `Replay blocked: signature ${proof.signature.slice(0, 12)}… has already been consumed. Submit a fresh payment.`,
    };
  }

  // RPC verify.
  try {
    await verifyPaymentTx(proof.signature, {
      amountUsd: proof.amount,
      recipient,
      rpcUrl,
      commitment:
        (process.env.X402_CONFIRMATION_LEVEL as 'confirmed' | 'finalized') ||
        X402_DEFAULT_COMMITMENT,
      timestampToleranceSec:
        parseInt(process.env.X402_TIMESTAMP_TOLERANCE_SEC ?? '', 10) ||
        X402_DEFAULT_TIMESTAMP_TOLERANCE_SEC,
    });

    // Atomic record-if-new: if a concurrent call raced us between has() and
    // recordIfNew(), we lose the race and reject (do NOT double-bill).
    if (!ledger.recordIfNew(proof.signature)) {
      return {
        allowed: false,
        price: price.priceUsd,
        tier: price.tier,
        error: `Replay detected mid-verification: signature ${proof.signature.slice(0, 12)}… was concurrently consumed.`,
      };
    }

    return {
      allowed: true,
      via: 'signature',
      price: price.priceUsd,
      tier: price.tier,
    };
  } catch (e) {
    if (e instanceof X402VerificationError) {
      return {
        allowed: false,
        price: price.priceUsd,
        tier: price.tier,
        error: `Verification failed (${e.reason}): ${e.message}`,
      };
    }
    return {
      allowed: false,
      price: price.priceUsd,
      tier: price.tier,
      error: `Unexpected verification error: ${(e as Error).message}`,
    };
  }
}

// ─── Header / args parsing ──────────────────────────────────────────────

/**
 * Parse a PaymentProof from an X-PAYMENT header value.
 * Expected format: JSON-encoded PaymentProof object.
 */
export function parsePaymentHeader(header: string | undefined): PaymentProof | undefined {
  if (!header) return undefined;
  try {
    const parsed = JSON.parse(header) as PaymentProof;
    if (parsed.signature && typeof parsed.amount === 'number' && typeof parsed.timestamp === 'number') {
      return parsed;
    }
    return undefined;
  } catch {
    return undefined;
  }
}

/**
 * Parse a PaymentProof from tool call arguments.
 * Clients can include { _payment: PaymentProof } in tool args for stdio transport.
 */
export function extractPaymentFromArgs(args: Record<string, unknown>): PaymentProof | undefined {
  const payment = args?.['_payment'];
  if (!payment || typeof payment !== 'object') return undefined;
  const p = payment as Record<string, unknown>;
  if (p.signature && typeof p.amount === 'number' && typeof p.timestamp === 'number') {
    return p as unknown as PaymentProof;
  }
  return undefined;
}

// ─── Internal helpers ───────────────────────────────────────────────────

/**
 * Read the current AsyncLocalStorage identity in a way that won't blow up
 * if the server hasn't installed one (e.g. inside standalone tests).
 */
function safeReadIdentity(): QuotaIdentity | null {
  try {
    return getCurrentIdentity();
  } catch {
    return null;
  }
}
