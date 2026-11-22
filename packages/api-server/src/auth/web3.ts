/**
 * Quill — Web3 Wallet Authentication (SIWE)
 *
 * Sign-In with Ethereum (EIP-4361) compatible.
 * Flow:
 *   1. Client requests challenge with their wallet address
 *   2. Server generates SIWE message, stores nonce
 *   3. Client signs message with wallet
 *   4. Server verifies signature via ecrecover, issues JWT
 *
 * No external SIWE library needed — we format the message per EIP-4361
 * and use viem's verifyMessage for signature recovery.
 */

import { verifyMessage, getAddress } from 'viem';
import { generateNonce, setChallenge, consumeChallenge } from './challenges.js';
import { generateToken } from './jwt.js';
import { relyingPartyDomain } from '@maplespike/pipeline-core/config/public-base-url';

export interface Web3ChallengeRequest {
  address: string;
  chainId?: number;
}

export interface Web3ChallengeResponse {
  message: string;
  nonce: string;
}

export interface Web3LoginRequest {
  message: string;
  signature: string;
  address: string;
}

/**
 * Build an EIP-4361 formatted sign-in message.
 */
function buildSiweMessage(params: {
  domain: string;
  address: string;
  uri: string;
  chainId: number;
  nonce: string;
  issuedAt: string;
}): string {
  return `${params.domain} wants you to sign in with your Ethereum account:\n${params.address}\n\nMapleSpike authentication\n\nURI: ${params.uri}\nVersion: 1\nChain ID: ${params.chainId}\nNonce: ${params.nonce}\nIssued At: ${params.issuedAt}`;
}

/**
 * Step 1: Generate a challenge for the client to sign.
 */
export function createChallenge(req: Web3ChallengeRequest): Web3ChallengeResponse {
  if (!req.address || !req.address.match(/^0x[a-fA-F0-9]{40}$/)) {
    throw new Error('Invalid Ethereum address');
  }

  const nonce = generateNonce();
  const address = getAddress(req.address); // Checksum the address
  const domain = relyingPartyDomain();
  const chainId = req.chainId || 1;
  const issuedAt = new Date().toISOString();

  const message = buildSiweMessage({
    domain,
    address,
    uri: `https://${domain}`,
    chainId,
    nonce,
    issuedAt,
  });

  // Store the nonce keyed by address for verification
  setChallenge(`web3:${address.toLowerCase()}`, message, address);

  return { message, nonce };
}

/**
 * Step 2: Verify the signed message and issue a JWT.
 */
export async function verifyAndLogin(
  req: Web3LoginRequest,
): Promise<{ token: string; address: string }> {
  if (!req.message || !req.signature || !req.address) {
    throw new Error('Missing required fields: message, signature, address');
  }

  const address = getAddress(req.address).toLowerCase();
  const stored = consumeChallenge(`web3:${address}`);

  if (!stored) {
    throw new Error('No challenge found for this address. Request a new challenge first.');
  }

  if (stored.challenge !== req.message) {
    throw new Error('Challenge mismatch. Request a new challenge.');
  }

  // Verify the signature using viem's verifyMessage
  // This recovers the signer address from the signature and checks it against the claimed address
  let isValid: boolean;
  try {
    isValid = await verifyMessage({
      address: address as `0x${string}`,
      message: req.message,
      signature: req.signature as `0x${string}`,
    });
  } catch (err) {
    throw new Error(`Signature verification failed: ${err instanceof Error ? err.message : 'Unknown error'}`, { cause: err });
  }

  if (!isValid) {
    throw new Error('Signature does not match the claimed address');
  }

  // Issue JWT
  const token = generateToken({
    sub: address,
    tier: 'free',
  });

  return { token, address: getAddress(address) };
}
