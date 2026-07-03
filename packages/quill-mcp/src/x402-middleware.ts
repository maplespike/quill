/**
 * x402 (Solana USDC) payment middleware for Quill MCP.
 *
 * Gated behind X402_ENABLED env var. When enabled, intercepts tool calls
 * and checks whether the caller has provided a valid payment proof.
 *
 * For the initial implementation, validation is a stub that:
 *  - Returns the required price for paid tools
 *  - Returns x402-compatible error data when payment is missing
 *  - Does NOT yet verify Solana signatures (that's a future enhancement)
 *
 * Compatible with the MCPay CLI proxy (mcpay connect) which intercepts
 * 402 responses and handles the payment flow transparently.
 */

import { getToolPrice, type ToolPrice } from './pricing.js';

// ─── Constants ──────────────────────────────────────────────────────────

const X402_ASSET = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'; // Solana USDC mint
const X402_NETWORK = 'solana';

// ─── Types ──────────────────────────────────────────────────────────────

export interface PaymentProof {
  /** Base58-encoded Solana transaction signature */
  signature: string;
  /** Amount paid in USDC (decimal) */
  amount: number;
  /** Unix timestamp (seconds) of the payment */
  timestamp: number;
  /** Optional Solana USDC mint address */
  mint?: string;
}

export interface PaymentValidationResult {
  allowed: boolean;
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

// ─── Validation ─────────────────────────────────────────────────────────

/**
 * Validate whether a tool call is allowed based on x402 payment.
 *
 * @param toolName - The name of the tool being called
 * @param proof - Optional payment proof from the client
 * @returns PaymentValidationResult — use .allowed to gate the call
 */
export function validatePayment(
  toolName: string,
  proof?: PaymentProof,
): PaymentValidationResult {
  // If x402 is not enabled, all calls are allowed
  if (!isEnabled()) {
    return { allowed: true };
  }

  const price: ToolPrice = getToolPrice(toolName);

  // Free tools are always allowed
  if (price.priceUsd === 0) {
    return { allowed: true, price: 0, tier: price.tier };
  }

  // No payment proof provided — return 402
  if (!proof) {
    return {
      allowed: false,
      price: price.priceUsd,
      tier: price.tier,
      error: `Payment required: ${price.tier} tier ($${price.priceUsd.toFixed(3)} USDC)`,
      paymentRequired: {
        network: X402_NETWORK,
        asset: X402_ASSET,
        amount: price.priceUsd,
        decimals: 6,
        recipient: getRecipient() || undefined,
      },
    };
  }

  // --- Stub: payment proof provided but not yet verified ---
  // Future: validate Solana transaction signature using @solana/web3.js
  //
  // For now, if a proof is present we trust it. Real verification would:
  // 1. Decode the transaction from the signature
  // 2. Check it transfers >= price.priceUsd USDC to X402_RECIPIENT
  // 3. Check the timestamp is within a tolerance (e.g. 5 min)
  // 4. Check the mint matches X402_ASSET
  // 5. Deduplicate the signature to prevent replay attacks

  const msg =
    process.env.NODE_ENV === 'production'
      ? ''
      : '[x402] Payment proof provided — signature validation is stubbed. ' +
        'Full Solana verification will be added in a future release.';

  if (msg) {
    console.error(msg);
  }

  return {
    allowed: true,
    price: price.priceUsd,
    tier: price.tier,
  };
}

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
