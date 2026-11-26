/**
 * Quill — Passkey Authentication (WebAuthn)
 *
 * Uses @simplewebauthn/server for WebAuthn ceremony handling.
 * Flow:
 *   1. Registration: generate registration options → browser creates credential → verify
 *   2. Login: generate assertion options → browser signs challenge → verify → issue JWT
 *
 * Credentials stored in-memory (replace with DB for production).
 */

import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';
import type {
  AuthenticatorTransport,
  GenerateRegistrationOptionsOpts,
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
} from '@simplewebauthn/server';
import { generateToken } from './jwt.js';
import { generateNonce, setChallenge, consumeChallenge } from './challenges.js';

/**
 * @simplewebauthn/server 14 types the browser's reported transports as
 * string[] and AuthenticatorTransport as the five values the spec defines.
 * Keep only those, so a stored credential never carries a value the
 * library would reject when it builds allowCredentials.
 */
const KNOWN_TRANSPORTS: ReadonlySet<string> = new Set<AuthenticatorTransport>([
  'ble',
  'hybrid',
  'internal',
  'nfc',
  'usb',
]);

function knownTransports(raw: readonly string[] | undefined): AuthenticatorTransport[] {
  return (raw ?? []).filter((t): t is AuthenticatorTransport => KNOWN_TRANSPORTS.has(t));
}

/* ------------------------------------------------------------------ */
/*  Configuration                                                     */
/* ------------------------------------------------------------------ */

/* ══════════════════════════════════════════════════════════════════
   RP_ID must match the origin domain for passkeys to work cross-platform.
   In development, set MAPLESPIKE_DOMAIN=localhost and MAPLESPIKE_ORIGIN=http://localhost:PORT
   For production, MAPLESPIKE_DOMAIN=maplespike.lan, origin must be https.
   ══════════════════════════════════════════════════════════════════ */

const RP_NAME = 'MapleSpike';
const RP_ID = process.env.MAPLESPIKE_DOMAIN || 'maplespike.ca';
// Production default: https://quill.maplespike.ca
// Dev fallback: when RP_ID is localhost (no dots), use https://localhost
const ORIGIN = process.env.MAPLESPIKE_ORIGIN || (RP_ID.includes('.') ? `https://quill.${RP_ID}` : `https://${RP_ID}`);

/* ------------------------------------------------------------------ */
/*  In-memory credential store (replace with DB in production)        */
/* ------------------------------------------------------------------ */

interface PasskeyCredential {
  id: string;
  publicKey: Uint8Array;
  counter: number;
  transports: AuthenticatorTransport[];
  userId: string;
  deviceName: string;
  createdAt: string;
}

const credentials = new Map<string, PasskeyCredential>();

/* ------------------------------------------------------------------ */
/*  Registration                                                      */
/* ------------------------------------------------------------------ */

export interface PasskeyRegisterBeginRequest {
  userId: string;
  userName: string;
  deviceName?: string;
}

export interface PasskeyRegisterBeginResponse {
  options: Record<string, unknown>;
  registrationId: string;
}

export interface PasskeyRegisterCompleteRequest {
  registrationId: string;
  credential: Record<string, unknown>;
  deviceName?: string;
}

/**
 * Step 1a: Generate WebAuthn registration options for the browser.
 */
export async function beginRegistration(
  req: PasskeyRegisterBeginRequest,
): Promise<PasskeyRegisterBeginResponse> {
  const registrationId = generateNonce();

  // Fetch existing credentials for this user to prevent duplicate registration
  const existingCreds = req.userId
    ? Array.from(credentials.values())
        .filter(c => c.userId === req.userId)
        .map(c => ({
          id: c.id,
          transports: c.transports as AuthenticatorTransport[],
        }))
    : [];

  const options = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID: RP_ID,
    userName: req.userName,
    userDisplayName: req.userName,
    attestationType: 'none',
    excludeCredentials: existingCreds,
    authenticatorSelection: {
      residentKey: 'required',
      userVerification: 'required',
    },
  });

  // Store the challenge for verification
  setChallenge(`passkey:register:${registrationId}`, options.challenge, req.userId);

  return {
    options: options as unknown as Record<string, unknown>,
    registrationId,
  };
}

/**
 * Step 1b: Verify the browser's registration response and store the credential.
 */
export async function completeRegistration(
  req: PasskeyRegisterCompleteRequest,
): Promise<{ credentialId: string; userId: string }> {
  const stored = consumeChallenge(`passkey:register:${req.registrationId}`);
  if (!stored) {
    throw new Error('Registration session expired. Please try again.');
  }

  const verification = await verifyRegistrationResponse({
    response: req.credential as unknown as RegistrationResponseJSON,
    expectedChallenge: stored.challenge,
    expectedOrigin: ORIGIN,
    expectedRPID: RP_ID,
  });

  if (!verification.verified || !verification.registrationInfo) {
    throw new Error('Passkey registration verification failed');
  }

  // TypeScript discriminates the union after the verified check above
  const regInfo = verification.registrationInfo;
  const credentialPubKey = regInfo.credential.publicKey;
  const credentialId = regInfo.credential.id;
  const counter = regInfo.credential.counter;

  const reqCred = req.credential as unknown as RegistrationResponseJSON;

  const credential: PasskeyCredential = {
    id: credentialId,
    publicKey: new Uint8Array(credentialPubKey),
    counter,
    transports: knownTransports(reqCred.response.transports),
    userId: stored.address || 'anon',
    deviceName: req.deviceName || 'Passkey',
    createdAt: new Date().toISOString(),
  };

  credentials.set(credential.id, credential);

  return { credentialId: credential.id, userId: credential.userId };
}

/* ------------------------------------------------------------------ */
/*  Authentication (Login)                                            */
/* ------------------------------------------------------------------ */

export interface PasskeyLoginBeginRequest {
  userId?: string;
}

export interface PasskeyLoginBeginResponse {
  options: Record<string, unknown>;
  loginId: string;
}

export interface PasskeyLoginCompleteRequest {
  loginId: string;
  credential: Record<string, unknown>;
}

/**
 * Step 2a: Generate WebAuthn assertion options for the browser.
 */
export async function beginLogin(
  req: PasskeyLoginBeginRequest,
): Promise<PasskeyLoginBeginResponse> {
  const loginId = generateNonce();

  // Find credentials for this user, or allow any credential
  const allowedCredentials = req.userId
    ? Array.from(credentials.values())
        .filter(c => c.userId === req.userId)
        .map(c => ({
          id: c.id,
          transports: c.transports as AuthenticatorTransport[],
        }))
    : [];

  const options = await generateAuthenticationOptions({
    rpID: RP_ID,
    allowCredentials: allowedCredentials.length > 0 ? allowedCredentials : undefined,
    userVerification: 'required',
  });

  setChallenge(`passkey:login:${loginId}`, options.challenge);

  return {
    options: options as unknown as Record<string, unknown>,
    loginId,
  };
}

/**
 * Step 2b: Verify the assertion and issue a JWT.
 */
export async function completeLogin(
  req: PasskeyLoginCompleteRequest,
): Promise<{ token: string; userId: string }> {
  const stored = consumeChallenge(`passkey:login:${req.loginId}`);
  if (!stored) {
    throw new Error('Login session expired. Please try again.');
  }

  const credentialRaw = req.credential as unknown as AuthenticationResponseJSON;
  const credentialId = credentialRaw.id;

  const credential = credentials.get(credentialId);
  if (!credential) {
    throw new Error('Passkey not found. Please register first.');
  }

  const verification = await verifyAuthenticationResponse({
    response: credentialRaw,
    expectedChallenge: stored.challenge,
    expectedOrigin: ORIGIN,
    expectedRPID: RP_ID,
    credential: {
      id: credential.id,
      publicKey: new Uint8Array(credential.publicKey),
      counter: credential.counter,
      transports: credential.transports,
    },
  });

  if (!verification.verified) {
    throw new Error('Passkey authentication verification failed');
  }

  // Update credential counter
  if (verification.authenticationInfo) {
    credential.counter = verification.authenticationInfo.newCounter;
  }

  // Issue JWT
  const token = generateToken({
    sub: credential.userId,
    tier: 'free',
  });

  return { token, userId: credential.userId };
}

/* ------------------------------------------------------------------ */
/*  Utility                                                           */
/* ------------------------------------------------------------------ */

/**
 * List passkey credentials for a user.
 */
export function listCredentials(userId: string): Array<{ id: string; deviceName: string; createdAt: string }> {
  return Array.from(credentials.values())
    .filter(c => c.userId === userId)
    .map(c => ({ id: c.id, deviceName: c.deviceName, createdAt: c.createdAt }));
}

/**
 * Delete a passkey credential.
 */
export function deleteCredential(credentialId: string): boolean {
  return credentials.delete(credentialId);
}
