// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Shared constants for x402 (Solana USDC) payment modules.
 *
 * Solana mainnet USDC mint. Stable across all deployments
 * (USDC devnet uses a different mint — out of scope for production).
 */
export const X402_ASSET = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

/** Solana mainnet. */
export const X402_NETWORK = 'solana';

/** USDC decimals on Solana (always 6). */
export const X402_USDC_DECIMALS = 6;

/** Default confirmation level when verifying payments. */
export const X402_DEFAULT_COMMITMENT = 'confirmed' as const;

/** Default timestamp tolerance for tx blockTime (5 minutes). */
export const X402_DEFAULT_TIMESTAMP_TOLERANCE_SEC = 300;

/** Replay ledger retention — signatures older than this can be GC'd. */
export const X402_LEDGER_RETENTION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
