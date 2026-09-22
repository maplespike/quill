/**
 * Minted-API-key plumbing shared by every signup path.
 *
 * Three paths mint a key for a human: passkey `register/complete`, wallet
 * `verify` (EVM + Solana), and the OAuth `exchange` redemption. All three used
 * to write the key straight into `localStorage` and show nothing (`#890` /
 * gate B1-KEYREVEAL): the customer performed the whole signup ceremony and
 * never saw the credential they had just created.
 *
 * The reveal is now the primary path and storage is secondary:
 *
 *   1. the component that handled the mint renders the key once
 *      (`components/ApiKeyReveal.tsx`), and
 *   2. the key is still written to `quill-api-key`, because the API explorer,
 *      the workspace and AgentChat read that slot.
 *
 * The OAuth path cannot reveal in place — the callback redirects straight to
 * `/workspace` — so it stashes the key in a one-shot slot that `/workspace`
 * consumes on first paint (`components/KeyRevealNotice.tsx`).
 */

/** Slot read by the API explorer, /workspace and dashboard/AgentChat. */
export const API_KEY_STORAGE_KEY = "quill-api-key";

/** One-shot handoff slot: OAuth callback writes, /workspace consumes. */
export const PENDING_REVEAL_STORAGE_KEY = "quill-api-key-reveal";

/** The slice of the Web Storage API these helpers need. */
export interface KeyStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/**
 * Persist the minted key for the surfaces that already read it.
 * An empty value is ignored: never clobber a good key with a blank one.
 */
export function saveApiKey(store: KeyStore, key: string): void {
  if (!key) return;
  store.setItem(API_KEY_STORAGE_KEY, key);
}

/** Hand the minted key to the next page for a one-time reveal. */
export function stashPendingReveal(store: KeyStore, key: string): void {
  if (!key) return;
  store.setItem(PENDING_REVEAL_STORAGE_KEY, key);
}

/**
 * Read the pending key and clear the slot.
 *
 * Read-and-delete is the contract behind "this is the only time we show it":
 * a reload cannot re-render the key from the slot (the secondary
 * `quill-api-key` entry is untouched, so the explorer still works).
 */
export function consumePendingReveal(store: KeyStore): string | null {
  const key = store.getItem(PENDING_REVEAL_STORAGE_KEY);
  if (!key) return null;
  store.removeItem(PENDING_REVEAL_STORAGE_KEY);
  return key;
}

/** Read `{ apiKey: { key } }` (also tolerates `apiKey` as a bare string). */
function readApiKey(node: unknown): string | null {
  if (!node || typeof node !== "object") return null;
  const apiKey = (node as { apiKey?: unknown }).apiKey;
  if (!apiKey) return null;
  const key = typeof apiKey === "string" ? apiKey : (apiKey as { key?: unknown }).key;
  return typeof key === "string" && key.length > 0 ? key : null;
}

/** Minted key from an api-server envelope: `{ success, data: { apiKey } }`. */
export function mintedKeyFromEnvelope(response: unknown): string | null {
  if (!response || typeof response !== "object") return null;
  return readApiKey((response as { data?: unknown }).data);
}

/** Minted key from an already-unwrapped payload, e.g. the OAuth exchange `data`. */
export function mintedKeyFromPayload(payload: unknown): string | null {
  return readApiKey(payload);
}
