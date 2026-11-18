// SPDX-License-Identifier: AGPL-3.0-only
/**
 * MCP protocol version negotiation (#830).
 *
 * Quill has always spoken the `2025-03-26` handshake. The ecosystem moved to
 * `2026-07-28` (stateless requests carrying an `Mcp-Method` header,
 * `subscriptions/listen`, resources with `ttlMs`). That migration is OPT-IN and
 * two-sided so nothing changes for today's clients:
 *
 *   1. the server opts in with `QUILL_PROTOCOL_VERSION=2026-07-28`, and
 *   2. the client opts in by requesting `2026-07-28` (initialize
 *      `protocolVersion`, or the `Mcp-Protocol-Version` request header).
 *
 * Anything else — no env var, an unknown env value, a legacy client hitting an
 * opted-in server — falls back to the `2025-03-26` handshake, which keeps
 * working indefinitely.
 */

/** Handshake Quill has shipped since day one; the compatibility floor. */
export const LEGACY_PROTOCOL_VERSION = '2025-03-26';

/** Opt-in protocol: stateless mode, subscriptions/listen, resource ttlMs. */
export const MODERN_PROTOCOL_VERSION = '2026-07-28';

/** Versions this server understands in an initialize handshake. */
export const KNOWN_PROTOCOL_VERSIONS = [
  '2024-11-05',
  '2025-03-26',
  '2025-06-18',
  MODERN_PROTOCOL_VERSION,
] as const;

/** Wire header that carries the protocol version on stateless requests. */
export const PROTOCOL_VERSION_HEADER = 'mcp-protocol-version';

/** Wire header that names the JSON-RPC method in 2026-07-28 stateless mode. */
export const METHOD_HEADER = 'mcp-method';

/** Resource TTL advertised in 2026-07-28 resources/list. */
export const MODERN_RESOURCE_TTL_MS = 30_000;

export interface ProtocolNegotiation {
  /** Version reported back in initialize and in the response header. */
  version: string;
  /** True when 2026-07-28 semantics are in force for this connection. */
  modern: boolean;
  /** Stateless: every request carries Mcp-Method, no session state. */
  stateless: boolean;
  /** subscriptions/listen is available. */
  subscriptionsListen: boolean;
  /** ttlMs to advertise on resources (null on the legacy handshake). */
  resourceTtlMs: number | null;
}

const LEGACY_NEGOTIATION: ProtocolNegotiation = Object.freeze({
  version: LEGACY_PROTOCOL_VERSION,
  modern: false,
  stateless: false,
  subscriptionsListen: false,
  resourceTtlMs: null,
});

const MODERN_NEGOTIATION: ProtocolNegotiation = Object.freeze({
  version: MODERN_PROTOCOL_VERSION,
  modern: true,
  stateless: true,
  subscriptionsListen: true,
  resourceTtlMs: MODERN_RESOURCE_TTL_MS,
});

/**
 * The version the operator opted into via `QUILL_PROTOCOL_VERSION`.
 * Absent or unrecognised values mean "stay on the legacy handshake" — a typo
 * must never silently move production clients onto new semantics.
 */
export function serverProtocolOptIn(
  env: NodeJS.ProcessEnv = process.env,
): string | null {
  const raw = (env['QUILL_PROTOCOL_VERSION'] ?? '').trim();
  if (!raw) return null;
  return (KNOWN_PROTOCOL_VERSIONS as readonly string[]).includes(raw) ? raw : null;
}

/**
 * Negotiate the protocol for one connection.
 *
 * Both sides must opt in to 2026-07-28; otherwise the connection gets the
 * legacy handshake (and, for a client that asked for something we know, its
 * own version echoed back as before).
 */
export function negotiateProtocolVersion(
  clientRequested: string | undefined,
  env: NodeJS.ProcessEnv = process.env,
): ProtocolNegotiation {
  const requested = (clientRequested ?? '').trim();
  // A known, non-modern client version is echoed back (unchanged behaviour).
  // 2026-07-28 is never echoed to a client that did not negotiate it.
  const legacyVersion = (KNOWN_PROTOCOL_VERSIONS as readonly string[]).includes(requested)
    && requested !== MODERN_PROTOCOL_VERSION
    ? requested
    : LEGACY_PROTOCOL_VERSION;

  const optIn = serverProtocolOptIn(env);
  if (optIn !== MODERN_PROTOCOL_VERSION) {
    // Default path: unchanged behaviour, no modern surfaces.
    return { ...LEGACY_NEGOTIATION, version: legacyVersion };
  }

  // Server opted in. Only a client that explicitly requests 2026-07-28 gets it.
  if (requested === MODERN_PROTOCOL_VERSION) {
    return MODERN_NEGOTIATION;
  }
  return { ...LEGACY_NEGOTIATION, version: legacyVersion };
}

/** First value of a possibly-repeated HTTP header, lower-cased name. */
export function firstHeader(
  headers: Record<string, string | string[] | undefined>,
  name: string,
): string | undefined {
  const raw = headers[name.toLowerCase()];
  const value = Array.isArray(raw) ? raw[0] : raw;
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

/**
 * Negotiate from the request headers alone (used by transports that see the
 * request before the JSON-RPC body — i.e. every HTTP request).
 */
export function negotiateFromHeaders(
  headers: Record<string, string | string[] | undefined>,
  env: NodeJS.ProcessEnv = process.env,
): ProtocolNegotiation {
  return negotiateProtocolVersion(firstHeader(headers, PROTOCOL_VERSION_HEADER), env);
}

/**
 * 2026-07-28 stateless mode requires `Mcp-Method` on every request, and it must
 * agree with the method in the body — the header is what stateless gateways and
 * caches route on, so a mismatch is a client bug, not something to paper over.
 *
 * Returns an error message, or null when the request is acceptable.
 */
export function checkStatelessRequest(
  negotiation: ProtocolNegotiation,
  headers: Record<string, string | string[] | undefined>,
  bodyMethod: string | undefined,
): string | null {
  if (!negotiation.stateless) return null;

  const declared = firstHeader(headers, METHOD_HEADER);
  if (!declared) {
    return `Missing ${METHOD_HEADER} header (required by ${MODERN_PROTOCOL_VERSION} stateless mode)`;
  }
  if (bodyMethod !== undefined && declared !== bodyMethod) {
    return `${METHOD_HEADER} header "${declared}" does not match request method "${bodyMethod}"`;
  }
  return null;
}
