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

describe('alternate portal CSP copies', () => {
  test('nginx.conf and _headers allow the same analytics hosts', () => {
    const nginx = readFileSync(join(__dirname, '..', 'nginx.conf'), 'utf8');
    const headers = readFileSync(join(__dirname, '..', 'public', '_headers'), 'utf8');
    const nginxCsp = nginx.match(/Content-Security-Policy "([^"]+)"/)?.[1] ?? '';
    const headersCsp = headers.match(/Content-Security-Policy: ([^\n]+)/)?.[1] ?? '';
    expect(nginxCsp.length).toBeGreaterThan(0);
    expect(headersCsp.length).toBeGreaterThan(0);
    assertAnalyticsHosts(nginxCsp);
    assertAnalyticsHosts(headersCsp);
  });
});
