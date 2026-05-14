/**
 * MapleSpike — User Storage (In-Memory)
 *
 * Stores user accounts created via GitHub OAuth.
 * Can be upgraded to DB later.
 */

import type { Tenant, User, GitHubProfile, ApiKeyRecord } from '../types.js';
import * as crypto from 'node:crypto';

/* ------------------------------------------------------------------ */
/*  In-Memory Stores                                                   */
/* ------------------------------------------------------------------ */

const userStore = new Map<string, User>();
const githubIdIndex = new Map<string, string>();   // githubId -> userId
const emailIndex = new Map<string, string>();       // email -> userId
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
      existing.email = githubProfile.email || existing.email;
      existing.updatedAt = new Date().toISOString();
      return existing;
    }
  }

  // Check by email
  if (githubProfile.email) {
    const emailExisting = emailIndex.get(githubProfile.email);
    if (emailExisting) {
      const existing = userStore.get(emailExisting);
      if (existing) {
        githubIdIndex.set(githubProfile.id.toString(), existing.id);
        existing.githubId = githubProfile.id.toString();
        existing.githubLogin = githubProfile.login;
        existing.githubName = githubProfile.name || null;
        existing.avatarUrl = githubProfile.avatar_url || null;
        existing.updatedAt = new Date().toISOString();
        return existing;
      }
    }
  }

  // Create new user
  const userId = generateId('user');
  const now = new Date().toISOString();

  const user: User = {
    id: userId,
    email: githubProfile.email || null,
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
  if (githubProfile.email) {
    emailIndex.set(githubProfile.email, userId);
  }

  // Also create a corresponding tenant in tenantStore
  tenantStore.set(userId, {
    id: userId,
    name: githubProfile.name || githubProfile.login,
    email: githubProfile.email || undefined,
    tier: 'free',
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

export function getUserByEmail(email: string): User | undefined {
  const userId = emailIndex.get(email);
  if (!userId) return undefined;
  return userStore.get(userId);
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
  return `maplespike_${hex}`;
}
