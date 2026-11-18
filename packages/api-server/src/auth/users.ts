// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Quill — User Storage (In-Memory)
 *
 * Stores user accounts created via GitHub OAuth.
 * Can be upgraded to DB later.
 */

import type { Tenant, User, GitHubProfile, ApiKeyRecord } from '../types.js';
import * as crypto from 'node:crypto';
// Decision 0002: real top-level import of the PII hash helper.
// Earlier draft used CommonJS `require()` inside ESM which threw
// at runtime in any ESM-only loader. This fixed version lives
// next to the storage adapters so every `emailHashIndex` lookup
// uses the same HMAC secret policy.
import { hashPii, hashPiiCandidates } from './pii-hash.js';

/* ------------------------------------------------------------------ */
/*  In-Memory Stores                                                   */
/* ------------------------------------------------------------------ */

// Decision 0002: removed `emailIndex`. We never build a reverse
// lookup from a plaintext email — only `emailHash` joins exist.
const userStore = new Map<string, User>();
const githubIdIndex = new Map<string, string>();   // githubId -> userId
const emailHashIndex = new Map<string, string>();  // emailHash -> userId
const userApiKeys = new Map<string, ApiKeyRecord[]>(); // userId -> keys[]
const tenantStore = new Map<string, Tenant>();      // userId (as tenantId) -> Tenant

/* ------------------------------------------------------------------ */
/*  User Creation                                                      */
/* ------------------------------------------------------------------ */

/**
 * Create a user from a GitHub OAuth profile.
 * If a user with the same GitHub ID already exists, returns the existing user.
 */
export function createUser(githubProfile: GitHubProfile): User {
  // Check if already exists by GitHub ID
  const existingId = githubIdIndex.get(githubProfile.id.toString());
  if (existingId) {
    const existing = userStore.get(existingId);
    if (existing) {
      // Update profile info
      existing.githubLogin = githubProfile.login;
      existing.githubName = githubProfile.name || null;
      existing.avatarUrl = githubProfile.avatar_url || null;
      (existing as any).email = githubProfile.email || existing.emailHash;
      existing.updatedAt = new Date().toISOString();
      return existing;
    }
  }

  // Decision 0002: lookup is by `emailHash`, not plaintext email.
  // Caller is responsible for hashing the OAuth provider's email
  // before this branch runs.
  let emailHash: string | null = null;
  if (githubProfile.email) {
    emailHash = hashPii(githubProfile.email);
    // Dual-key rotation support (Decision 0002): an account created before a
    // secret rotation is indexed under the previous secret's hash — match both.
    const existingUserId = hashPiiCandidates(githubProfile.email)
      .map((candidate) => emailHashIndex.get(candidate))
      .find((userId) => userId !== undefined);
    if (existingUserId) {
      const user = userStore.get(existingUserId);
      if (user) {
        githubIdIndex.set(githubProfile.id.toString(), user.id);
        user.githubId = githubProfile.id.toString();
        user.githubLogin = githubProfile.login;
        user.githubName = githubProfile.name || null;
        user.avatarUrl = githubProfile.avatar_url || null;
        user.updatedAt = new Date().toISOString();
        return user;
      }
    }
  }

  // Create new user
  const userId = generateId('user');
  const now = new Date().toISOString();

  const user: User = {
    id: userId,
    emailHash,
    githubId: githubProfile.id.toString(),
    githubLogin: githubProfile.login,
    githubName: githubProfile.name || null,
    avatarUrl: githubProfile.avatar_url || null,
    tier: 'free',
    isActive: true,
    createdAt: now,
    updatedAt: now,
  };

  userStore.set(userId, user);
  githubIdIndex.set(githubProfile.id.toString(), userId);
  if (emailHash) {
    emailHashIndex.set(emailHash, userId);
  }

  // Also create a corresponding tenant in tenantStore
  tenantStore.set(userId, {
    id: userId,
    name: githubProfile.name || githubProfile.login,
    emailHash: emailHash || undefined,
    tier: 'free',
    emailVerified: false,
    isActive: true,
    journalismMode: false,
  });

  // Give the user an initial API key
  const keyId = generateId('key');
  const rawKey = generateRawApiKey();
  const keyRecord: ApiKeyRecord = {
    id: keyId,
    tenantId: userId,
    keyHash: rawKey, // In production, hash this
    name: 'default',
    isActive: true,
  };
  userApiKeys.set(userId, [keyRecord]);

  return user;
}

/* ------------------------------------------------------------------ */
/*  User Lookups                                                       */
/* ------------------------------------------------------------------ */

export function getUser(id: string): User | undefined {
  return userStore.get(id);
}

/**
 * Decision 0002: lookup is by plaintext email but the runtime
 * hashes with the server secret before consulting the index —
 * the plaintext is never persisted in the returned user record.
 */
export function getUserByEmail(email: string): User | undefined {
  // Dual-key rotation support: try the current secret first, then the
  // previous one (see pii-hash.ts) so pre-rotation rows stay findable.
  for (const candidate of hashPiiCandidates(email)) {
    const userId = emailHashIndex.get(candidate);
    if (userId) return userStore.get(userId);
  }
  return undefined;
}

export function getUserByGithubId(githubId: string): User | undefined {
  const userId = githubIdIndex.get(githubId);
  if (!userId) return undefined;
  return userStore.get(userId);
}

export function listUsers(): User[] {
  return Array.from(userStore.values());
}

export function getTenantForUser(userId: string): Tenant | undefined {
  return tenantStore.get(userId);
}

/* ------------------------------------------------------------------ */
/*  API Key Management                                                 */
/* ------------------------------------------------------------------ */

export function generateApiKey(userId: string): { id: string; rawKey: string } | null {
  if (!userStore.has(userId)) return null;

  const keyId = generateId('key');
  const rawKey = generateRawApiKey();

  const keyRecord: ApiKeyRecord = {
    id: keyId,
    tenantId: userId,
    keyHash: rawKey, // In production, hash this
    name: 'default',
    isActive: true,
  };

  const keys = userApiKeys.get(userId) || [];
  keys.push(keyRecord);
  userApiKeys.set(userId, keys);

  return { id: keyId, rawKey };
}

export function revokeApiKey(userId: string, keyId: string): boolean {
  const keys = userApiKeys.get(userId);
  if (!keys) return false;

  const key = keys.find((k) => k.id === keyId);
  if (!key) return false;

  key.isActive = false;
  return true;
}

export function getUserKeys(userId: string): ApiKeyRecord[] {
  return userApiKeys.get(userId) || [];
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function generateId(prefix: string): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${prefix}_${hex}`;
}

function generateRawApiKey(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
  return `quill_${hex}`;
}
