// SPDX-License-Identifier: Apache-2.0
// ---------------------------------------------------------------------------
// MapleSpike SDK — Authentication helpers
// ---------------------------------------------------------------------------

interface AuthStore {
  apiKey?: string;
  jwtToken?: string;
}

const _store: AuthStore = {};

/** Return the currently configured API key, or undefined */
export function getApiKey(): string | undefined {
  return _store.apiKey;
}

/** Set the API key used for subsequent requests */
export function setApiKey(key: string | undefined): void {
  _store.apiKey = key;
}

/** Return the currently configured JWT token, or undefined */
export function getJwtToken(): string | undefined {
  return _store.jwtToken;
}

/** Set the JWT token used for subsequent requests */
export function setJwtToken(token: string | undefined): void {
  _store.jwtToken = token;
}

/** Reset all stored credentials */
export function clearAuth(): void {
  _store.apiKey = undefined;
  _store.jwtToken = undefined;
}

/** Check whether the SDK has any authentication configured */
export function isAuthenticated(): boolean {
  return !!(_store.apiKey || _store.jwtToken);
}
