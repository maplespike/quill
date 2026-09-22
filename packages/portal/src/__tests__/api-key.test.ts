/**
 * Gate B1-KEYREVEAL (#890) — the minted-key plumbing behind the one-time
 * reveal. These cover the two things that decide whether a customer ever sees
 * their key: reading it out of an api-server response, and the one-shot
 * handoff slot the OAuth path uses.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  API_KEY_STORAGE_KEY,
  PENDING_REVEAL_STORAGE_KEY,
  consumePendingReveal,
  mintedKeyFromEnvelope,
  mintedKeyFromPayload,
  saveApiKey,
  stashPendingReveal,
  type KeyStore,
} from "../lib/api-key.js";

const KEY = "quill_live_0123456789abcdef0123456789abcdef";

/** Minimal in-memory Web Storage stand-in. */
function memoryStore(initial: Record<string, string> = {}): KeyStore & { dump: () => Record<string, string> } {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (k) => (data.has(k) ? (data.get(k) as string) : null),
    setItem: (k, v) => {
      data.set(k, v);
    },
    removeItem: (k) => {
      data.delete(k);
    },
    dump: () => Object.fromEntries(data),
  };
}

describe("mintedKeyFromEnvelope", () => {
  it("reads the key from the passkey register/complete envelope", () => {
    const response = {
      success: true,
      data: { apiKey: { id: "key_1", key: KEY }, userId: "user_ab12cd34" },
    };
    assert.equal(mintedKeyFromEnvelope(response), KEY);
  });

  it("reads the key from the wallet (astral) verify envelope", () => {
    const response = {
      success: true,
      data: { apiKey: { id: "key_2", key: KEY }, address: "0xabc" },
    };
    assert.equal(mintedKeyFromEnvelope(response), KEY);
  });

  it("tolerates apiKey as a bare string", () => {
    assert.equal(mintedKeyFromEnvelope({ success: true, data: { apiKey: KEY } }), KEY);
  });

  it("returns null when no key was minted, so the reveal is skipped", () => {
    assert.equal(mintedKeyFromEnvelope({ success: true, data: { userId: "user_1" } }), null);
    assert.equal(mintedKeyFromEnvelope({ success: true, data: { apiKey: {} } }), null);
    assert.equal(mintedKeyFromEnvelope({ success: true, data: { apiKey: { key: "" } } }), null);
    assert.equal(mintedKeyFromEnvelope({ success: true, data: null }), null);
    assert.equal(mintedKeyFromEnvelope({}), null);
    assert.equal(mintedKeyFromEnvelope(undefined), null);
    assert.equal(mintedKeyFromEnvelope("not-an-object"), null);
  });
});

describe("mintedKeyFromPayload", () => {
  it("reads the key from the unwrapped OAuth exchange payload", () => {
    assert.equal(mintedKeyFromPayload({ apiKey: { id: "key_3", key: KEY } }), KEY);
  });

  it("returns null for a payload without a key", () => {
    assert.equal(mintedKeyFromPayload({ name: "github", isNewUser: true }), null);
    assert.equal(mintedKeyFromPayload(null), null);
  });
});

describe("API key storage", () => {
  it("saves the key to the slot the explorer and workspace read", () => {
    const store = memoryStore();
    saveApiKey(store, KEY);
    assert.deepEqual(store.dump(), { [API_KEY_STORAGE_KEY]: KEY });
  });

  it("never clobbers a stored key with an empty value", () => {
    const store = memoryStore({ [API_KEY_STORAGE_KEY]: KEY });
    saveApiKey(store, "");
    assert.equal(store.getItem(API_KEY_STORAGE_KEY), KEY);
  });
});

describe("one-time reveal handoff (OAuth path)", () => {
  it("returns the stashed key exactly once", () => {
    const store = memoryStore();
    stashPendingReveal(store, KEY);

    assert.equal(consumePendingReveal(store), KEY);
    // consumed: a reload cannot re-render the key from this slot
    assert.equal(consumePendingReveal(store), null);
    assert.equal(store.getItem(PENDING_REVEAL_STORAGE_KEY), null);
  });

  it("returns null when nothing is pending", () => {
    assert.equal(consumePendingReveal(memoryStore()), null);
  });

  it("ignores an empty stash so a blank value cannot open the reveal", () => {
    const store = memoryStore();
    stashPendingReveal(store, "");
    assert.equal(consumePendingReveal(store), null);
  });

  it("consuming the reveal leaves the explorer's key in place", () => {
    const store = memoryStore();
    saveApiKey(store, KEY);
    stashPendingReveal(store, KEY);

    consumePendingReveal(store);

    assert.notEqual(API_KEY_STORAGE_KEY, PENDING_REVEAL_STORAGE_KEY);
    assert.equal(store.getItem(API_KEY_STORAGE_KEY), KEY);
  });
});
