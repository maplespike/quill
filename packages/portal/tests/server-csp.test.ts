import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

const server = readFileSync(join(__dirname, '..', 'server.py'), 'utf8');

function directive(csp: string, name: string): string {
  const match = csp.split(';').map((d) => d.trim()).find((d) => d.startsWith(`${name} `));
  return match ?? '';
}

// Extract the CSP string literal assigned to QuillHandler.CSP (concatenated Python string pieces).
const cspMatch = server.match(/CSP = \(([\s\S]*?)\n    \)/);
const csp = cspMatch
  ? [...cspMatch[1].matchAll(/"((?:[^"\\]|\\.)*)"/g)].map((m) => m[1]).join('')
  : '';

describe('server.py Content-Security-Policy', () => {
  test('is present', () => {
    expect(csp.length).toBeGreaterThan(0);
  });

  test('allows Stripe embedded checkout scripts, frames and API calls', () => {
    expect(directive(csp, 'script-src')).toContain('https://js.stripe.com');
    expect(directive(csp, 'frame-src')).toContain('https://js.stripe.com');
    expect(directive(csp, 'frame-src')).toContain('https://hooks.stripe.com');
    expect(directive(csp, 'connect-src')).toContain('https://api.stripe.com');
  });

  test('no longer allows retired Google Fonts origins', () => {
    expect(csp).not.toContain('fonts.googleapis.com');
    expect(csp).not.toContain('fonts.gstatic.com');
    expect(directive(csp, 'font-src')).toBe("font-src 'self'");
  });

  test('allows Plausible and Cloudflare Web Analytics on the exact hosts they use', () => {
    // script.js is loaded from plausible.io and posts events to that same origin.
    // The RUM beacon is loaded from static.cloudflareinsights.com and posts to
    // https://cloudflareinsights.com/cdn-cgi/rum. Host sources are exact: a
    // wildcard would also allow every other host under those registrable domains.
    assertAnalyticsHosts(csp);
  });
});

function assertAnalyticsHosts(value: string) {
  const script = directive(value, 'script-src');
  const connect = directive(value, 'connect-src');
  expect(script).toContain('https://plausible.io');
  expect(script).toContain('https://static.cloudflareinsights.com');
  expect(connect).toContain('https://plausible.io');
  expect(connect).toContain('https://cloudflareinsights.com');
  expect(connect).not.toContain('https://static.cloudflareinsights.com');
  expect(script).not.toMatch(/https:\/\/\*\.(?:plausible\.io|cloudflareinsights\.com|cloudflare\.com)/);
  expect(connect).not.toMatch(/https:\/\/\*\.(?:plausible\.io|cloudflareinsights\.com|cloudflare\.com)/);
}

function parsePolicy(value: string): Map<string, string[]> {
  const policy = new Map<string, string[]>();
  for (const part of value.split(';')) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const [name, ...sources] = trimmed.split(/\s+/);
    policy.set(name, sources);
  }
  return policy;
}

const nginxConf = readFileSync(join(__dirname, '..', 'nginx.conf'), 'utf8');
const headersFile = readFileSync(join(__dirname, '..', 'public', '_headers'), 'utf8');
const nginxCsp = nginxConf.match(/Content-Security-Policy "([^"]+)"/)?.[1] ?? '';
const headersCsp = headersFile.match(/Content-Security-Policy: ([^\n]+)/)?.[1] ?? '';

// There is one policy served by three servers. Comparing only the analytics hosts
// is what let the served copy ship without js.stripe.com or frame-src at all, so
// the live checkout could not load its payment form while these tests passed.
// Now the copies must be identical directive-for-directive: any future edit that
// touches one file and not the others fails here, by name.
describe('the three portal CSP copies are one policy', () => {
  const copies: Array<[string, Map<string, string[]>]> = [
    ['server.py', parsePolicy(csp)],
    ['nginx.conf', parsePolicy(nginxCsp)],
    ['public/_headers', parsePolicy(headersCsp)],
  ];

  test.each([
    ['nginx.conf', parsePolicy(nginxCsp)],
    ['public/_headers', parsePolicy(headersCsp)],
  ] as Array<[string, Map<string, string[]>]>)('%s matches server.py exactly', (name, parsed) => {
    const reference = copies[0][1];
    expect(parsed.size, `${name} directive count`).toBeGreaterThan(5);
    expect([...parsed.keys()].sort()).toEqual([...reference.keys()].sort());
    for (const [directiveName, sources] of reference) {
      expect(parsed.get(directiveName), `${name} → ${directiveName}`).toEqual(sources);
    }
  });

  test('every copy carries the hardening directives, quoted correctly', () => {
    for (const [name, parsed] of copies) {
      expect(parsed.get('object-src'), name).toEqual(["'none'"]);
      expect(parsed.get('base-uri'), name).toEqual(["'self'"]);
      expect(parsed.get('form-action'), name).toEqual(["'self'"]);
      // `frame-ancestors none` (unquoted) is an invalid source expression and the
      // directive is discarded. nginx.conf shipped exactly that until today.
      expect(parsed.get('frame-ancestors'), name).toEqual(["'none'"]);
      expect(parsed.has('upgrade-insecure-requests'), name).toBe(true);
      expect(parsed.get('default-src'), name).toEqual(["'self'"]);
    }
  });

  test('script-src grants eval only because /api-reference needs it, and never data:', () => {
    // Measured 2026-11-23 with e2e/csp-audit.mjs: removing 'unsafe-eval' left
    // exactly one violating route — /api-reference, where Scalar's chunk calls
    // new Function. It came back with that reason attached rather than silently.
    // 'data:' was removed the same day and no route asked for it back.
    for (const [name, parsed] of copies) {
      const scriptSrc = parsed.get('script-src') ?? [];
      expect(scriptSrc, name).toContain("'unsafe-eval'");
      expect(scriptSrc, name).not.toContain('data:');
    }
  });

  test("'unsafe-inline' in script-src is deliberate, and the config does not try to hash around it", () => {
    // Measured 2026-11-23: Astro's security.csp emitted a meta CSP with SHA-384
    // hashes and the site broke with 83 securitypolicyviolations — inline event
    // handlers (script-src-attr) cannot be hashed at all, and several `is:inline`
    // blocks never got a hash. It was reverted within the hour. The meta policy
    // only tightens, so the page's own scripts stopped running.
    //
    // This test exists so nobody re-enables it believing it is free hardening:
    // the audit (e2e/csp-audit.mjs) is what shows the difference, and removing
    // 'unsafe-inline' for real starts with deleting the inline handlers.
    const astroConfig = readFileSync(join(__dirname, '..', 'astro.config.mjs'), 'utf8');
    expect(astroConfig).not.toContain('security:');
    expect(directive(csp, 'script-src')).toContain("'unsafe-inline'");
  });

  test('no copy allows a host nothing in the portal uses', () => {
    for (const [name, parsed] of copies) {
      const flat = [...parsed.values()].flat().join(' ');
      expect(flat, name).not.toContain('fonts.googleapis.com');
      expect(flat, name).not.toContain('fonts.gstatic.com');
      expect(flat, name).not.toContain('googleusercontent.com');
      expect(flat, name).not.toContain('https://www.google.com');
    }
  });
});
